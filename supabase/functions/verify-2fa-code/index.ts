import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string" || code.length !== 6) {
      return new Response(JSON.stringify({ success: false, error: "Invalid code format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // Check if account is locked
    const { data: userData } = await supabase
      .from("users")
      .select("is_locked")
      .eq("email", user.email)
      .single();

    if (userData?.is_locked) {
      return new Response(JSON.stringify({ success: false, error: "Account is locked. Contact your administrator." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find valid code
    const { data: codeRecord, error: codeError } = await supabase
      .from("two_factor_codes")
      .select("*")
      .eq("user_id", user.id)
      .eq("code", code)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (codeError) throw new Error("Database error");

    if (!codeRecord) {
      // Increment attempts on the latest code
      const { data: latestCode } = await supabase
        .from("two_factor_codes")
        .select("id, attempts")
        .eq("user_id", user.id)
        .eq("used", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestCode) {
        const newAttempts = (latestCode.attempts ?? 0) + 1;
        await supabase
          .from("two_factor_codes")
          .update({ attempts: newAttempts })
          .eq("id", latestCode.id);

        // Lock account after 3 failed attempts
        if (newAttempts >= 3) {
          await supabase
            .from("users")
            .update({ is_locked: true })
            .eq("email", user.email);

          return new Response(JSON.stringify({ 
            success: false, 
            error: "Too many failed attempts. Account has been locked.",
            locked: true 
          }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ success: false, error: "Invalid or expired code" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check attempts on the matched code
    if ((codeRecord.attempts ?? 0) >= 3) {
      // Lock account
      await supabase
        .from("users")
        .update({ is_locked: true })
        .eq("email", user.email);

      return new Response(JSON.stringify({ 
        success: false, 
        error: "Too many attempts. Account has been locked.",
        locked: true 
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark code as used
    await supabase
      .from("two_factor_codes")
      .update({ used: true })
      .eq("id", codeRecord.id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error verifying 2FA code:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
