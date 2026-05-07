# Delete Bugs — Root Cause Analysis

## BUG 1 — Client email blocked after soft delete

**Root cause:** Two layers blocking reuse:

1. **DB constraint** `clients_email_key UNIQUE (email)` on `public.clients` — a soft-deleted row (`is_deleted = true`) keeps occupying the email, so inserting a new client with the same email fails at the database level.
2. **App-level duplicate check** `src/pages/clients/ClientForm.tsx:49` — queries existing clients by email without filtering `is_deleted = false`, so the form shows "This email is already registered" even when the only match is a deleted client.

**Fix:**
- Migration: drop `clients_email_key` and replace with a **partial unique index**:
  ```sql
  ALTER TABLE public.clients DROP CONSTRAINT clients_email_key;
  CREATE UNIQUE INDEX clients_email_active_unique
    ON public.clients (lower(email)) WHERE is_deleted = false;
  ```
- `src/pages/clients/ClientForm.tsx` line 49: add `.eq('is_deleted', false)` to the duplicate-check query.

---

## BUG 2 — Deleted tickets still in Dashboard & Calendar

Tickets use soft delete via `is_deleted` (and hard delete for draft/cancelled). Neither page filters it.

**Files / lines / fixes:**
- `src/pages/Dashboard.tsx:84` — `supabase.from('tickets').select('*')…`
  Add `.eq('is_deleted', false)` to the chain.
- `src/pages/calendar/CalendarPage.tsx:120-124` — tickets query.
  Add `.eq('is_deleted', false)` before `.order(...)`.

(The tickets query in `TicketList.tsx` already filters correctly — use it as the reference pattern.)

---

## BUG 3 — Deleted inspections still in Calendar (and elsewhere)

Inspections also have `is_deleted`; only `InspectionList` filters it.

**Files / lines / fixes:**
- `src/pages/calendar/CalendarPage.tsx:130-141` — inspections query.
  Add `.eq('is_deleted', false)` before the closing `.not(...)`.
- `src/pages/Dashboard.tsx` does **not** query inspections directly, so no change needed there for inspections. (Confirmed via grep — only `tickets`, `clients`, `properties`, `zones`, `user_roles`, and `get_user_directory` are fetched.)

Optional hardening (not required by the bug but worth noting): `InspectionDetail.tsx`, `PMPortal.tsx`, and any inspection-related selects that should also exclude deleted records — but these are accessed by ID and gated by tokens, so they are lower risk. Recommend leaving out of this fix unless requested.

---

## Summary table

| Bug | File | Line(s) | Change |
|---|---|---|---|
| 1a | DB migration | — | Replace `clients_email_key` with partial unique index where `is_deleted = false` |
| 1b | `src/pages/clients/ClientForm.tsx` | 49 | Add `.eq('is_deleted', false)` |
| 2a | `src/pages/Dashboard.tsx` | 84 | Add `.eq('is_deleted', false)` |
| 2b | `src/pages/calendar/CalendarPage.tsx` | 120-124 | Add `.eq('is_deleted', false)` |
| 3  | `src/pages/calendar/CalendarPage.tsx` | 130-141 | Add `.eq('is_deleted', false)` |

No code changes made yet — awaiting approval.
