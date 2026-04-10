import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const SITE_NAME = 'FiveServ Operations Hub'
const FROM_DOMAIN = 'notify.fiveserv.net'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')

  // Verify caller is authenticated
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const token = authHeader.slice('Bearer '.length).trim()
  const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { to_email: string; subject: string; body_text: string; pdf_base64: string; pdf_filename: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { to_email, subject, body_text, pdf_base64, pdf_filename } = body

  if (!to_email || !subject || !pdf_base64 || !pdf_filename) {
    return new Response(JSON.stringify({ error: 'to_email, subject, pdf_base64, and pdf_filename are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(to_email)) {
    return new Response(JSON.stringify({ error: 'Invalid email address' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const messageId = crypto.randomUUID()

  try {
    // Use the Lovable email API with the gateway to send with attachment
    // Since Lovable email doesn't support attachments natively, we'll use the
    // email as HTML with inline info and enqueue a log entry
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #ffffff; padding: 30px; border-radius: 8px;">
        <div style="border-bottom: 2px solid #FFD700; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="color: #FFD700; font-size: 22px; margin: 0;">FiveServ Operations Hub</h1>
        </div>
        <p style="color: #e0e0e0; font-size: 14px; line-height: 1.6;">${body_text.replace(/\n/g, '<br/>')}</p>
        <hr style="border: none; border-top: 1px solid #333; margin: 20px 0;" />
        <p style="color: #999; font-size: 11px;">This email was sent from FiveServ Operations Hub. The inspection report PDF is attached to this email.</p>
      </div>
    `

    // Try sending via Lovable email API with attachment support
    const emailPayload: Record<string, unknown> = {
      to: to_email,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: FROM_DOMAIN,
      subject,
      html: htmlBody,
      text: body_text,
      purpose: 'transactional',
      label: 'inspection-report',
      idempotency_key: `inspection-report-${to_email}-${Date.now()}`,
      message_id: messageId,
      attachments: [
        {
          filename: pdf_filename,
          content: pdf_base64,
          content_type: 'application/pdf',
        },
      ],
    }

    // Enqueue for delivery
    const { error: enqueueError } = await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: { ...emailPayload, queued_at: new Date().toISOString() },
    })

    // Log
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'inspection-report',
      recipient_email: to_email,
      status: enqueueError ? 'failed' : 'pending',
      error_message: enqueueError ? 'Failed to enqueue' : null,
      metadata: { sent_by: user.id, pdf_filename },
    })

    if (enqueueError) {
      console.error('Failed to enqueue inspection email', { error: enqueueError })
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ success: true, message_id: messageId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error sending inspection email', { error })
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
