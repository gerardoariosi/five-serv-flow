import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_NAME = "FiveServ Operations Hub";
const SENDER_DOMAIN = "notify.fiveserv.net";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // Get user profile
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("email, roles, is_locked")
      .eq("email", user.email)
      .single();

    if (userError || !userData) throw new Error("User not found");

    if (userData.is_locked) {
      return new Response(JSON.stringify({ success: false, error: "Account is locked. Contact your administrator." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const roles = userData.roles as string[];
    if (!roles.includes("admin")) {
      throw new Error("2FA is only required for admin users");
    }

    if (!userData.email) throw new Error("No email configured for this user");

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code in DB (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from("two_factor_codes").insert({
      user_id: user.id,
      code,
      expires_at: expiresAt,
    });

    // Send verification email via the email queue
    const messageId = crypto.randomUUID();
    const idempotencyKey = `2fa-${user.id}-${Date.now()}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 24px; font-weight: bold;">
            <span style="color: #FFD700;">F</span><span style="color: #1A1A1A;">iveServ</span>
          </span>
        </div>
        <h2 style="color: #1A1A1A; text-align: center; margin-bottom: 8px;">Verification Code</h2>
        <p style="color: #666666; text-align: center; margin-bottom: 24px;">
          Use this code to complete your login. It expires in 10 minutes.
        </p>
        <div style="background: #F5F5F5; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1A1A1A;">${code}</span>
        </div>
        <p style="color: #999999; font-size: 12px; text-align: center;">
          If you didn't request this code, please ignore this email and secure your account.
        </p>
      </div>
    `;

    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: "2fa_verification",
      recipient_email: userData.email,
      status: "pending",
      metadata: { sent_for: user.id },
    });

    const { data: existingToken } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", userData.email)
      .is("used_at", null)
      .maybeSingle();

    const unsubscribeToken = existingToken?.token ?? crypto.randomUUID();

    if (!existingToken?.token) {
      await supabase.from("email_unsubscribe_tokens").insert({
        email: userData.email,
        token: unsubscribeToken,
      });
    }

    await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: userData.email,
        from: `${SITE_NAME} <noreply@${SENDER_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: `${code} is your FiveServ verification code`,
        html,
        text: `Your FiveServ verification code is: ${code}. Valid for 10 minutes.`,
        purpose: "transactional",
        label: "2fa_verification",
        idempotency_key: idempotencyKey,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });

    return new Response(JSON.stringify({ success: true, email: userData.email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error sending 2FA code:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
