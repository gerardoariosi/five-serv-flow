

# Analysis: 4 New Features

## Feature 1: Multi-Photo Upload in Inspections

**Current state**: `AreaInspection.tsx` line 342 — `<input type="file" accept="image/*">` with no `multiple` attribute. `handlePhotoUpload` (line 152) processes only `e.target.files[0]` — a single file.

**What needs to change**:
- Add `multiple` to the file input
- Rewrite `handlePhotoUpload` to loop through all `e.target.files`, uploading each to storage and inserting into `inspection_photos`
- Add progress state: `uploadProgress: { current: number; total: number } | null`
- Show "Uploading 2 of 5..." text in the upload label area while batch is in progress
- Disable the upload button and navigation (Back/Next) during batch upload

**Files**: `src/pages/inspections/AreaInspection.tsx`

---

## Feature 2: Per-Item Notes on Repair/Urgent Items

**Current state**: `AreaInspection.tsx` renders item cards (lines 258-280) with Good/Repair/Urgent buttons but no per-item note field. The `AreaItemState` interface has no `note` field. Area-level notes exist separately (line 362). The `inspection_items` table has a `note` column but it's used for the area-wide note (line 138: `note: notes[currentArea.key]`).

**What needs to change**:

1. **Database**: Add `item_note` column to `inspection_items` (the existing `note` column stores area notes — keep it separate)
2. **AreaItemState interface**: Add `item_note?: string` field
3. **AreaInspection.tsx**: When status is `needs_repair` or `urgent`, render a `<Textarea>` below the item card for per-item note. Load/save `item_note` in `autoSave()`.
4. **PMPortal.tsx**: Display `item_note` alongside each repair/urgent item
5. **InspectionDetail.tsx**: Show `item_note` in the internal view per item
6. **inspectionPdf.ts**: Include `item_note` in PDF output per item
7. **Ticket conversion** (ties into Feature 3): Include `item_note` in ticket description

**Files**: Migration for `item_note` column, `AreaInspection.tsx`, `PMPortal.tsx`, `InspectionDetail.tsx`, `inspectionPdf.ts`

---

## Feature 3: Manual Ticket Conversion Pre-filled with PM Data

**Current state**: `InspectionDetail.tsx` lines 100-129 — `handleConvertToTickets` creates a ticket with:
- `work_type: 'repair'` (hardcoded)
- `description`: just item names joined by commas
- No PM notes, no per-item notes, no PM-approved total reference
- No urgency-based work_type logic

**What needs to change**:

1. **Description**: Build from PM-selected items with their `item_note` and `pm_note`, grouped by area
2. **work_type**: If any selected item is `urgent` → `emergency`; otherwise `repair`. Admin can still change after creation.
3. **internal_note**: Include PM-approved total as reference (e.g., "PM approved total: $X,XXX")
4. **Convert modal UI**: Show PM-selected items by default (pre-check `pm_selected` items). Show item notes and PM notes alongside each item in the selection list. Show the PM-approved total at the bottom.

**Files**: `src/pages/inspections/InspectionDetail.tsx`

---

## Feature 4: Profile Photo in Top Nav

**Current state**: `TopNav.tsx` has hamburger (left), wordmark (center), role badge + theme toggle + notification bell (right). No profile photo or dropdown. Profile photos upload to `profile-photos` bucket (public) at path `{user.id}/avatar.{ext}`.

**What needs to change**:

1. **TopNav.tsx**: After NotificationDropdown, add an Avatar with:
   - Image from `profile-photos` bucket: `supabase.storage.from('profile-photos').getPublicUrl('{user.id}/avatar...')`
   - Fallback: user initials in a circle
   - Wrapped in a Popover or DropdownMenu with three items: "View Profile" → `/profile`, "My Settings" → `/settings`, "Logout" → calls `signOut()`
2. **Auth store**: The `UserProfile` interface doesn't include `avatar_url`. Either fetch the public URL on login or compute it from `user.id` at render time. Computing at render time is simpler since the bucket is public and the path is deterministic (`{user.id}/avatar.*`). However the extension is unknown — better to store `avatar_url` on the users table or try a known path.
3. **Approach**: Since `profile-photos` is public and the upload path is `{user.id}/avatar.{ext}`, store the storage path in the `users` table (add `avatar_path` column) so TopNav can build the public URL. Or simpler: just try the public URL pattern and show initials on error.

**Simplest approach**: No DB change needed. Use `supabase.storage.from('profile-photos').getPublicUrl(`${user.id}/avatar`)` won't work without the extension. Better: add `avatar_url` to the `users` table, set it during photo upload in Profile.tsx, and read it in TopNav.

**Files**: Migration for `avatar_url` column on `users`, `src/pages/Profile.tsx` (save URL on upload), `src/stores/authStore.ts` (add `avatar_url` to UserProfile), `src/hooks/useAuth.ts` (fetch `avatar_url`), `src/components/layout/TopNav.tsx` (Avatar + dropdown)

---

## Summary

| # | Feature | Key Changes |
|---|---------|------------|
| 1 | Multi-photo upload | Add `multiple` to input, batch loop, progress indicator |
| 2 | Per-item notes | Add `item_note` column, show textarea on repair/urgent, propagate to PM portal + PDF |
| 3 | Ticket conversion pre-fill | Build description from PM data, auto-set work_type by urgency, show PM total |
| 4 | Profile photo in nav | Add `avatar_url` to users table + auth store, Avatar + dropdown in TopNav |

## Files to Change

1. **Feature 1**: `src/pages/inspections/AreaInspection.tsx`
2. **Feature 2**: DB migration (`item_note`), `AreaInspection.tsx`, `PMPortal.tsx`, `InspectionDetail.tsx`, `inspectionPdf.ts`
3. **Feature 3**: `src/pages/inspections/InspectionDetail.tsx`
4. **Feature 4**: DB migration (`avatar_url`), `Profile.tsx`, `authStore.ts`, `useAuth.ts`, `TopNav.tsx`

