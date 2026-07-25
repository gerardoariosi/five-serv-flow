# Split Vendor page into View + Edit (Clients/Properties pattern)

## Goal
Mirror the existing Clients/Properties pattern:
- `VendorDetail.tsx` = read-only view + Documents + Payments.
- `VendorForm.tsx` = editable fields only, at `/team/vendors/:id/edit` and `/team/vendors/new`.

## Current state (verified)
- `App.tsx` routes: `/team/vendors/new` and `/team/vendors/:id` both point to `VendorDetail`. No `/edit` route yet.
- Links to the vendor page currently exist in:
  - `TechnicianList.tsx` (card body click + "View / Edit" menu item).
  - `accounting/VendorPayablesTab.tsx` (row click).
- Clients pattern is: `/clients/new` → `ClientForm`, `/clients/:id` → `ClientDetail`, `/clients/:id/edit` → `ClientForm`.

## Steps

### 1. Create `src/pages/team/VendorForm.tsx` (edit-only page)
- Route params: `id` (undefined = new).
- Fields (identical to today): company name (required), contact name, phone, email, license #, license expiration, insurance info, insurance expiration, notes, status, specialties multi-select.
- Same validation as today (company name required).
- Loads existing vendor when `id` present; empty state when creating.
- Save:
  - New → insert, then `navigate(/team/vendors/{newId})`.
  - Edit → update, then `navigate(/team/vendors/{id})`.
- Cancel returns to `/team/vendors/{id}` when editing, `/team/vendors` (list) when new.
- No Documents, no Payments, no expiration alert badges.

### 2. Rewrite `src/pages/team/VendorDetail.tsx` (read-only view)
- Remove all form `<Input>`/`<Select>` fields for the vendor info block.
- Render info as plain text/badges: company name, contact, phone (tel: link), email (mailto:), license #, license expiration, insurance info, insurance expiration, status badge, specialties as badges, notes.
- Keep the license/insurance expiration alert banner at the top exactly as-is.
- Keep Documents section unchanged (upload/download/delete W-9, insurance, contract, other).
- Keep Payments section unchanged (Balance / Total Paid, list, Add Payment, Mark Paid).
- Add "Edit" button in the header (icon + label), same placement/style as `ClientDetail.tsx` — navigates to `/team/vendors/{id}/edit`. Gate to admin only, same rule used today for editing vendors.
- Remove the always-visible Save button and any dirty-state tracking — no longer applies.

### 3. Update `src/App.tsx`
- Change `/team/vendors/new` → `VendorForm` (instead of `VendorDetail`).
- Keep `/team/vendors/:id` → `VendorDetail`.
- Add `/team/vendors/:id/edit` → `VendorForm`.

### 4. Update call sites
- `TechnicianList.tsx`: both existing links already point to `/team/vendors/{id}` (view page) — no change needed; "View / Edit" menu item label can stay since Edit is one click away from the view.
- `accounting/VendorPayablesTab.tsx`: already navigates to the view page — no change.
- "New Vendor" button in `TechnicianList.tsx` still points to `/team/vendors/new`, which now correctly opens the form.

## Risks / flags
- **Route conflict**: `/team/vendors/new` must be declared before `/team/vendors/:id` so `:id` doesn't swallow `new`. Both already exist in App.tsx in that order — preserve it.
- **Redirect after create**: today, creating a new vendor stays on the page. New behavior redirects to the view. Confirm this is desired (plan assumes yes — matches Clients/Properties).
- **Admin-only Edit gate**: today anyone with `canEdit` in `VendorDetail` can save. Confirm the Edit button should follow the same role rule (admin) — plan reuses whatever role check `VendorDetail` currently applies for edits so behavior does not tighten or loosen accidentally.
- **Documents / Payments untouched**: they move file location (into the new view) but their queries, mutations, dialogs, and role gates stay byte-identical. No functional changes.
- **No effect on Clients, Properties, or other pages** — scope strictly limited to Vendor.

## Deliverables
- New file: `src/pages/team/VendorForm.tsx`.
- Rewritten: `src/pages/team/VendorDetail.tsx` (view-only + Docs + Payments).
- Updated: `src/App.tsx` (3 route lines).
- No DB migration, no changes to `TechnicianList.tsx` or `VendorPayablesTab.tsx`.
