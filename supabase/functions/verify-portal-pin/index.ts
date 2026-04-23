import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

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

  let body: { token?: string; pin?: string; portal_type?: 'inspection' | 'estimate' }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { token, pin, portal_type = 'inspection' } = body
  if (!token || !pin) {
    return new Response(JSON.stringify({ error: 'token and pin are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Verify the token exists and is not expired
  let resourceFound = false
  if (portal_type === 'estimate') {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id')
      .eq('estimate_link_token', token)
      .gt('estimate_expires_at', new Date().toISOString())
      .maybeSingle()
    resourceFound = !!ticket
  } else {
    const { data: inspection } = await supabase
      .from('inspections')
      .select('id')
      .eq('pm_link_token', token)
      .gt('link_expires_at', new Date().toISOString())
      .maybeSingle()
    resourceFound = !!inspection
  }

  if (!resourceFound) {
    return new Response(JSON.stringify({ valid: false, reason: 'invalid_token' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Read the master PIN
  const { data: pinData } = await supabase
    .from('master_pin')
    .select('pin')
    .limit(1)
    .maybeSingle()

  if (!pinData) {
    return new Response(JSON.stringify({ valid: false, reason: 'no_pin_configured' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const valid = pinData.pin === pin

  return new Response(JSON.stringify({ valid }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
