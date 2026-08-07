import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

/**
 * Verifies the shared portal PIN and, on success, returns all data the PM/Estimate
 * portal needs. The PIN check runs server-side BEFORE any record is disclosed, so
 * possession of a public link alone is not enough to read inspection/ticket PII.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: {
    token?: string
    pin?: string
    portal_type?: 'inspection' | 'estimate'
    action?: 'load' | 'submit'
    payload?: Record<string, unknown>
  }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { token, pin, portal_type = 'inspection', action = 'load', payload = {} } = body
  if (!token || !pin || typeof token !== 'string' || typeof pin !== 'string') {
    return new Response(JSON.stringify({ error: 'token and pin are required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (action !== 'load' && action !== 'submit') {
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }


  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Read master PIN first — cheap, and lets us fail closed if unset.
  const { data: pinData } = await supabase.from('master_pin').select('pin').limit(1).maybeSingle()
  if (!pinData) {
    return new Response(JSON.stringify({ valid: false, reason: 'no_pin_configured' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (pinData.pin !== pin) {
    return new Response(JSON.stringify({ valid: false, reason: 'invalid_pin' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // PIN is correct — now look up the resource by token.
  if (portal_type === 'estimate') {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('*')
      .eq('estimate_link_token', token)
      .maybeSingle()
    if (!ticket) {
      return new Response(JSON.stringify({ valid: false, reason: 'invalid_token' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (ticket.estimate_expires_at && new Date(ticket.estimate_expires_at) < new Date()) {
      return new Response(JSON.stringify({ valid: false, reason: 'expired' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let property: { name: string | null; address: string | null } | null = null
    if (ticket.property_id) {
      const { data: p } = await supabase
        .from('properties').select('name, address').eq('id', ticket.property_id).maybeSingle()
      property = p ?? null
    }
    const { data: options } = await supabase
      .from('ticket_estimate_options').select('*').eq('ticket_id', ticket.id).order('sort_order', { ascending: true })
    const { data: photos } = await supabase
      .from('ticket_photos').select('*').eq('ticket_id', ticket.id).eq('stage', 'evaluation').order('uploaded_at', { ascending: true })

    await supabase.from('tickets')
      .update({ estimate_link_opened_count: (ticket.estimate_link_opened_count ?? 0) + 1 })
      .eq('id', ticket.id)

    return new Response(
      JSON.stringify({ valid: true, ticket, property, options: options ?? [], photos: photos ?? [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Inspection portal
  const { data: inspection } = await supabase
    .from('inspections').select('*').eq('pm_link_token', token).maybeSingle()
  if (!inspection) {
    return new Response(JSON.stringify({ valid: false, reason: 'invalid_token' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (inspection.link_expires_at && new Date(inspection.link_expires_at) < new Date()) {
    return new Response(JSON.stringify({ valid: false, reason: 'expired' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let property: { name: string | null; address: string | null } | null = null
  if (inspection.property_id) {
    const { data: p } = await supabase
      .from('properties').select('name, address').eq('id', inspection.property_id).maybeSingle()
    property = p ?? null
  }
  const { data: items } = await supabase
    .from('inspection_items').select('*')
    .eq('inspection_id', inspection.id)
    .in('status', ['needs_repair', 'urgent'])
    .order('status', { ascending: true })

  await supabase.from('inspections')
    .update({ link_opened_count: (inspection.link_opened_count ?? 0) + 1 })
    .eq('id', inspection.id)

  return new Response(
    JSON.stringify({ valid: true, inspection, property, items: items ?? [] }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
