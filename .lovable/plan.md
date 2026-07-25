# Plan: ClientDetail bug fix + TicketDetail/InspectionDetail header & info restyle

## Part 1 — Bug fix: ClientDetail "Inspections" tab rows aren't clickable

**File:** `src/pages/clients/ClientDetail.tsx` (lines 210–222)

The Inspections tab renders each row as a plain `<div>`. Properties (lines 164–174) and Tickets (lines 187–199) already use `<button onClick={() => navigate(...)}>` with:
`className="w-full text-left py-3 px-1 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"`

**Change:** Swap the inspection `<div>` for a `<button>` with the same className and `onClick={() => navigate(`/inspections/${ins.id}`)}`. Keep the inner content identical (INS number, status Badge, property name, visit date). No other edits.

---

## Part 2 — Visual restyle for TicketDetail.tsx and InspectionDetail.tsx

Scope is strictly the **top identity header** + **basic info card**. Everything else stays byte-identical.

### Shared imports to add to both files
```ts
import DetailHeader from '@/components/detail/DetailHeader';
import DetailActions from '@/components/detail/DetailActions';
import FieldGroup from '@/components/detail/FieldGroup';
import FieldRow from '@/components/detail/FieldRow';
import StatusPill from '@/components/detail/StatusPill';
```
Remove the now-unused `ArrowLeft` import (both files); leave `Badge` and `Edit` since they're used elsewhere in the pages.

### 2A — TicketDetail.tsx

**Header replacement (lines 556–578)** — replace the manual back button + fs_number + badges + Edit button block with:

```tsx
<DetailHeader
  name={ticket.fs_number ?? 'No FS#'}
  status={
    <div className="flex items-center gap-1.5 flex-wrap">
      <StatusPill className={colors.badge}>{(ticket.work_type ?? 'repair').replace('-', ' ').toUpperCase()}</StatusPill>
      <StatusPill className={statusColors[ticket.status ?? 'draft']}>{statusLabels[ticket.status ?? 'draft']}</StatusPill>
      {(ticket.rejection_count ?? 0) > 0 && (
        <StatusPill variant="danger">{ticket.rejection_count} rejection{ticket.rejection_count > 1 ? 's' : ''}</StatusPill>
      )}
    </div>
  }
  actions={
    isAdminOrSupervisor ? (
      <DetailActions
        primary={
          <Button variant="outline" size="sm" onClick={() => navigate(`/tickets/${id}/edit`)}>
            <Edit className="w-4 h-4 mr-1" /> Edit
          </Button>
        }
      />
    ) : undefined
  }
/>
```

Notes:
- We render the FS number as `name` (mono styling is dropped; matches Client/Vendor/Property pages which use the plain heading style). If you want to preserve monospace, we can wrap it in a `<span className="font-mono">` inside `name` — flag if you want that.
- The existing status-color Tailwind classes from `colors.badge` and `statusColors[...]` are re-used by passing them via `StatusPill className={...}`; `StatusPill` merges them, so the current work-type and status color pills look the same.
- `DetailHeader` handles the Back button (defaults to `navigate(-1)`), matching the current behavior.

**Info card replacement (lines 598–675)** — replace the `bg-card border border-border rounded-lg p-4 … grid grid-cols-2 gap-x-4 gap-y-4` block with FieldGroup + FieldRow. Empty values disappear (FieldRow shows nothing extra when hidden via conditional), matching the other detail pages.

Structure:
- `FieldGroup label="Details" first`
  - `FieldRow label="Client / PM"` — only rendered when `isAdminOrSupervisor` and value present
  - `FieldRow label="Property"` — value only when set
  - `FieldRow label="Unit"` — hidden when empty
  - `FieldRow label="Zone"` — hidden when empty
  - `FieldRow label="Address"` — value is the same `<a>` Google Maps link with MapPin icon
  - `FieldRow label="Technician"` — value = user name, or `<span className="text-destructive">Unassigned</span>` if none
  - `FieldRow label="Appointment"` — hidden when empty
  - `FieldRow label="Priority"` — capitalized, always shown
  - `FieldRow label="Work Started"` — hidden when empty
