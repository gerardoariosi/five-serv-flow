

# Analysis: 4 Issues in FiveServ App

## Issue 1: ALL EMAILS ARE FAILING

**Verdict: The transactional email system IS working. Auth emails (2fa, invite) are sending successfully.**

The `email_send_log` shows multiple emails with status `sent` — including `2fa_verification` and `invite` templates. These go through the same queue infrastructure (`process-email-queue`).

The `send-transactional-email` function has no invocation logs in the edge function analytics, which means **it has never been called yet**. The `pm-inspection-link` template is registered in `registry.ts` and the code in `PricingReview.tsx` calls `supabase.functions.invoke('send-transactional-email', ...)` correctly.

**Root cause**: The email infrastructure works. The issue is likely that:
1. No inspection has been sent to PM yet (the function was never invoked), OR
2. The `send-transactional-email` edge function was never deployed. The function file exists but may not have been deployed to the runtime.

**Fix**: Deploy `send-transactional-email` (and related functions) using `deploy_edge_functions`. Then test by sending an inspection to a PM with a valid email.

---

## Issue 2: INSPECTION NOTES NOT SHOWING IN FIVESERV VIEW

**Root cause**: `AreaInspection.tsx` saves the per-area note into the `pm_note` column on ALL items in that area (line 135: `pm_note: notes[currentArea.key] || null`). This is a **naming collision** — `pm_note` is also used by the PM portal for PM-specific notes per item.

But the real display problem is in `InspectionDetail.tsx`: the FiveServ View tab (lines 317-350) renders items and photos grouped by area, but **there is zero code to display notes**. The notes are stored in `pm_note` on items, but the detail view never reads or renders them.

**Fix**:
1. Add a dedicated `note` column to `inspection_items` for FiveServ technician notes (separate from `pm_note` which is the PM's note).
2. Update `AreaInspection.tsx` to save to `note` instead of `pm_note`.
3. Update `InspectionDetail.tsx` FiveServ View to render the note per area.

---

## Issue 3: PM PORTAL MISSING NOTES AND PHOTOS

**Root cause**: `PMPortal.tsx` fetches only `inspection_items` (line 64-68). It **never fetches `inspection_photos`** and never fetches any notes. The portal shows items with prices, checkboxes, and PM note fields — but no existing technician notes or photos.

- **Photos**: No query to `inspection_photos` exists in `PMPortal.tsx`. No signed URL generation. No photo rendering in the portal UI.
- **Notes**: The technician's area notes are stored in `pm_note` on items (naming collision from Issue 2), but the portal doesn't display them either — it only shows PM input fields.

**Fix**:
1. Add a fetch for `inspection_photos` by `inspection_id` in `PMPortal.tsx`.
2. Generate signed URLs for each photo (the bucket is private).
3. Display photos grouped by area alongside the items.
4. Display the technician's notes (from the new `note` column) as read-only text per area.
5. Ensure anon SELECT on `inspection_photos` is allowed (currently it's not — only authenticated users can view). Need an RLS policy for anon SELECT with token validation.

---

## Issue 4: ADMIN NOT NOTIFIED WHEN PM SUBMITS

**Root cause**: `PMPortal.tsx` `handleSubmit` (lines 130-156) updates `inspection_items` and the `inspections` row, then shows a success toast. **There is no code to notify the admin.** No email call, no in-app notification trigger, nothing.

**Fix**:
1. After the PM submit succeeds, call `send-transactional-email` with a new template (e.g., `pm-response-received`) to notify the admin.
2. Create the `pm-response-received` email template.
3. Register it in `registry.ts`.
4. The recipient should be the company admin email (from `company_profile.contact_email` or a similar source). Since this is a public/anon route, the call must go through an edge function or the admin email must be determinable without auth.

---

## Summary of Fixes

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | Emails failing | Edge function not deployed | Deploy `send-transactional-email` |
| 2 | Notes missing in FiveServ view | No render code + `pm_note` naming collision | Add `note` column, update save/display |
| 3 | PM portal missing photos/notes | No fetch for `inspection_photos`, no anon RLS | Add photo fetch, signed URLs, anon RLS, display |
| 4 | No admin notification on PM submit | No notification code exists | Add email template + trigger after submit |

## Files to Change

- **Database migration**: Add `note` column to `inspection_items`, add anon SELECT policy on `inspection_photos`
- `src/pages/inspections/AreaInspection.tsx` — save to `note` instead of `pm_note`
- `src/pages/inspections/InspectionDetail.tsx` — render notes per area
- `src/pages/inspections/PMPortal.tsx` — fetch/display photos and notes; add admin notification call
- `supabase/functions/_shared/transactional-email-templates/pm-response-received.tsx` — new template
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — register new template
- Deploy edge functions

