import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Verify caller
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const token = authHeader.slice('Bearer '.length).trim()
  const anon = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authError } = await anon.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { ticket_id: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!body.ticket_id) {
    return new Response(JSON.stringify({ error: 'ticket_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Load ticket + property name
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, fs_number, work_type, property_id, technician_id')
    .eq('id', body.ticket_id)
    .single()

  if (!ticket) {
    return new Response(JSON.stringify({ error: 'Ticket not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let propertyName = ''
  if (ticket.property_id) {
    const { data: prop } = await supabase
      .from('properties').select('name').eq('id', ticket.property_id).single()
    propertyName = prop?.name ?? ''
  }

  let technicianName = ''
  if (ticket.technician_id) {
    const { data: tech } = await supabase
      .from('users').select('full_name').eq('id', ticket.technician_id).single()
    technicianName = tech?.full_name ?? ''
  }

  // Fetch admin emails
  const { data: adminRoles } = await supabase
    .from('user_roles').select('user_id').eq('role', 'admin')
  const adminIds = (adminRoles ?? []).map(r => r.user_id)
  if (adminIds.length === 0) {
    return new Response(JSON.stringify({ success: true, sent: 0 }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: admins } = await supabase
    .from('users').select('email').in('id', adminIds)
  const emails = (admins ?? []).map(a => a.email).filter(Boolean) as string[]

  let sent = 0
  for (const to_email of emails) {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-business-email`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_name: 'ticket_ready_for_review',
        to_email,
        variables: {
          fs_number: ticket.fs_number ?? '',
          property_name: propertyName,
          work_type: ticket.work_type ?? '',
          technician_name: technicianName,
        },
      }),
    })
    if (res.ok) sent++
  }

  // Also send push notification to admins + supervisors (best-effort)
  let pushSent = 0
  try {
    const { data: pushRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'supervisor'])
    const pushUserIds = Array.from(
      new Set((pushRoles ?? []).map((r: any) => r.user_id).filter(Boolean))
    )
    if (pushUserIds.length > 0) {
      const pushRes = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_ids: pushUserIds,
          title: 'Ready for Review',
          body: `Ticket ${ticket.fs_number ?? ''} is ready for your review`.trim(),
          url: `/tickets/${ticket.id}`,
          tag: `review-${ticket.id}`,
        }),
      })
      if (pushRes.ok) {
        const pj = await pushRes.json().catch(() => ({}))
        pushSent = pj?.sent ?? 0
      }
    }
  } catch (err) {
    console.error('Push notification failed', err)
  }

  return new Response(JSON.stringify({ success: true, sent, pushSent }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
