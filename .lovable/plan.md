

# Analysis: 6 Issues — Root Causes

## Issue 1: Property Name Redundant with Address

**Cause**: `PropertyForm.tsx` has separate `name` and `address` fields (lines 211-218). `canSubmit` requires both (line 187). DB column `properties.name` is used everywhere as the display label (Dashboard line 218, InspectionDetail line 416, CreateInspection line 210).

**What needs to change**:
- Remove the "Property Name" input from `PropertyForm.tsx`. Keep only Address.
- On save, set `name = address` (so existing reads `properties.name` keep working without touching every other file).
- Update CSV import: drop required `property_name` column; use `address` as both.
- Update `CreateInspection.tsx` `handleConfirmNewProperty` (already does `name: newPropertyName, address: newPropertyName` — fine), and rename the dialog/label to just "Address".
- The dropdown render (line 210-211) shows `{p.name} — {p.address}` (duplicate). Show just the address.

**Files**: `src/pages/properties/PropertyForm.tsx`, `src/pages/inspections/CreateInspection.tsx`.

---

## Issue 2: Schedule Inspection for a Future Date

**Cause**: `CreateInspection.tsx` only inserts with `status: 'draft'` (line 130) and immediately navigates to `/inspect`. There's no "Start Now vs Schedule" choice. `inspections.visit_date` exists but is purely informational. There's no `scheduled` status nor any logic that activates an inspection on its date.

**What needs to be added**:
- Two-button selector at top of CreateInspection: **Start Now** | **Schedule for later**.
- If Schedule: show date+time picker (use shadcn Calendar in Popover + time input). Hide "Start Inspection" button; show "Schedule Inspection".
- On schedule submit: insert with `status: 'scheduled'` and `visit_date` = chosen date. Navigate back to inspection list (don't open inspect screen).
- Inspection list / Calendar already query `inspections` — surface `scheduled` ones with new label/color in `inspectionStatusLabels`/`inspectionStatusColors`.
- Activation: on opening the inspection detail (or via a small client-side check), if `status === 'scheduled'` and `visit_date <= today`, auto-bump to `draft` so the user can begin. (No cron needed.)

**Files**: `src/pages/inspections/CreateInspection.tsx`, `src/lib/inspectionColors.ts`, `src/pages/inspections/InspectionDetail.tsx` (auto-activate), `src/pages/calendar/CalendarPage.tsx` (already pulls inspections — verify scheduled ones appear).

---

## Issue 3: Numeric Keyboard for Price/Quantity

**Cause**: `PricingReview.tsx` already uses `type="number"` (lines 233, 244). On iOS, `type="number"` does NOT reliably show the numeric keypad — `inputMode` is required. Both inputs are missing `inputMode`.

**What needs to change**:
- Line 232-239 (Qty): add `inputMode="numeric"` and `pattern="[0-9]*"`.
- Line 243-251 (Unit Price): add `inputMode="decimal"`.

**Files**: `src/pages/inspections/PricingReview.tsx`.

---

## Issue 4: PM Response Missing Per-Item Notes

**Cause**: `InspectionDetail.tsx` PM Response tab (lines 600-610) renders each PM-selected item showing only `item.item_name`, subtotal, and `item.pm_note` — but **never renders `item.item_note`** (the technician's per-item note). The data is in the same row (already in `items` state), it's simply not displayed in this tab. The FiveServ tab does show it (line 544-546).

**What needs to change**:
- Line 601-609: add a render block for `item.item_note` (e.g. `<p>Tech note: {item.item_note}</p>`) alongside `pm_note`.

**Files**: `src/pages/inspections/InspectionDetail.tsx`.

---

## Issue 5: Ticket Priority Not Updating on Dashboard

**Cause**: `Dashboard.tsx` already subscribes to realtime on `tickets` table (lines 72-77) and refetches on any change. BUT — the dashboard renders `work_type` badges (line 206) and `status` badges (line 208), and **does not render `priority` at all**. So when priority changes, there is nothing on the card showing it; the user perceives "stale" because the change is invisible. Realtime is working; the field is just absent from the UI.

Additionally, `priority` is not part of `metricCards` or any sort/filter — it has no visible surface.

**What needs to change**:
- Add a `priority` badge to each ticket card in `Dashboard.tsx` (line ~205, next to status).
- Optionally sort high-priority tickets above normal (after emergency sort).

**Files**: `src/pages/Dashboard.tsx`.

---

## Issue 6: Ticket Created from Inspection — Poor Format

**Cause**: `InspectionDetail.tsx` `handleConvertToTickets` (lines 102-158) builds the description as:
```
From inspection INS-XXXX.
KITCHEN:
- Sink — broken [PM: replace]
```
Issues:
- No clear header (just "From inspection X.")
- No urgency markers per item
- Mixes PM notes with tech notes inline; not visually clean
- Doesn't show PM-approved subtotals (correct — the requirement says no prices, this is fine)
- `work_type` already auto-sets to `emergency` if any urgent ✓

**What needs to improve**:
- Header: `### Work from Inspection #INS-XXXX`
- Per area block:
  ```
  AREA: Kitchen
  • Sink (URGENT) — Tech: broken pipe / PM: please replace
  • Faucet — Tech: leaky
  ```
- Mark urgent items clearly
- Drop the inline PM bracket format; use line breaks
- Keep `internal_note` with PM approved total (already done, lines 131-132)
- Keep `work_type` urgency logic (already done, line 127-128) ✓
- No prices in description (already correct) ✓

**Files**: `src/pages/inspections/InspectionDetail.tsx` (lines 108-124).

---

## Summary

| # | Cause | Fix Location |
|---|-------|------|
| 1 | Two fields (`name`, `address`); `name` used as label everywhere | PropertyForm.tsx, CreateInspection.tsx |
| 2 | No schedule option, no `scheduled` status | CreateInspection.tsx, inspectionColors.ts, InspectionDetail.tsx |
| 3 | `type="number"` alone doesn't trigger iOS numeric keypad | PricingReview.tsx |
| 4 | PM tab doesn't render `item.item_note` (data exists) | InspectionDetail.tsx |
| 5 | Priority field never rendered on dashboard cards (realtime works fine) | Dashboard.tsx |
| 6 | Description format flat, no clear header, mixed inline notes | InspectionDetail.tsx (handleConvertToTickets) |

