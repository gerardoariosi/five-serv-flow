# Inspection Item Flow — 7 Enhancements

Scope: `src/pages/inspections/AreaInspection.tsx` and the `inspection_items` / `inspection_photos` schema. Config, Pricing Review, and Sent steps stay untouched.

## Step 1 — Database migration (additive, all nullable)

`inspection_items`:
- `priority text` — nullable, allowed values `low | medium | high` (CHECK constraint). Only set when status is `needs_repair` or `urgent`.
- Keep existing `status text` column; expand allowed values to `good | needs_repair | urgent | na`.

`inspection_photos`:
- `item_id uuid` — nullable FK to `inspection_items(id) ON DELETE CASCADE`. NULL = area-level (existing behavior).
- `marker_x numeric` — nullable, 0–1.
- `marker_y numeric` — nullable, 0–1.
- `marker_note text` — nullable, short.

`inspection_tickets` / `tickets`: no schema change. When a ticket is created from an inspection item, copy the item's `priority` into the ticket's existing `priority` column.

Indexes: `create index on inspection_photos(item_id) where item_id is not null;`

All new columns nullable — zero impact on existing rows.

## Step 2 — Status: add N/A (4 options)

In `AreaInspection.tsx`:
- Add fourth button `N/A` alongside Good / Repair / Urgent using the existing 3-button style, muted/gray tone (`bg-secondary` when active, `text-muted-foreground`).
- Extend `ItemStatus` type to `'good' | 'needs_repair' | 'urgent' | 'na'`.
- When switching to `na`, clear `item_note`, clear `priority`, and mark associated item-level photos for deletion on save (or block adding them).
- Visually distinct row for N/A: reduce opacity (`opacity-60`), muted label.
- Update `hasRepairOrUrgent` to ignore N/A (already does by construction).

## Step 3 — Mandatory item-level photo when Repair/Urgent

Extend the photo model:
- Item-level photos live in the same `inspection_photos` table with `item_id` set.
- In `AreaInspection.tsx`, render a per-item photo strip below each item card when status is `needs_repair` or `urgent`. Reuse the existing upload label + compressImage flow, scoped to that item.
- New gating: `itemPhotoReq = currentItems.every(i => i.status === 'good' || i.status === 'na' || itemPhotos[i.dbId]?.length >= 1)`.
- Update the "Next" disabled condition: `!photosEnough || !itemPhotoReq`.
- Show per-item warning "Photo required" in destructive tone (same style as the existing area-level "Need N more").
- Area-level photo strip and its `minPhotos` logic remain untouched.

## Step 4 — Optional pin annotation on item photos

- New tiny component `PhotoMarkerDialog` opened when the user taps an item photo thumbnail.
- Dialog shows the full image; click/tap records normalized coords (`x = e.offsetX / rect.width`, `y = e.offsetY / rect.height`). Optional text input for `marker_note`.
- Save updates `inspection_photos` row (`marker_x`, `marker_y`, `marker_note`). Clearing = set all three to null.
- Thumbnail overlays a small gold dot at the stored coords when a marker exists.
- Area-level photos are excluded from this UI (only item photos get the marker affordance) to keep scope tight.

## Step 5 — "Last time" reference (most recent prior inspection only)

- On area load, run one extra query: fetch the most recent inspection for the same `property_id` where `id != current` and status in (`complete`, `converted`, `closed_internally`, `sent`, `pm_responded`, `estimate_approved`), ordered `created_at desc limit 1`. Then fetch its `inspection_items` in one call.
- Build a `Map<item_name, priorItem>` scoped to that single inspection.
- Under each current item, render a collapsed line: `Last time: {StatusLabel} — {formatted date}` with a chevron. Expanded shows prior `item_note` and, if any, prior item-level photo thumbnails (signed URLs on demand).
- Collapsed by default. Hidden when no prior match exists. No history beyond that single prior inspection.

## Step 6 — Priority (Low / Medium / High)

- In each item card, when status is `needs_repair` or `urgent`, render a 3-button segmented control (Low / Medium / High) below the note field, using the existing button style pattern. Default = `medium` when the user first flips to Repair/Urgent; user can change or clear.
- Hidden for Good and N/A. Cleared automatically when status leaves Repair/Urgent.
- Persisted on `inspection_items.priority` in the existing `autoSave` loop.
- Ticket generation path in `InspectionDetail.tsx` (line 250) updated to also insert `priority: item.priority ?? 'medium'` into the ticket. This is the only edit outside `AreaInspection.tsx` for this feature.

## Step 7 — No canned chips

Explicit non-goal. Note textarea stays exactly as-is.

## Files touched

- `supabase/migrations/*` — additive columns + FK + index.
- `src/pages/inspections/AreaInspection.tsx` — UI + save logic for statuses, item photos, markers, priority, prior reference.
- `src/components/inspections/PhotoMarkerDialog.tsx` — new small component.
- `src/pages/inspections/InspectionDetail.tsx` — one-line change to pass `priority` when creating tickets from items.
- `src/integrations/supabase/types.ts` — regenerated after migration.

Not touched: `CreateInspection.tsx`, `PricingReview.tsx`, `PMPortal.tsx`, `reportPdf.ts`, Sent flow.

## Risks & mitigations

- **Pricing Review query** filters `status in ('needs_repair','urgent')` — N/A rows are naturally excluded, no change needed. Verified in `PricingReview.tsx:39`.
- **PMPortal** reads items and shows repair/urgent groupings; N/A rows will be filtered out client-side the same way (verify at implementation time).
- **PDF report** (`reportPdf.ts`) — need a quick verification it doesn't render "na" as a raw string label. If it does, add `na → N/A` mapping only. No structural change.
- **Existing rows** have no `priority`, no `item_id` photos, no markers — all nullable, so historical inspections render exactly as before.
- **Storage cost** — item-level photos add rows but reuse the same bucket and compression path; negligible.
- **Photo delete when switching to Good/N/A** — item photos need cleanup rules. Proposed: keep them on disk but hide from UI; only hard-delete when the user explicitly removes them (safe default, avoids accidental data loss).
- **Ticket priority column** — must confirm `tickets.priority` exists and accepts `low|medium|high`. If it doesn't, this becomes a second (tiny) migration; will confirm during implementation before editing `InspectionDetail.tsx`.

Reply "go" to proceed, or tell me what to adjust.