- `FieldGroup label="Description"` (only if `ticket.description`) — child is a `<p>` (not a FieldRow, since it's freeform text)
- Internal Note card (lines 665–674) stays byte-identical — it's visually distinct (secondary bg + StickyNote icon) and functionally admin-only. It just moves below the FieldGroups.

Rows that render conditionally (hide entire row when empty) instead of showing "—":
Client/PM, Property, Unit, Zone, Address, Appointment, Work Started. Technician always renders (shows "Unassigned" in red when null). Priority always renders.

**Everything else in the file stays untouched** — all modals (Reject, Assign, Reschedule, Delete, PM Report), the Accounting/Billing section (line 677+), Estimate Builder, Evaluation Submitted, Pending Estimate, Estimate Sent, Estimate Approved cards, action button row, Timeline/Photos tabs.

### 2B — InspectionDetail.tsx

**Header replacement (lines 534–547):**

```tsx
<DetailHeader
  name={inspection.ins_number ?? 'No INS#'}
  status={
    <StatusPill className={inspectionStatusColors[inspection.status ?? 'draft']}>
      {inspectionStatusLabels[inspection.status ?? 'draft']}
    </StatusPill>
  }
/>
```

No Edit button existed on the inspection header, so no `actions` prop is needed. Back behavior preserved by DetailHeader default.

**Info card replacement (lines 557–599):**

Structure:
- `FieldGroup label="Details" first`
  - `FieldRow label="Property"` — hidden when empty
  - `FieldRow label="Client / PM"` — hidden when empty
  - `FieldRow label="Visit Date"` — hidden when empty
  - `FieldRow label="Config"` — value = the same `BR·BA·LR + Garage/Laundry/Exterior` composite string
- `FieldGroup label="Assignment"` — contains the "Assigned to" row. This row is special: for admin/supervisor it renders the existing `<Select>` reassignment control; for others, it renders the user name (or "Unassigned" muted). We pass the Select (or plain value) as the `value` prop of a `FieldRow label="Technician"`. FieldRow accepts a ReactNode, so this works cleanly.

Rationale for splitting Assignment into its own group: keeps the Select control visually separated (it's an interactive control, not a static field) and matches the "grouped by concern" pattern used on Vendor/Client detail pages.

**Everything else stays untouched** — PM alert banner (lines 549–555), Export & Email card, area-by-area sections, PM portal links, Pricing Review, item lists with PM ✓ badges, Convert modal, Delete modal, Start config dialog, Email modal.

### Confirmations before touching code (please answer)
1. **Monospace FS/INS numbers**: The current header uses `font-mono` for `fs_number`/`ins_number`. `DetailHeader` `name` is regular sans-serif. Keep sans (matches other pages), or preserve mono by wrapping? **Default: keep sans, matches Client/Property/Vendor.**
2. **StatusPill color mapping**: Reusing the existing `colors.badge` / `statusColors[...]` / `inspectionStatusColors[...]` tailwind class strings via `StatusPill className={...}` keeps the current per-status/work-type colors. Confirm that's the intended look (vs. mapping to `variant="success|warning|danger|neutral|info"` from the shared StatusPill palette). **Default: keep existing color classes for zero visual regression on status semantics.**
3. **"Address" row**: keep it as a full-width Google Maps link inside FieldRow (value is JSX with MapPin icon), or move to a dedicated `FieldGroup label="Location"`? **Default: single row inside "Details" group, same as today.**

### Risk flags
- **Zero business-logic changes** — no state, mutation, effect, or handler is touched. Only JSX for the header block and the info-card block.
- **Removed imports** — `ArrowLeft` becomes unused; must be removed to keep the lint/build clean.
- **Countdown banner** on TicketDetail (lines 588–596) and **PM-not-responding banner** on InspectionDetail (lines 549–555) sit between the header and the info card today. They stay in place, unchanged, between `<DetailHeader />` and the first `<FieldGroup />`.
- **Pending sync warning** (Ticket line 580–586) same treatment — stays between header and info card.
- **Spacing**: current layouts use parent `space-y-*` from the outer div; FieldGroup uses its own `pt-4 mt-4 border-t` spacing. This may slightly compress the gap between the header block and the first FieldGroup vs. the old card. If it looks too tight, we'll add a `mt-2` wrapper — visual-only tweak after we see the result.

### Verification after edit
- `tsgo` typecheck (no signature changes expected).
- Manually confirm on preview: Back button works, Edit button (ticket) still navigates, Select reassign (inspection) still calls `handleReassign`, all workflow cards render for each status, modals still open, Internal Note still shows for admin/supervisor.
