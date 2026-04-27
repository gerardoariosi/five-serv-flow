# Analysis & Implementation Plan

## CRITICAL BUGS

### 1. Client form — address field missing for residential clients
**File:** `src/pages/clients/ClientForm.tsx`
**Finding:** ClientForm has no address field at all — only company_name, contact_name, email, phone, type. The `clients` table also has no address column. Residential clients need an address (their own home), distinct from `properties.address`.
**Fix:**
- Migration: add `address text` column to `clients` table.
- Add Address input to ClientForm, conditionally rendered when `form.type === 'residential'` (or always shown but labeled "Service Address" for residential).
- Save to clients.address on insert/update.

### 2. Desktop PWA icon not showing
**Files:** `public/manifest.json`, `index.html`
**Finding:** manifest.json declares only one icon (`/FiveServ_Logo_2_No_BG.png`) with `sizes: "any"` and `sizes: "512x512"`. Chrome desktop install requires standard PNG sizes (192x192 and 512x512) with `purpose: "any"` separately from `maskable`. Also, `index.html` `<link rel="icon">` points to `/logo.png`, not the FiveServ logo.
**Fix:**
- In `public/manifest.json`, declare 3 icon entries: 192x192 (any), 512x512 (any), 512x512 (maskable) — all pointing to `/FiveServ_Logo_2_No_BG.png`.
- In `index.html`, change `<link rel="icon">` and `<link rel="apple-touch-icon">` to use `/FiveServ_Logo_2_No_BG.png`.

### 3. Password reset — users can't set new password
**Files:** `src/hooks/useAuth.ts`, `src/pages/ResetPassword.tsx`, Supabase auth URL config
**Finding:** `resetPasswordForEmail` uses `redirectTo: ${window.location.origin}/reset-password`. ResetPassword.tsx checks `window.location.hash` for `type=recovery`. Two likely failure modes:
- Supabase recovery emails now use `?code=` (PKCE) instead of `#access_token=...`. The hash check fails, so `tokenValid` falls back to `getSession()` which is null → "Link Expired" shown.
- Auth `Site URL` / redirect allow-list in Supabase doesn't include the published domain.
**Fix:**
- Update ResetPassword.tsx to also handle `?code=` query param: call `supabase.auth.exchangeCodeForSession(code)` then mark token valid.
- Verify Supabase Auth `Site URL` and `Additional Redirect URLs` include both preview and published domains (config check, not code).

### 4. App name everywhere
**Files:** `index.html`, `public/manifest.json`
**Finding:** `index.html` `<title>` = "FiveServ Operations" ✓; OG title = "FiveServ" ✗; manifest `name` = "FiveServ Operations Hub" ✗; `short_name` = "FiveServ".
**Fix:**
- `manifest.json`: `name` → "FiveServ Operations", keep `short_name: "FiveServ"`.
- `index.html`: og:title, twitter:title, application-name → "FiveServ Operations".

### 5. "Error saving the ticket"
**File:** `src/pages/tickets/TicketForm.tsx` (line 325)
**Finding:** The catch block discards the error: `} catch { toast.error('Error saving ticket'); }`. The actual cause is hidden. Most likely culprits in the payload (lines 245-255):
- `appointment_time` empty string passed as null ✓ — fine.
- `related_inspection_id: form.related_inspection_id || null` ✓.
- The insert spreads `...form` which includes `quote_reference` — but the `tickets` table has no listed audit failures here.
- Most suspicious: when `draftId.current` exists from auto-save and a non-draft submit happens, `payload.fs_number` is NOT set (only set in the else-branch line 272). The auto-saved draft already has fs_number, so update is fine. BUT — RLS policy "Admins and supervisors can create tickets" blocks INSERT for technicians; if a non-admin/supervisor user tries to create, the insert silently fails.
- Also: auto-save inserts draft as `status='draft'` then the submit tries to insert again because `draftId.current` only persists in ref — if user navigated, ref is empty → duplicate `fs_number` collision.
**Fix:**
- Replace `catch {}` with `catch (err: any) { toast.error(err.message || 'Error saving ticket'); console.error(err); }` to surface the real error.
- Ensure `appointment_time` empty string converts to `null` (already done) and ISO format on submit.
- After fixing the catch, re-test to identify the actual DB error and patch.

