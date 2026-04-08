

# Mobile Responsiveness Analysis — All Screens

## Summary
After reviewing every page in the app, I found **11 specific mobile responsiveness issues** across multiple screens. The app uses `p-4` padding and `max-w-*` containers which work reasonably well, but several patterns break on screens under 375px wide.

---

## Issues Found

### 1. TopNav — Center wordmark overlaps right-side elements
**File:** `TopNav.tsx` line 42
The "FiveServ" wordmark uses `absolute left-1/2 -translate-x-1/2` which overlaps the role badge, theme toggle, and bell icon on narrow screens (<375px). The right section has 3 items (role badge + 2 buttons) with `gap-3`, and the role badge uses `tracking-widest` which makes it wide.

### 2. TopNav — Role badge doesn't hide on small screens
**File:** `TopNav.tsx` line 49-54
The role badge with `tracking-widest` and uppercase text takes ~80px. On a 320px screen, the right section competes with the centered wordmark.

### 3. Dashboard — Metric cards grid `grid-cols-2` still tight on 320px
**File:** `Dashboard.tsx` line 147
`grid-cols-2 md:grid-cols-3 lg:grid-cols-6` — each card has `p-3` with icon + label + large number. At 320px with `p-4` page padding, each card gets ~140px which is workable but the `text-2xl` value and label text can overflow if labels are long ("PM Not Responding" = 17 chars).

### 4. TicketDetail — Info grid `grid-cols-2` causes text truncation
**File:** `TicketDetail.tsx` line 300
`grid grid-cols-2 gap-3` is hardcoded with no responsive breakpoint. On a 320px screen, each column gets ~130px. Long property names, client names, and full datetime strings overflow.

### 5. TicketDetail — Action buttons overflow horizontally
**File:** `TicketDetail.tsx` line 404
`flex gap-2 flex-wrap` should wrap, but many buttons with icons + text ("Assign Technician", "Send Report to PM", "Log Delay Note") create 3+ rows of wrapping that push content down. The buttons don't have consistent sizing.

### 6. TicketForm — Two-column grids on every row
**File:** `TicketForm.tsx` lines 359, 387, 420
Three separate `grid grid-cols-2 gap-4` blocks with no responsive breakpoint. Select dropdowns at ~145px wide on a 320px screen are barely usable — the text inside truncates and touch targets are small.

### 7. TicketList — Filter row `grid-cols-2 md:grid-cols-3` is okay but filter dropdowns overlap search
**File:** `TicketList.tsx` line 116
Minor: the filter section appears inline and on 320px the 2-column grid makes each Select ~145px which truncates "All Statuses" label.

### 8. CalendarPage — Calendar fixed height of 650px
**File:** `CalendarPage.tsx` line 239
`style={{ height: 650 }}` — on mobile the calendar is 650px tall in a scrollable container. The month view cells become extremely narrow (~45px per day), making event text unreadable. The legend row at the top also wraps poorly.

### 9. CalendarPage — Right-click reschedule doesn't work on mobile
**File:** `CalendarPage.tsx` line 177
`onContextMenu` for rescheduling — mobile browsers don't support right-click. There's no alternative touch gesture.

### 10. TechnicianList — User rows have too many inline elements
**File:** `TechnicianList.tsx` line 124
Each user row is a single `flex` row with avatar (40px) + name/email/roles + status badge + job count + dropdown — all on one line. On 320px this causes horizontal compression where badges and text overlap or get pushed off-screen.

### 11. AccountingList — Filter controls layout
**File:** `AccountingList.tsx` — Multiple Select components and checkboxes in a row without responsive wrapping.

---

## Screens That Are Fine
- **Login / ForgotPassword / ResetPassword** — single-column centered layouts
- **Profile** — uses `max-w-lg mx-auto`, single column, works well
- **PropertyList / ClientList** — card-based single-column layouts that stack naturally
- **InspectionList** — card-based, wraps fine
- **AreaInspection** — `max-w-2xl mx-auto`, single-column flow, works on mobile
- **DrawerMenu** — slide-out drawer, mobile-native

---

## Proposed Fixes

| Screen | Fix |
|--------|-----|
| TopNav | Hide role badge on `sm:`, shrink gap. Or make wordmark relative instead of absolute |
| Dashboard metrics | Change "PM Not Responding" to "PM Pending". Add `text-xs` on small screens |
| TicketDetail info grid | `grid-cols-1 sm:grid-cols-2` |
| TicketDetail action buttons | Make full-width stacked on mobile |
| TicketForm grids | `grid-cols-1 sm:grid-cols-2` on all three grid blocks |
| CalendarPage | Reduce height to `min(650px, calc(100vh - 200px))`. Default to Day view on mobile |
| CalendarPage reschedule | Add long-press or tap-and-hold handler for mobile |
| TechnicianList rows | Stack info vertically on mobile, move badges below name |
| AccountingList filters | Responsive wrap |

## Technical Details
All fixes are CSS/Tailwind responsive prefix changes (`sm:`, `md:`) and minor layout restructuring. No backend or data changes needed.

