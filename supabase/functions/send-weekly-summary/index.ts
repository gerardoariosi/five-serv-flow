// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2'

const SITE_NAME = 'FiveServ Operations Hub'
const SENDER_DOMAIN = 'notify.fiveserv.net'
const FROM_DOMAIN = 'notify.fiveserv.net'

function substituteVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match
  })
}

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1].replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    return JSON.parse(atob(payload)) as Record<string, unknown>
  } catch { return null }
}

async function getOrCreateUnsubscribeToken(
  supabase: ReturnType<typeof createClient>,
  email: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', email)
    .is('used_at', null)
    .maybeSingle()

  if (existing?.token) return existing.token

  const token = crypto.randomUUID()
  await supabase.from('email_unsubscribe_tokens').insert({ email, token })
  return token
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Only allow service_role calls (cron job)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const token = authHeader.slice('Bearer '.length).trim()
  const claims = parseJwtClaims(token)
  if (claims?.role !== 'service_role') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Calculate week range (previous Mon–Sun in ET)
  const now = new Date()
  const lastMonday = new Date(now)
  lastMonday.setDate(now.getDate() - now.getDay() - 6) // previous Monday
  lastMonday.setHours(0, 0, 0, 0)
  const lastSunday = new Date(lastMonday)
  lastSunday.setDate(lastMonday.getDate() + 6)
  lastSunday.setHours(23, 59, 59, 999)

  const weekStart = lastMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // Gather metrics
  const { count: ticketsClosed } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'closed')
    .gte('closed_at', lastMonday.toISOString())
    .lte('closed_at', lastSunday.toISOString())

  const { count: ticketsActive } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .not('status', 'in', '("closed","draft")')

  const { count: unassignedCount } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .is('technician_id', null)
    .not('status', 'in', '("closed","draft")')

  const { count: pausedCount } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'paused')

  const { count: pendingReview } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending_review')

  // Make-ready metrics
  const { data: makeReadyTickets } = await supabase
    .from('tickets')
    .select('created_at, closed_at')
    .eq('work_type', 'make_ready')
    .eq('status', 'closed')
    .gte('closed_at', lastMonday.toISOString())
    .lte('closed_at', lastSunday.toISOString())

  let onTimeCount = 0
  let lateCount = 0
  let totalCloseDays = 0

  for (const t of makeReadyTickets || []) {
    if (t.created_at && t.closed_at) {
      const days = Math.ceil((new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24))
      totalCloseDays += days
      if (days <= 5) onTimeCount++
      else lateCount++
    }
  }

  const totalMakeReady = onTimeCount + lateCount
  const compliance = totalMakeReady > 0 ? Math.round((onTimeCount / totalMakeReady) * 100) : 100
  const complianceColor = compliance >= 90 ? '#28a745' : compliance >= 75 ? '#FFBF00' : '#dc3545'

  // All closed tickets for avg close days
  const { data: allClosed } = await supabase
    .from('tickets')
    .select('created_at, closed_at')
    .eq('status', 'closed')
    .gte('closed_at', lastMonday.toISOString())
    .lte('closed_at', lastSunday.toISOString())

  let totalDays = 0
  let closedCount = 0
  for (const t of allClosed || []) {
    if (t.created_at && t.closed_at) {
      totalDays += Math.ceil((new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24))
      closedCount++
    }
  }
  const avgCloseDays = closedCount > 0 ? (totalDays / closedCount).toFixed(1) : '0'

  // Load template
  const { data: template } = await supabase
    .from('email_templates')
    .select('subject, body')
    .eq('template_key', 'weekly_summary')
    .single()

  if (!template) {
    console.error('weekly_summary template not found')
    return new Response(JSON.stringify({ error: 'Template not found' }), { status: 500 })
  }

  // Get all admin users
  const { data: adminRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin')

  if (!adminRoles?.length) {
    return new Response(JSON.stringify({ message: 'No admin users found' }), { status: 200 })
  }

  const { data: adminUsers } = await supabase
    .from('users')
    .select('id, email, full_name')
    .in('id', adminRoles.map(r => r.user_id))

  let sent = 0
  for (const admin of adminUsers || []) {
    if (!admin.email) continue

    const vars: Record<string, string> = {
      admin_name: admin.full_name || 'Admin',
      week_start: weekStart,
      tickets_closed: String(ticketsClosed || 0),
      tickets_active: String(ticketsActive || 0),
      make_ready_compliance: String(compliance),
      avg_close_days: avgCloseDays,
      unassigned_count: String(unassignedCount || 0),
      paused_count: String(pausedCount || 0),
      pm_not_responding: '0',
      pending_review: String(pendingReview || 0),
      on_time_count: String(onTimeCount),
      late_count: String(lateCount),
      compliance_color: complianceColor,
      dashboard_url: 'https://fiveserv.net/dashboard',
    }

    const subject = substituteVariables(template.subject || '', vars)
    const html = substituteVariables(template.body || '', vars)
    const messageId = crypto.randomUUID()

    // Get or create unsubscribe token for recipient
    const unsubscribeToken = await getOrCreateUnsubscribeToken(supabase, admin.email)

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'weekly_summary',
      recipient_email: admin.email,
      status: 'pending',
    })

    await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: admin.email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text: subject,
        purpose: 'transactional',
        label: 'weekly_summary',
        idempotency_key: `weekly-summary-${admin.id}-${weekStart}`,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    })
    sent++
  }

  return new Response(
    JSON.stringify({ success: true, sent }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})