

# 2FA Email Delivery — Root Cause Analysis

## What I Found

### The Flow
1. User logs in → Login.tsx detects admin role → redirects to `/verify-2fa`
2. `VerifyTwoFactor.tsx` calls `supabase.functions.invoke('send-2fa-code')`
3. Edge function generates a 6-digit code, stores it in `two_factor_codes`, then sends email via `sendLovableEmail()` from `@lovable.dev/email-js`
4. Email is sent directly (not through the queue) to the user's email

### Problem 1: The function uses an outdated email sending pattern

The `send-2fa-code` edge function imports `sendLovableEmail` from `@lovable.dev/email-js` — the **old direct-send pattern**. This bypasses the email queue (`pgmq`) entirely. The rest of the project's email infrastructure has been upgraded to use the queue-based pattern (`enqueue_email` RPC).

The old direct-send API has started rejecting requests. Historical logs in `email_send_log` from Apr 6 show this error:

```
Email API error: 400 {"type":"missing_parameter","message":"Missing run_id or idempotency_key",
"details":"Auth emails require run_id. App emails can omit run_id by providing idempotency_key 
with purpose=transactional."}
```

This means the `@lovable.dev/email-js` SDK call is failing because it's not passing the required parameters in the format the current API expects. After 5 retries, the email goes to DLQ (dead-letter queue) and is never delivered.

Some later attempts on Apr 6 show `status: sent` — but the edge function **logs "sent" optimistically** right after calling `sendLovableEmail()`, before confirming actual delivery. The function doesn't check the response from `sendLovableEmail()` for errors.

### Problem 2: Most recent attempt has no email log at all

The latest `two_factor_codes` entry (Apr 8, user `20824fa8...`) has **no matching record in `email_send_log`**. This means the edge function either:
- Was never invoked (frontend error), or
- Crashed before reaching the email send/log step (e.g., the user lookup or role check failed)

Since there are no edge function execution logs visible, I can't confirm which — but the code does have a `throw` before the email step if the user isn't found or isn't admin.

### Problem 3: The function is not in `config.toml`

The `send-2fa-code` function is **missing from `supabase/config.toml`**. Only `auth-email-hook`, `process-email-queue`, `send-business-email`, `send-weekly-summary`, and `invite-user` are listed. Without a config entry, the function may not have `verify_jwt = false` set, which could cause JWT verification failures when the frontend calls it.

### Problem 4: Optimistic logging

The function inserts `status: "sent"` into `email_send_log` immediately after calling `sendLovableEmail()`, regardless of whether the email was actually accepted by the API. This masks failures — the log shows "sent" even when the email was rejected.

## Summary of Root Causes

| Issue | Impact |
|-------|--------|
| Uses old `@lovable.dev/email-js` direct-send pattern | Email API rejects requests or silently fails |
| Missing from `config.toml` | Possible JWT verification failures blocking invocation |
| Optimistic "sent" logging | Masks delivery failures in logs |
| No error handling on `sendLovableEmail()` response | Function doesn't know when email fails |

## Recommended Fix

1. **Rewrite `send-2fa-code`** to use the queue-based pattern: call `supabase.rpc('enqueue_email', ...)` to enqueue to the `transactional_emails` pgmq queue instead of calling `sendLovableEmail()` directly
2. **Add `send-2fa-code` to `config.toml`** with `verify_jwt = false`
3. **Remove the optimistic log insert** — let `process-email-queue` handle logging when it processes the queued email
4. **Deploy the updated function** so the changes take effect

