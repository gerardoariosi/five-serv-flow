import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// A 2FA verification is considered valid for this many days on the current
// device. After the window elapses, the user must complete 2FA again before
// the app allows access to admin-only screens.
const TRUST_WINDOW_DAYS = 30

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const jwt = authHeader.slice('Bearer '.length).trim()
  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: userData, error: userError } = await anonClient.auth.getUser(jwt)
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Only admins are required to 2FA on this app. For any other role we return
  // { required: false } so the client can proceed without prompting.
  const { data: roleRows } = await supabase
    .from('user_roles').select('role').eq('user_id', userData.user.id)
  const roles = (roleRows ?? []).map((r: { role: string }) => r.role)
  if (!roles.includes('admin')) {
    return new Response(JSON.stringify({ required: false, verified: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Look for a recent, successful 2FA code within the trust window.
  const since = new Date(Date.now() - TRUST_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('two_factor_codes')
    .select('id, created_at, used')
    .eq('user_id', userData.user.id)
    .eq('used', true)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return new Response(
    JSON.stringify({ required: true, verified: !!recent }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
