import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is an admin
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check caller is admin
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Only admins can invite users" }), { status: 403, headers: corsHeaders });
    }

    const { email, full_name, phone, roles, specialties } = await req.json();

    if (!email || !full_name || !roles?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
    }

    // Check if auth user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingAuth = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    let authUserId: string;

    if (existingAuth) {
      authUserId = existingAuth.id;
    } else {
      // Create auth user with invite (sends invite email automatically)
      const siteUrl = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/[^/]*$/, "") || "https://five-serv-flow.lovable.app";

      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email.toLowerCase(), {
        redirectTo: `${siteUrl}/reset-password`,
        data: { full_name },
      });

      if (inviteError) {
        return new Response(JSON.stringify({ error: inviteError.message }), { status: 400, headers: corsHeaders });
      }

      authUserId = inviteData.user.id;
    }

    // Upsert users record with the auth user id
    const { error: userError } = await adminClient.from("users").upsert({
      id: authUserId,
      full_name,
      email: email.toLowerCase(),
      phone: phone || null,
      roles,
    }, { onConflict: "id" });

    if (userError) {
      return new Response(JSON.stringify({ error: userError.message }), { status: 400, headers: corsHeaders });
    }

    // Insert roles into user_roles
    await adminClient.from("user_roles").delete().eq("user_id", authUserId);
    const roleInserts = roles.map((role: string) => ({ user_id: authUserId, role }));
    const { error: roleError } = await adminClient.from("user_roles").insert(roleInserts);
    if (roleError) {
      console.error("Role insert error:", roleError);
    }

    // If technician role, create technicians_vendors record
    if (roles.includes("technician")) {
      const { data: existing } = await adminClient.from("technicians_vendors")
        .select("id").eq("user_id", authUserId).eq("type", "technician").maybeSingle();

      if (!existing) {
        await adminClient.from("technicians_vendors").insert({
          contact_name: full_name,
          email: email.toLowerCase(),
          phone: phone || null,
          specialties: specialties || [],
          type: "technician",
          user_id: authUserId,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, user_id: authUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("invite-user error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
