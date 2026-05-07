# Plan: Address Split + Inspection Assignee

## IMPROVEMENT 1 — Property Address Split

### Current state
- `properties.address` is a single nullable `text` column. `properties.name` is also used as a fallback display label and is currently mirrored to `address` on insert.
- Address is read in **15+ files**:
  - **Properties:** `PropertyForm.tsx`, `PropertyList.tsx` (search, display, maps link), `PropertyDetail.tsx` (display, maps link)
  - **Tickets:** `TicketForm.tsx` (email merge, directions URL), `TicketDetail.tsx` (email merge, directions URL, header), `TicketList.tsx`, `TicketWork.tsx` (maps link), `TicketReview.tsx`, `TechnicianDashboard.tsx`, `EstimatePortal.tsx`
  - **Inspections:** `CreateInspection.tsx` (search), `PMPortal.tsx`
  - **PDF / templates:** `src/lib/ticketPdf.ts`

### Changes

**1. Migration**
- Add columns: `street_address text`, `city text`, `state text` (2-letter), `zip_code text`.
- Backfill: copy existing `address` into `street_address` (single field — best-effort; users can edit).
- Keep `address` column for backward-compat; drop the partial uniqueness on `address` if any (none currently — only soft-delete partial index on clients).
- Add a generated column `full_address text GENERATED ALWAYS AS (concat_ws(', ', NULLIF(street_address,''), NULLIF(city,''), NULLIF(concat_ws(' ', NULLIF(state,''), NULLIF(zip_code,'')),''))) STORED` so all read sites can use a single field with no client-side concatenation.
- Drop legacy `address` after backfill is verified, OR keep and update via trigger. **Recommendation:** keep `address` and update it via trigger to mirror `full_address` so existing reads keep working with zero risk. New reads use `full_address`.

**2. Helper** — `src/lib/propertyAddress.ts`
```ts
export const formatAddress = (p: { street_address?, city?, state?, zip_code? }) =>
  [p.street_address, p.city, [p.state, p.zip_code].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ');
```
Used wherever a full address string is needed (maps URLs, PDFs, emails).

**3. PropertyForm.tsx**
- Replace single `address` input with 4 fields:
  - Street Address (text, required)
  - City (text, required)
  - State (Select with all 50 US states + DC)
  - Zip Code (text, 5-digit pattern)
- Uniqueness check: query on `street_address + zip_code` (instead of `address`).
- CSV import: accept either legacy single `address` column (goes into street_address) OR new columns `street_address, city, state, zip_code`.
- Mutation writes the 4 fields; `name` mirror = `street_address`.

**4. Display sites** — switch from `p.address` to `p.full_address || formatAddress(p)`:
- `PropertyList.tsx` — list rows + maps link + search (search across street/city/zip via `.or()`)
- `PropertyDetail.tsx` — header + maps link + show as 2-line address
- `TicketList/Detail/Work/Review`, `TechnicianDashboard`, `EstimatePortal`, `PMPortal`, `TicketForm`, `ticketPdf.ts` — read `full_address` from select; replace `properties.address` with `properties.full_address` in selects.

**5. Email templates / merge tags**
- `property_address` and `directions_url` continue to use the formatted full string — no template change needed.

---

## IMPROVEMENT 2 — Assign Technician When Scheduling Inspection

### Current state
- `inspections` table has **no** `technician_id` or `assigned_to` column.
- `CreateInspection.tsx` lines 28–30, 124–130: `mode === 'schedule'` with date + time picker; saves with `status: 'scheduled'`.
- No notification fires on inspection creation today.

### Changes

**1. Migration**
- Add `inspections.assigned_to uuid` (no FK, mirrors how tickets reference users).
- Update `notify_inspection_pm_submitted` is unrelated; create a new trigger:
  ```sql
  CREATE FUNCTION notify_inspection_assigned() — inserts notification for NEW.assigned_to
  CREATE TRIGGER on inspections AFTER INSERT OR UPDATE OF assigned_to
  ```
  Notification: title "New Inspection Assigned", link `/inspections/{id}`. The trigger inserts into `notifications` (in-app). Push is fired from the client after insert (same pattern as tickets: call `pushToUsers([assigned_to], ...)`).

**2. CreateInspection.tsx**
- Add new state: `assignedTo: string` and `users: {id, full_name, role}[]`.
- Fetch all active users via `get_user_directory()` RPC (same pattern as Ticket assignment per recent change). Also fetch their primary role from `user_roles` to display "Name (Role)" — same pattern used in TicketForm.
- Show the Assignee dropdown **only when `mode === 'schedule'`** (just below date/time). Optional field.
- On submit, include `assigned_to: assignedTo || null` in insert payload.
- After insert succeeds, if `assignedTo`, call:
  - `pushToUsers([assignedTo], 'New Inspection Assigned', '<ins_number> on <date>', '/inspections/<id>')`
- Email: handled by existing transactional email pipeline if desired — but spec says "email + push". Add a call to `supabase.functions.invoke('send-transactional-email', { body: { template: 'inspection-assigned', to: <user email>, ... } })`. **Requires** scaffolding a new transactional template `inspection-assigned.tsx`. (Confirm with user before adding email — or rely on push + in-app only.)

**3. InspectionDetail.tsx (small follow-on)**
- Display "Assigned to: <name>" when present, with a reassign dropdown matching the ticket reassign pattern. (Optional in this round; can defer.)

### Open question for user
- For inspection assignment notification, do you want **email + push + in-app**, or is **push + in-app** sufficient? (Email requires a new transactional template.)
