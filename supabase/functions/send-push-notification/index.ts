// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@fiveserv.net'
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    // Service-role client — bypasses RLS to resolve roles and write notifications.
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    const body = await req.json().catch(() => ({}))
    const {
      user_id,
      user_ids,
      roles,
      title,
      body: msgBody,
      url,
      tag,
      skip_in_app,
      portal_token,
      portalToken,
    } = body || {}

    // ---- Authorization ----
    // Accept: (1) service-role bearer, (2) authenticated staff user (has any
    // user_roles row), or (3) a valid unexpired portal token (pm_link_token on
    // inspections or estimate_link_token on tickets) — restricted to notifying
    // admin/supervisor roles only.
    const authHeader = req.headers.get('Authorization') || ''
    const bearer = authHeader.replace(/^Bearer\s+/i, '')
    let isAuthorized = false
    let portalMode = false

    if (bearer && bearer === SERVICE_KEY) {
      isAuthorized = true
    } else if (bearer) {
      const authClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      })
      const { data: userData } = await authClient.auth.getUser()
      if (userData?.user) {
        const { data: rr } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userData.user.id)
          .limit(1)
        if (rr && rr.length > 0) isAuthorized = true
      }
    }

    if (!isAuthorized) {
      const pt = portal_token || portalToken
      if (pt && typeof pt === 'string') {
        const now = new Date().toISOString()
        const { data: insp } = await supabase
          .from('inspections')
          .select('id')
          .eq('pm_link_token', pt)
          .gt('link_expires_at', now)
          .maybeSingle()
        const { data: tk } = insp
          ? { data: null }
          : await supabase
              .from('tickets')
              .select('id')
              .eq('estimate_link_token', pt)
              .gt('estimate_expires_at', now)
              .maybeSingle()
        if (insp || tk) {
          isAuthorized = true
          portalMode = true
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!title) {
      return new Response(JSON.stringify({ error: 'title required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve target user IDs
    let targetIds: string[] = []
    if (Array.isArray(user_ids)) targetIds.push(...user_ids)
    if (user_id) targetIds.push(user_id)

    // Portal-mode callers may only notify admin/supervisor role groups and may
    // not directly target arbitrary user_ids.
    let effectiveRoles: string[] | null = Array.isArray(roles) ? roles : null
    if (portalMode) {
      targetIds = []
      effectiveRoles = (effectiveRoles || []).filter((r) => r === 'admin' || r === 'supervisor')
      if (effectiveRoles.length === 0) effectiveRoles = ['admin', 'supervisor']
    }

    if (effectiveRoles && effectiveRoles.length > 0) {
      const { data: roleRows, error: roleErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', effectiveRoles)
      if (roleErr) {
        console.error('Failed to resolve roles', roleErr)
      } else {
        targetIds.push(...(roleRows ?? []).map((r: any) => r.user_id).filter(Boolean))
      }
    }

    targetIds = Array.from(new Set(targetIds.filter(Boolean)))

    if (targetIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No recipients' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Insert in-app notifications (server-side bypass of RLS).
    let inAppInserted = 0
    if (!skip_in_app) {
      const rows = targetIds.map((uid) => ({
        user_id: uid,
        type: 'push',
        title,
        message: msgBody || '',
        link: url || null,
      }))
      const { error: notifErr, count } = await supabase
        .from('notifications')
        .insert(rows, { count: 'exact' })
      if (notifErr) {
        console.error('Failed to insert in-app notifications', notifErr)
      } else {
        inAppInserted = count ?? rows.length
      }
    }

    // Load push subscriptions for those users
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', targetIds)

    if (error) throw error

    const payload = JSON.stringify({
      title,
      body: msgBody || '',
      url: url || '/',
      tag: tag || undefined,
    })

    let sent = 0
    let failed = 0
    const expiredIds: string[] = []

    if (subs && subs.length > 0) {
      await Promise.all(
        subs.map(async (s: any) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload
            )
            sent++
          } catch (err: any) {
            failed++
            const status = err?.statusCode
            if (status === 404 || status === 410) expiredIds.push(s.id)
            console.error('Push send failed', { status, message: err?.message })
          }
        })
      )

      if (expiredIds.length > 0) {
        await supabase.from('push_subscriptions').delete().in('id', expiredIds)
      }
    }

    return new Response(
      JSON.stringify({
        sent,
        failed,
        expired: expiredIds.length,
        in_app: inAppInserted,
        targets: targetIds.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: any) {
    console.error('send-push-notification error', err)
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
