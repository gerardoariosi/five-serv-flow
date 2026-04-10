

# Analysis: 4 UI and Functionality Issues

## Issue 1: MOBILE DRAWER MENU CUT IN HALF

**Root cause: `AppLayout.tsx` line 73 — `overflow-x-hidden` on `<main>`**

The `<main>` element has `className="flex-1 overflow-x-hidden"`. The drawer (`DrawerMenu.tsx`) uses `position: fixed` with `z-50`, but the drawer is rendered **inside** the `AppLayout` component tree. While `fixed` positioning should escape overflow clipping, the real problem is the `AppLayout` wrapper itself:

```
<div className="min-h-screen flex flex-col bg-background">  ← root flex column
  <TopNav />
  <DrawerMenu />   ← rendered here, inside the flex layout
  <main className="flex-1 overflow-x-hidden">  ← clips horizontal overflow
    <Outlet />
  </main>
</div>
```

The drawer is `w-72` (288px). On narrow mobile viewports (320-414px), the drawer renders correctly with `fixed` positioning, BUT there's a secondary issue: `App.css` contains `#root { max-width: 1280px; margin: 0 auto; padding: 2rem; }`. Although `App.css` is **not imported** in `main.tsx`, if Vite processes it as part of the build (glob or legacy config), it would constrain the `#root` div to `max-width: 1280px` with `padding: 2rem`, which would clip fixed-position children on some viewports.

**Most likely cause**: The `#root` CSS in `App.css` is a Vite template leftover. If it IS being applied (check via DevTools), the `padding: 2rem` shrinks available space and the drawer's `left-0` position is relative to the padded container. Even if not applied, the `overflow-x-hidden` on main could cause clipping in certain mobile browsers.

**Fix**:
1. Delete `App.css` entirely (it's a Vite template leftover, not imported).
2. Remove `overflow-x-hidden` from `<main>` in `AppLayout.tsx`, or scope it more narrowly.

---

## Issue 2: TICKET EDIT SCREEN SHOWS BLACK SCREEN

**Root cause: RLS policy on `tickets` table blocks the UPDATE query, but the SELECT for loading works fine.**

The route `/tickets/:id/edit` renders `TicketForm` with `isEdit = true`. The component:
1. Sets `loading = true` (line 81)
2. Fetches the ticket via `.select('*').eq('id', id).single()` (line 82)
3. If data exists, populates the form and sets `loading = false` (line 99)

The SELECT query works (RLS allows all authenticated users). The form renders. However, **the "black screen" is not a rendering failure** — the form should load. The issue is likely that the query fails silently when `data` is `null` (no `.catch()` handler), leaving the spinner showing forever on a dark background, which the user perceives as "black screen."

Possible causes:
- The ticket ID in the URL doesn't match any row (deleted or wrong UUID)
- The `.single()` call returns an error (not `data`) when RLS blocks or no rows match, and the code only checks `if (data)` — if the query errors, `loading` stays `true` forever showing the spinner on the dark `bg-background`

**Fix**: Add error handling to the edit fetch. If no data is returned, show an error message or redirect instead of staying in loading state forever.

---

## Issue 3: CHAT @MENTIONS NOT LINKING TO SPECIFIC TICKET

**Root cause: `ChatPage.tsx` lines 229-232 — mention links hardcoded to list routes**

The `renderContent` function parses `@ticket FS-2025-XXXX` mentions but sets the href to the **list page**, not the detail page:

```typescript
if (type === 'ticket') href = `/tickets`;        // ← goes to list
else if (type === 'property') href = `/properties`;  // ← goes to list
else if (type === 'inspection') href = `/inspections`; // ← goes to list
```

The `value` variable contains the FS number (e.g., `FS-2025-0001`), but it's never used to build the URL. To link to a specific ticket, the code needs to look up the ticket's UUID by its `fs_number`, then navigate to `/tickets/{uuid}`.

**Fix**: Change the `renderContent` function to:
1. For `@ticket FS-XXXX`: query `tickets` table by `fs_number` to get the UUID, then navigate to `/tickets/{uuid}`
2. Similarly for properties and inspections — look up by name/number and navigate to detail

---

## Issue 4: NOTIFICATION BELL IS EMPTY — NOT WORKING

**Root cause: No notification system exists.**

The bell in `TopNav.tsx` (lines 65-70) is a **static, non-functional element**:
- It renders a hardcoded badge showing "3"
- The button has no `onClick` handler
- There is no `notifications` table in the database (confirmed via query)
- There is no notifications component, no dropdown, no popover
- No code anywhere captures app events into a notification store or table

The entire notification system needs to be built from scratch:
1. Create a `notifications` table (user_id, type, title, message, link, read, created_at)
2. Create database triggers or application-level code to insert notifications on events (ticket created, status changed, chat message, inspection changes)
3. Build a notification dropdown/popover component
4. Wire the bell button to open the dropdown
5. Show real unread count instead of hardcoded "3"
6. Add realtime subscription for live updates

---

## Summary

| # | Issue | Root Cause | Severity |
|---|-------|-----------|----------|
| 1 | Drawer cut in half on mobile | `overflow-x-hidden` on main + potential `App.css` `#root` padding | Medium |
| 2 | Ticket edit black screen | No error handling on fetch — `loading` stays `true` forever on failure | Medium |
| 3 | @mentions link to list not detail | `href` hardcoded to `/tickets` instead of `/tickets/{uuid}` | Low |
| 4 | Notification bell empty | No notification system exists — bell is purely decorative | Critical |

## Files to Change

1. **Issue 1**: Delete `src/App.css`, update `AppLayout.tsx` overflow
2. **Issue 2**: Add `.catch()` and error state to `TicketForm.tsx` edit fetch
3. **Issue 3**: Update `renderContent` in `ChatPage.tsx` to resolve FS numbers to UUIDs and link to detail routes
4. **Issue 4**: Create `notifications` table + RLS, create NotificationDropdown component, update `TopNav.tsx`, add triggers/inserts for app events

