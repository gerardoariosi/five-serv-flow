

# Analysis: 5 Issues — Root Causes

## Issue 1: EMAILS NOT SENDING — CRITICAL

**Root cause: `missing_unsubscribe` — the email API rejects emails without an `unsubscribe_token`.**

The `email_send_log` shows every `inspection-report` email failing with:
```
Email API error: 400 {"type":"missing_unsubscribe","message":"Transactional emails must include an unsubscribe_token"}
```

The `send-inspection-email` Edge Function enqueues emails directly into the `transactional_emails` pgmq queue with a raw payload (lines 87-105). It bypasses `send-transactional-email`, which normally handles unsubscribe token generation. The `process-email-queue` dispatcher then tries to send the raw payload to the Lovable Email API, which rejects it because no `unsubscribe_token` is present.

Additionally, Lovable's email infrastructure does **not support file attachments**. The `attachments` field in the payload (lines 98-104) is silently ignored by the API — there is no attachment support in the sending pipeline.

**Fix**: Stop using `send-inspection-email` entirely. Instead, use a download-link workaround:
1. Upload the PDF to Supabase Storage
2. Generate a signed URL
3. Send the email via `send-transactional-email` with a template that includes a "Download Report" button linking to the signed URL
4. Create a new `inspection-report` template in the transactional email templates
5. Delete the `send-inspection-email` Edge Function

---

## Issue 2: PM PORTAL — NOTES AND PHOTOS SEPARATED FROM ITEMS

**Root cause: `PMPortal.tsx` renders photos/notes in one loop (lines 359-383) and items in a separate loop (lines 386-423).**

The current rendering structure is:
1. First loop: `areas.map()` → renders photos and tech notes per area (lines 359-383)
2. Second loop: `Object.entries(itemsByArea).map()` → renders items per area (lines 386-423)

This means photos/notes appear as a block at the top, then items appear below — not grouped together per area.

**Fix**: Merge both loops into a single per-area rendering block:
- Area header
- Items for that area (with checkboxes, price, quantity)
- Technician note for that area
- Photos for that area

---

## Issue 3: PDF BLACK BACKGROUND AND INCOMPLETE

**Root cause: `inspectionPdf.ts` uses `DARK_BG [26,26,26]` as the page background (line 67) and white text throughout.**

The `addPageBackground()` function (lines 66-69) fills the entire page with near-black. All text is set to `WHITE [255,255,255]`. This produces a dark-themed PDF matching the app's dark UI, but PDFs should be white-background for printing and professional use.

Additionally:
- No FiveServ wordmark in the header — just plain text "FiveServ Inspection Report"
- No footer tagline "One Team. One Call. Done."
- Photos are not included in the PDF at all — `generateFiveServPdf` only renders items and notes, never fetches or embeds photos

**Fix**:
1. Change background to white, text to dark colors
2. Add FiveServ wordmark in header: "F" in gold #FFD700, "iveServ" in black
3. Add footer tagline "One Team. One Call. Done."
4. Accept photo data (signed URLs or base64) and embed photos in the PDF per area using `doc.addImage()`
5. Ensure all areas, items, notes, and photos are included

---

## Issue 4: NO "ADD CUSTOM ITEM" BUTTON DURING INSPECTION

**Root cause: `AreaInspection.tsx` only renders pre-defined items from `buildAreas()`. There is no UI or logic to add custom items.**

The component loads items from `buildAreas()` (line 58-66) which returns a fixed list per area. There is no "Add Item" button, no input field for custom item names, and no handler to insert a new item into the `items` state or the `inspection_items` table.

**Fix**: Add an "Add Item" button below the items list that:
1. Toggles an input field for the custom item name
2. On submit, appends a new `AreaItemState` to `items[currentArea.key]` with status `good`
3. The item is saved to `inspection_items` during `autoSave()` like all other items

---

## Issue 5: UNIT PRICE FIELD — ZERO NOT CLEARING ON TYPE

**Root cause: `PricingReview.tsx` uses a standard `<Input type="number" value={item.unit_price ?? 0}>` which keeps the "0" in the field.**

When `unit_price` is `0` or `null`, the input shows "0". HTML number inputs don't auto-clear on focus — the user must manually select and delete. The field needs an `onFocus` handler to clear the value when it's 0, or use a controlled string state that shows empty string instead of "0".

**Fix**: Change the `value` to show empty string when `unit_price` is `0` or `null`, and add `onFocus` to select all text so typing replaces it immediately.

---

## Summary

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | Emails failing | Missing `unsubscribe_token` + unsupported attachments | Use `send-transactional-email` with download link instead |
| 2 | PM portal layout | Photos/notes rendered in separate loop from items | Merge into single per-area block |
| 3 | PDF black background | `addPageBackground()` fills dark bg, no photos/wordmark | White bg, add wordmark, footer, photos |
| 4 | No Add Item button | Only pre-defined items rendered, no custom add UI | Add button + input + save logic |
| 5 | Price zero not clearing | `value={0}` stays in input on focus | Show empty string when 0, select on focus |

## Files to Change

1. **Issue 1**: Delete `send-inspection-email/`, create `inspection-report` template, update `InspectionDetail.tsx` email flow to upload PDF to storage + use `send-transactional-email` with download link
2. **Issue 2**: Refactor `PMPortal.tsx` render to single per-area loop
3. **Issue 3**: Rewrite `inspectionPdf.ts` with white bg, wordmark, footer, photo embedding
4. **Issue 4**: Add custom item UI + logic to `AreaInspection.tsx`
5. **Issue 5**: Fix `unit_price` input in `PricingReview.tsx`

