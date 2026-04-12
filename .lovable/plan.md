

# Analysis: "Send to PM" Email Flow

## Step-by-step trace of `handleSendToPM` in `PricingReview.tsx`

### Step 1: Token generation — WORKING
Lines 95-97: Generates a UUID token, 60-day expiry, and portal URL. This logic is correct.

### Step 2: Client email fetch — FAILS ON SOME INSPECTIONS
Lines 81-85: Fetches `email` from `clients` where `id = inspection.client_id`.

**Problem found**: The most recent inspection (`INS-2026-0006`) has `client_id: NULL`. When `client_id` is null, the query `supabase.from('clients').select().eq('id', null).single()` returns no data. The code handles this on line 130 with a warning toast ("no PM email found"), but the user sees this as a failure.

For inspections that DO have a `client_id` (e.g., `INS-2026-0005` with client_id pointing to `iragorrymariel44@gmail.com`), the fetch would succeed.

### Step 3: Email function call — CORRECT
Lines 107-122: Calls `supabase.functions.invoke('send-transactional-email')` with:
- `templateName: 'pm-inspection-link'` — registered in registry.ts ✓
- `recipientEmail: client.email` — correct field ✓
- `idempotencyKey: pm-inspection-${id}-${token}` — unique ✓
- `templateData` with all required fields ✓

### Step 4: Edge function deployment — WORKING
I tested the function directly with curl — it returned `{"queued":true,"success":true}` with status 200. The function is deployed and active.

### Step 5: Edge function logs — NO PM EMAILS EVER SENT
The `email_send_log` table has zero entries for template `pm-inspection-link`. Every logged email is for `inspection-report` template. This means the "Send to PM" button either:
- Never reached the email call (because `client_id` was null), or
- The `supabase.functions.invoke` call failed with a network/auth error that was caught by the try/catch on line 135 and shown as a generic "Failed to send to PM" toast

### Step 6: Resend / API keys — NOT RELEVANT
The app uses Lovable's built-in email infrastructure (domain: `notify.fiveserv.net`), not Resend. No `RESEND_API_KEY` is needed. The `SENDER_DOMAIN` is correctly set to `notify.fiveserv.net`.

### Step 7: Verified sender domain — WORKING
The domain `notify.fiveserv.net` is configured and active. The most recent `inspection-report` email on Apr 12 shows `status: sent` — proving the email infra works.

---

## Root cause

The email system itself is functional — the edge function is deployed, the template is registered, and Lovable's email infra is sending successfully.

**The failure is at the data level**: inspections can have a `null` `client_id`, which causes the client email lookup to return nothing. When `client?.email` is falsy (line 106), the code skips the email send entirely and shows a warning toast.

For inspections with a valid `client_id`, the flow should work end-to-end. However, since there are ZERO `pm-inspection-link` entries in `email_send_log`, it's possible that every "Send to PM" attempt so far was either on an inspection with null `client_id`, or the `supabase.functions.invoke` call failed due to the user not being authenticated (the function requires JWT auth via `verify_jwt = true`).

**Two issues to fix:**

1. **Null `client_id`**: The pricing review screen should validate that a client is associated with the inspection before allowing "Send to PM". If `client_id` is null, show a clear message like "No client assigned — please add a client before sending."

2. **No feedback on actual failure**: The try/catch on line 135 shows a generic "Failed to send to PM" toast. The `emailError` on line 124 logs to console but the user may not see it. Better error messages would help diagnose future issues.

## Files to change

1. `src/pages/inspections/PricingReview.tsx` — Add client validation before enabling "Send to PM", improve error messaging

