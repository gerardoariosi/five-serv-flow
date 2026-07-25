# Vendor Payments — Edit & Delete per row

Add row-level Edit and Delete actions to every entry in the vendor payments list, without touching the existing Add Payment, Mark Paid, or balance-calculation flows.

## 1. Role gating (same as today)

Reuse the existing `canManagePayments` check in `VendorDetail.tsx` (`activeRole === 'admin' || activeRole === 'accounting'`). Edit and Delete controls only render when this is true. Technicians and supervisors see the list read-only, exactly as today.

RLS on `vendor_payments` already restricts UPDATE/DELETE to admin/accounting, so no policy changes are needed.

## 2. New component — `EditVendorPaymentDialog.tsx`

A single dialog handling both pending and paid entries:

- **Always editable**: `week_ending_date`, `due_date` (with the same lock/unlock behavior as Add), `amount`, `note`.
- **Only when `status === 'paid'`**: also show `paid_at` date and a proof-of-payment file input.
  - If a `proof_url` already exists, show a "View current proof" link + a "Replace" affordance.
  - If none exists, show "Attach proof of payment — optional" (same copy as MarkPaidDialog).
- **Status is never mutated** by this dialog — it's not a field. Pending stays pending, paid stays paid.
- Upload path for proof reuses the exact convention already in place: `vendor-documents/{vendorId}/proofs/{paymentId}-{ts}.{ext}` in the private `vendor-documents` bucket.
- On save: `UPDATE vendor_payments SET ... WHERE id = :paymentId`, then invalidate the `vendor_payments` query so Balance / Total Paid recompute from the fresh rows.

To avoid duplication, the shared form fields (week/due/amount/note with lock toggle) will be extracted from `AddVendorPaymentDialog` into a small `VendorPaymentFormFields` component consumed by both Add and Edit dialogs. No behavior change to Add.

## 3. Delete flow

- On click, show a confirmation (reuse `AlertDialog` from shadcn already used elsewhere in the app): "Delete this payment entry? This cannot be undone."
- On confirm: if the row has a `proof_url`, remove that object from the `vendor-documents` bucket first (best-effort, don't block on failure), then `DELETE FROM vendor_payments WHERE id = :paymentId`.
- Invalidate the `vendor_payments` query — Balance and Total Paid recompute automatically since they're derived from the row list.
- Toast on success/failure.

## 4. Row UI

Follow the app's existing row-actions convention (⋮ dropdown menu, same pattern as TicketList/ClientList):

- Replace the current inline "Mark Paid" button with a compact action cluster on the right side of each row:
  - Pending row (admin/accounting): `Mark Paid` button + `⋮` menu with **Edit**, **Delete**.
  - Paid row (admin/accounting): `⋮` menu with **Edit** (which is where proof can now be added after the fact), **Delete**.
  - Non-privileged roles: no menu, no buttons (unchanged from today).
- Icons: `Pencil` for Edit, `Trash2` for Delete (destructive styling on the menu item).

Layout stays on a single row on desktop and wraps as it does today on mobile — no structural change to the list.

## 5. Vendor Payables (Accounting tab)

The Vendor Payables tab currently lists **vendors with pending balances**, not individual payment rows, so there is nothing per-row to edit or delete there. No change. Edit/Delete are reached by clicking through to the vendor and using the payments list on `VendorDetail`.

## 6. Files touched

- **New**: `src/components/vendors/EditVendorPaymentDialog.tsx`
- **New (refactor extract)**: `src/components/vendors/VendorPaymentFormFields.tsx`
- **Edited**: `src/components/vendors/AddVendorPaymentDialog.tsx` — consume the extracted fields, no behavior change.
- **Edited**: `src/pages/team/VendorDetail.tsx` — add the ⋮ menu per row, wire Edit dialog + Delete confirm, invalidate queries.

No DB migration. No RLS change. No change to `MarkPaidDialog`, Add flow, balance math, or the Payables tab.

## Risks / flags

1. **Editing a paid entry's amount changes Total Paid retroactively.** Intended per the request, but there is no audit trail on `vendor_payments` beyond the existing global `audit_log` trigger (if attached). Worth confirming you're OK with silent retroactive edits — otherwise we'd add a "reason" field or an edit log, which is out of scope here.
2. **Deleting a paid entry with a proof file**: storage removal is best-effort. If the bucket delete fails (e.g. transient), the DB row still gets deleted and the file becomes orphaned. Acceptable tradeoff for simplicity; alternative is a two-phase delete that blocks on storage.
3. **Replacing a proof file**: the old file will be left in storage (new one uploaded to a new timestamped path). Same orphan tradeoff. Can add cleanup if you want it strict.
4. **Concurrent edits**: no optimistic locking. Last write wins. Same as everywhere else in the app today.
5. **Refactor of Add dialog**: extracting shared fields is low-risk but does touch the working Add flow. Will keep the extraction mechanical (props-in, values-out) so Add behavior is byte-identical.

Confirm and I'll implement.
