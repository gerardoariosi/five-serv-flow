

# Analysis: Missing Delete/Cancel Functionality

## Issue 1: Inspection Delete

**Current state**: InspectionDetail.tsx has a `handleDeleteDraft` function (line 87) that deletes items + inspection, and a "Delete Draft" button (line 462) — but ONLY for draft inspections. The delete dialog (line 271) is hardcoded to say "Delete Draft?" with no option for non-draft inspections.

**What's missing**:

1. **InspectionList.tsx**: No delete option at all — `InspectionCard` is a plain `<button>` with no 3-dot menu, no swipe, no context actions. Need to add a `MoreVertical` dropdown menu per card with a "Delete" option (admin/supervisor only).

2. **InspectionDetail.tsx**: Delete button only appears for drafts. Need to:
   - Show delete button for ALL statuses (admin/supervisor only)
   - For drafts: current "Delete Draft?" confirmation is fine
   - For non-drafts: show warning "This inspection has been sent to PM. Are you sure you want to delete it?"
   - Delete must also remove `inspection_photos` and `inspection_tickets` (currently only deletes `inspection_items`)

3. **Database**: The `inspections` table has NO delete RLS policy for authenticated users. Current policies only allow ALL for admin/supervisor, which includes DELETE. However, `inspection_items` and `inspection_photos` also need cascade deletion. `inspection_tickets` needs a DELETE policy.

4. **RLS check**: 
   - `inspections`: admin/supervisor ALL policy covers DELETE ✓
   - `inspection_items`: admin/supervisor ALL policy covers DELETE ✓  
   - `inspection_photos`: has explicit delete policy for own photos, plus admin/supervisor ALL ✓
   - `inspection_tickets`: admin/supervisor ALL covers DELETE ✓

## Issue 2: Ticket Delete/Cancel

**Current state**: TicketDetail.tsx has `statusTransitions` that include `cancelled` as a next state from draft/open/in_progress/paused. The cancel button renders via the general status changes loop (line 453). So **cancelling works already** via status transition.

**What's missing**:

1. **No permanent delete**: There is no delete function or button anywhere in TicketDetail or TicketList. Need to add:
   - Admin-only "Permanently Delete" button visible only when ticket status is `draft` or `cancelled`
   - Confirmation dialog: "This action cannot be undone"
   - Delete must remove `ticket_photos`, `ticket_timeline`, and the `ticket` itself

2. **TicketList.tsx**: No 3-dot menu or delete option per ticket card. Need to add a context menu for admin users on draft/cancelled tickets.

3. **Database**: The `tickets` table has NO delete RLS policy. Need a migration to add:
   - DELETE policy on `tickets` for admin only
   - DELETE policy on `ticket_timeline` for admin only (currently has no delete policy)
   - `ticket_photos` already has admin/supervisor ALL which covers DELETE ✓

## Summary of Changes

| Component | What to Add |
|-----------|------------|
| **Migration** | DELETE policy on `tickets` (admin only), DELETE policy on `ticket_timeline` (admin only) |
| **InspectionList.tsx** | 3-dot `DropdownMenu` per card with "Delete" option, confirmation dialog, delete handler |
| **InspectionDetail.tsx** | Extend delete to all statuses with status-aware warning, delete photos + tickets too |
| **TicketList.tsx** | 3-dot menu on draft/cancelled tickets (admin only) with "Delete" option |
| **TicketDetail.tsx** | "Permanently Delete" button + confirmation dialog for admin on draft/cancelled tickets, delete handler for ticket + photos + timeline |

## Files to Change

1. DB migration: DELETE policies on `tickets` and `ticket_timeline`
2. `src/pages/inspections/InspectionList.tsx` — add 3-dot menu + delete
3. `src/pages/inspections/InspectionDetail.tsx` — extend delete to all statuses
4. `src/pages/tickets/TicketList.tsx` — add 3-dot menu + delete for admin
5. `src/pages/tickets/TicketDetail.tsx` — add permanent delete button + handler