## DESIGN CHANGES

### 6. Reports page — title color
**File:** `src/pages/reports/ReportList.tsx` line 35
**Fix:** Change `text-primary` → `text-foreground font-bold` on the report title `<p>`. Keep gold for the icon (line 32) and icon background.

### 7. Role badge — dark background, white text
**Files:** `src/components/layout/TopNav.tsx` (lines 20-25), `src/components/layout/DrawerMenu.tsx` (lines 19-24)
**Fix:** Replace per-role gold/colored backgrounds with uniform dark style:
- `bg-foreground text-background` (auto-inverts in dark/light mode), OR
- `bg-[#1A1A1A] text-white` for explicit dark.
Apply same change in both TopNav `roleBadgeStyles` and DrawerMenu `roleBadgeStyles`.

### 8. Chat — sender names + entity tags
**File:** `src/pages/chat/ChatPage.tsx`
**Fix:**
- Line 436: sender name `text-primary` → `text-foreground`.
- Line 348: entity tag pill `text-primary font-medium` → `bg-blue-500 text-white px-1.5 py-0.5 rounded text-xs font-medium`.

### 9. Prices — gold to black, totals green
**Scope:** App-wide audit of price display.
**Files:** `src/pages/tickets/TicketDetail.tsx`, `EstimatePortal.tsx`, `PMPortal.tsx`, `PricingReview.tsx`, `accounting/AccountingDetail.tsx`, `AccountingList.tsx`, `inspections/InspectionDetail.tsx`, `tickets/TicketReview.tsx`, `lib/inspectionPdf.ts`, `lib/ticketPdf.ts`, `lib/reportPdf.ts`.
**Fix:**
- Find all `text-primary` (or `#FFD700`) classes on price/`$` values → change to `text-foreground`.
- Identify "grand total" / "pre-approved total" lines → change to `text-[#22c55e]` (green-500).
- In PDF helpers (`inspectionPdf.ts`, `reportPdf.ts`), set price text color to `#000000` for PM-facing PDFs regardless of theme.

## FEATURES

### 10. Property Notes (admin/supervisor only)
**Files:** `src/pages/properties/PropertyDetail.tsx`, new migration.
**Database migration:**
```sql
CREATE TABLE public.property_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  tenant_name text,
  tenant_phone text,
  notes text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.property_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin/supervisor read" ON property_notes FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE POLICY "admin/supervisor write" ON property_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'supervisor'));
CREATE UNIQUE INDEX ON property_notes(property_id);
```
**UI:** Add `<Collapsible>` section to PropertyDetail above tabs, gated by `activeRole === 'admin' || activeRole === 'supervisor'`. Form: tenant_name, tenant_phone, textarea notes; "Last updated: {updated_at} by {updated_by name}"; upsert on save.

### 11. Active Role switcher
**Finding:** DrawerMenu **already has** a role switcher (lines 156-178) — works correctly. Profile page does NOT.
**Files:** `src/pages/Profile.tsx`, `src/stores/authStore.ts`.
**Fix:**
- Add a "Active Role" section to Profile.tsx near top, only when `user.roles.length > 1`. Render buttons identical to DrawerMenu's switcher.
- Update `authStore.setActiveRole` to also persist to localStorage: `localStorage.setItem('fiveserv-active-role', role)`.
- In `authStore.setUser` and `useAuth.initialize`, read localStorage value first; fall back to `roles[0]` if missing/invalid.
- Notifications: already query by `user_id` (not by role) in NotificationDropdown — confirmed receives for all roles regardless of activeRole. No change needed.

## EXECUTION ORDER

1. **Critical bugs first**: #5 (surface ticket error), #3 (password reset code exchange), #4 (app name), #2 (PWA icons), #1 (client address column + field).
2. **Design**: #7 (role badge), #8 (chat colors), #6 (reports), #9 (prices audit — largest scope).
3. **Features**: #10 (property notes table + UI), #11 (Profile role switcher + localStorage persistence).

No changes will be made until you approve.
