import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const SITE_NAME = 'FiveServ Operations Hub'
const SENDER_DOMAIN = 'notify.fiveserv.net'
const FROM_DOMAIN = 'notify.fiveserv.net'

function substituteVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match
  })
}

async function getOrCreateUnsubscribeToken(
  supabase: ReturnType<typeof createClient>,
  email: string
): Promise<string> {
  // Check for existing token
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', email)
    .is('used_at', null)
    .maybeSingle()

  if (existing?.token) return existing.token

  // Create new token
  const token = crypto.randomUUID()
  await supabase.from('email_unsubscribe_tokens').insert({ email, token })
  return token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Verify caller is authenticated
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Verify the calling user's JWT
  const token = authHeader.slice('Bearer '.length).trim()
  const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { template_name: string; to_email: string; variables: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { template_name, to_email, variables } = body

  if (!template_name || !to_email) {
    return new Response(JSON.stringify({ error: 'template_name and to_email are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Load template from DB
  const { data: template, error: templateError } = await supabase
    .from('email_templates')
    .select('subject, body')
    .eq('template_key', template_name)
    .single()

  if (templateError || !template) {
    return new Response(JSON.stringify({ error: `Template "${template_name}" not found` }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const vars = variables || {}
  const subject = substituteVariables(template.subject || '', vars)
  const html = substituteVariables(template.body || '', vars)

  const messageId = crypto.randomUUID()
  const idempotencyKey = `${template_name}-${to_email}-${Date.now()}`

  // Get or create unsubscribe token for recipient
  const unsubscribeToken = await getOrCreateUnsubscribeToken(supabase, to_email)

  // Log pending
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name,
    recipient_email: to_email,
    status: 'pending',
    metadata: { variables: vars, sent_by: user.id },
  })

  // Enqueue for async delivery via process-email-queue
  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: to_email,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text: subject, // plain text fallback
      purpose: 'transactional',
      label: template_name,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue business email', { error: enqueueError, template_name })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name,
      recipient_email: to_email,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({ success: true, message_id: messageId }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})