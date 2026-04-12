

# Analysis: 5 Issues — Root Causes

## Issue 1: EMAILS NOT SENDING — CRITICAL

**Root cause: The `send-transactional-email` and related edge functions were not redeployed after the latest code changes.**

The `email_send_log` shows all failures come from an older code path. The old `send-inspection-email` function (now deleted) enqueued emails directly to pgmq WITHOUT including `unsubscribe_token`, causing `process-email-queue` to fail with:
```
Email API error: 400 {"type":"missing_unsubscribe","message":"Transactional emails must include an unsubscribe_token"}
```

The current `send-transactional-email/index.ts` code (line 324) DOES include `unsubscribe_token` in the enqueued payload. The `inspection-report` template exists and is registered in `registry.ts`. The cron job and infrastructure are all in place.

**The fix is to deploy the edge functions.** The functions `send-transactional-email` and `process-email-queue` need to be redeployed so the latest code (with correct `unsubscribe_token` handling) is live. No code changes needed — just deployment.

Additionally, there are stale DLQ entries from the old broken attempts that can be ignored.

**Note:** This is NOT a Resend issue. The app uses Lovable's built-in email infrastructure (domain: `notify.fiveserv.net`), not Resend. No `RESEND_API_KEY` is needed.

---

## Issue 2: PM PORTAL — IMAGE EXPAND AND SAVE

**Root cause: `PMPortal.tsx` lines 414-417 render photos as plain `<img>` tags inside a grid with no click handler, no lightbox, and no download button.**

```tsx
<img src={p.displayUrl || p.url} alt="" className="w-full h-28 object-cover" />
```

Photos are small thumbnails (h-28 = 112px) with no interaction. Missing:
- No `onClick` handler to open a fullscreen/lightbox view
- No download button or "save image" option
- No Dialog/modal component for expanded view

**Fix**: Add a lightbox Dialog that opens on photo click showing the full-size image, with a download button that triggers `window.open(url)` or an anchor with `download` attribute.

---

## Issue 3: PM PORTAL — INSTRUCTIONS GUIDE AT TOP

**Root cause: `PMPortal.tsx` line 345 starts the content area (`<div className="max-w-2xl mx-auto p-4 space-y-4">`) with the submitted confirmation (if applicable), then immediately jumps to the area-grouped items (line 359). There is no instruction section.**

The portal has no explanation of what the report is, how to select items, add notes, sign, or submit. The PM lands directly on the items list.

**Fix**: Add a collapsible instruction card between lines 356-358 (after the submitted banner, before the items loop) with bullet points explaining the workflow.

---

## Issue 4: QUANTITY FIELD — DEFAULT NOT CLEARING

**Root cause: `PricingReview.tsx` line 227 — `value={item.quantity ?? 1}`**

```tsx
<Input type="number" min={1} value={item.quantity ?? 1}
  onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)} />
```

The quantity input always shows `1` (or the current value). Unlike the unit price field (line 238) which was already fixed to use `value={item.unit_price || ''}` and `onFocus={e => e.target.select()}`, the quantity field:
- Uses `value={item.quantity ?? 1}` instead of showing empty string when default
- Has no `onFocus` handler to select the text

**Fix**: Change to `value={item.quantity || ''}` and add `onFocus={e => e.target.select()}`, matching the pattern already used for unit price on lines 238-240.

---

## Issue 5: NOTIFICATION BELL — SCROLL AND DELETE

**Root cause: `NotificationDropdown.tsx` has two problems:**

1. **Scroll**: Line 100 uses `<ScrollArea className="max-h-80">` which should work, but `ScrollArea` from Radix requires an explicit `h-*` or the viewport doesn't constrain height properly. Using `max-h-80` on the Root without a fixed height means the viewport may expand beyond the popover. The `PopoverContent` itself has no max-height constraint either.

2. **Delete**: There is no delete functionality at all — no delete button per notification, no swipe-to-delete, no "Clear all" button. The only actions are "Mark as read" (implicit on click) and "Mark all read" (line 95). There is no `deleteNotification` function, no trash icon, no clear-all handler.

**Fix**:
- For scroll: Set explicit height on ScrollArea or use `overflow-y-auto` directly on a div with `max-h-80`
- For delete: Add a delete button (trash icon) on each notification row, add a "Clear all" button in the header, and implement `supabase.from('notifications').delete().eq('id', id)` handlers

---

## Summary

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | Emails failing | Edge functions not redeployed after code fix | Deploy `send-transactional-email` + `process-email-queue` |
| 2 | No image expand/save | Photos are plain thumbnails, no lightbox | Add lightbox Dialog + download button |
| 3 | No instructions in PM portal | No instruction section exists | Add instruction card before items |
| 4 | Quantity not clearing | `value={item.quantity ?? 1}` + no `onFocus` | Match unit price pattern: empty string + select |
| 5 | No scroll/delete in notifications | ScrollArea height issue + no delete UI | Fix height, add delete per-item + clear all |

## Files to Change

1. **Issue 1**: Deploy edge functions (no code changes needed)
2. **Issue 2**: `src/pages/inspections/PMPortal.tsx` — add lightbox Dialog + download
3. **Issue 3**: `src/pages/inspections/PMPortal.tsx` — add instruction section
4. **Issue 4**: `src/pages/inspections/PricingReview.tsx` — fix quantity input
5. **Issue 5**: `src/components/layout/NotificationDropdown.tsx` — fix scroll, add delete + clear all

