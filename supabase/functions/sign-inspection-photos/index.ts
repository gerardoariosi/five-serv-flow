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
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { token?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { token } = body
  if (!token || typeof token !== 'string') {
    return new Response(JSON.stringify({ error: 'token is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Validate token
  const { data: inspection } = await supabase
    .from('inspections')
    .select('id, link_expires_at')
    .eq('pm_link_token', token)
    .maybeSingle()

  if (!inspection) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (inspection.link_expires_at && new Date(inspection.link_expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: 'Link expired' }), {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: photos } = await supabase
    .from('inspection_photos')
    .select('id, area, url, uploaded_at')
    .eq('inspection_id', inspection.id)
    .order('uploaded_at', { ascending: true })

  const out: Array<{ id: string; area: string; url: string; uploaded_at: string }> = []
  for (const p of photos ?? []) {
    if (!p.url) continue
    if (p.url.startsWith('http')) {
      out.push({ id: p.id, area: p.area, url: p.url, uploaded_at: p.uploaded_at })
      continue
    }
    const { data: signed } = await supabase.storage
      .from('inspection-photos')
      .createSignedUrl(p.url, 3600)
    if (signed?.signedUrl) {
      out.push({ id: p.id, area: p.area, url: signed.signedUrl, uploaded_at: p.uploaded_at })
    }
  }

  return new Response(JSON.stringify({ photos: out }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
