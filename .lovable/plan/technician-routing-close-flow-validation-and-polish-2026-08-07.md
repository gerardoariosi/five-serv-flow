# Technician routing, close-flow validation, and polish

## 1. Route technicians to the work screen

- `TechnicianDashboard.tsx` (My Work) and `TicketList.tsx` both navigate to `/tickets/:id`. When the active role is `technician`, navigate to `/tickets/:id/work` instead. All other roles keep today's behavior.

## 2. Replace the admin's unvalidated jump to Ready for Review

- In `TicketDetail.tsx`, `in_progress` currently lists `ready_for_review` as a generic status button with no checks. Remove it from that list so no one can jump there without evidence.
- Add a dedicated "Complete & Submit for Review" button for admin/supervisor when status is `in_progress` or `paused`. It opens a dialog that requires:
  - at least 3 photos total on the ticket (any stage), with a live counter ("2 of 3 photos required")
  - a closing note
  - confirm stays disabled until both are satisfied
- On confirm it does exactly what the technician flow does: set status to `ready_for_review`, write a timeline entry with the closing note, and trigger `notify-ready-for-review`.
- Approve / Reject on `ready_for_review` are untouched.

## 3. Three-photo minimum on the technician close (`TicketWork.tsx`)

- `handleMarkComplete` currently requires one closing photo + note. Change to: total photos on the ticket (existing + the one being added now) must reach 3, plus the closing note. Same counter text in the Complete dialog, Submit disabled until met. This also covers the make-ready close step, which uses the same handler.

## 4. Visual feedback on step advance (`TicketWork.tsx`, visual only)

- When the step index moves forward after an action, briefly flash the step indicator (success pulse / scale on the newly active step) for well under a second, then settle. No changes to validation, fields, or navigation.

## 5. Fix the push deep link

- In `TicketDetail.tsx`, `handleAssignTech` and `handleReschedule` send `url`/`link` of `/my-work/:id`, which is not a route. Change both to `/tickets/:id/work`.

## Not touched

Evaluation/estimate flow logic, Pause/Resume, Approve/Reject behavior.

## Verification

After implementing, walk the app in the browser: technician tap-through from My Work into TicketWork, blocked close under 3 photos then allowed at 3, admin generic buttons no longer offering Ready for Review, the new admin complete dialog gating correctly, notification URLs pointing at `/tickets/:id/work`, and Approve/Reject unchanged.

## Technical notes

- Photo count comes from the already-loaded `ticket_photos` rows for the ticket (`currentPhotos` in TicketWork; `photos` in TicketDetail).
- Role source is `useAuthStore().activeRole` in both list screens.
