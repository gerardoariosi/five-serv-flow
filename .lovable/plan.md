# Plan: Professional Light Theme Across the App

## Goal
Make every authenticated screen match the clean, professional light aesthetic of the redesigned Login page, using the warm off-white background (`#FAF9F6`), warm gray panels (`#F3F2EE`), charcoal text (`#1A1A1A`), and gold accents (`#FFD700`).

## What we will change

### 1. Theme foundation
- Switch the default theme from dark to light in `src/stores/themeStore.ts`.
- Update `src/index.css` so the `:root` (default) palette matches the login:
  - `background`: `#FAF9F6`
  - `card`: `#FFFFFF`
  - `secondary` / `muted`: `#F3F2EE`
  - `border` / `input`: `#E5E5E1`
  - `foreground`: `#1A1A1A`
  - `muted-foreground`: `#6B6B6B`
  - Keep primary as gold (`#FFD700`) and destructive as red.
- Keep the `.dark` class available for users who still want dark mode, but the app will open in light mode by default.

### 2. Global chrome
- `AppLayout.tsx`: set page background to `bg-background` (warm off-white).
- `TopNav.tsx`:
  - Remove the thick gold bottom border; replace with a subtle `border-b border-border`.
  - Use the official FiveServ wordmark (charcoal + gold) instead of the inline `F`/`iveServ` span.
  - Keep role badge, notifications, avatar, and theme toggle.
- `DrawerMenu.tsx`:
  - Background: white card with subtle right border.
  - Active item: warm gray background (`#F3F2EE`) + gold left accent, instead of gold-filled pill.
  - Icons: charcoal when inactive, gold when active.
  - Profile header: cleaner spacing, role badge in charcoal/gold.
- `MobileBottomNav.tsx`:
  - White background, subtle top border, gold active indicator.

### 3. Dashboard redesign
- Page background: warm off-white.
- Metric cards: white cards with soft shadow, colored top/left border accents preserved.
- Search + filter chips: white input, gold ring on focus, chips with light gray inactive / gold active.
- Ticket / inspection cards: white cards, subtle left border by work type, clean 2-line layout preserved.
- Quick-create modal: white dialog with gold focus rings.

### 4. List pages
Apply the same card/input styling to:
- `TicketList.tsx`
- `InspectionList.tsx`
- `ClientList.tsx`
- `PropertyList.tsx`
- `ZoneList.tsx`
- `TechnicianList.tsx`
- `AccountingList.tsx`

Changes per page:
- Page background `bg-background`.
- Cards: white with soft shadow and subtle border.
- Search/filter inputs: white with gold focus ring.
- Status pills and work-type badges keep their semantic colors but render on light backgrounds.
- Bulk select checkboxes use the login checkbox style (charcoal checked state).

### 5. Detail & form pages
- `TicketDetail.tsx`, `TicketForm.tsx`
- `InspectionDetail.tsx`, `CreateInspection.tsx`
- `ClientDetail.tsx`, `PropertyDetail.tsx`, etc.

Changes:
- White cards, warm gray section backgrounds, charcoal headings.
- Inputs: white background, `#E5E3DE` border, gold focus ring.
- Primary CTA buttons: charcoal (`#1A1A1A`) with white text + gold hover accents, matching the login "Sign in" button.
- Secondary buttons: light gray background.

### 6. Shared UI primitives
- `EmptyState.tsx`, `SkeletonCard.tsx`, `StatusPill.tsx`, `BulkActionBar.tsx`, `BulkDeleteDialog.tsx`: adapt to light theme while keeping current shapes.
- `input`, `button`, `dialog`, `select`, `textarea` shadcn components already use CSS variables, so they will inherit the new palette once variables are updated.

### 7. Auth pages
- `Login.tsx` is already done.
- Apply the same light styling to `VerifyTwoFactor.tsx`, `ForgotPassword.tsx`, and any other auth flow screens.

### 8. Cleanup
- Remove hardcoded dark backgrounds (`bg-[#1A1A1A]`, `bg-black`, etc.) in favor of semantic tokens.
- Verify no text becomes unreadable (e.g., gold text on white backgrounds).
- Run a build check and capture screenshots of Dashboard, a list page, and a detail page.

## What we will NOT change
- App functionality, routes, role gating, or business logic.
- Supabase schema or security rules.
- The structure of pages; only colors, spacing, shadows, and borders.

## Open question before we start
1. **Theme toggle:** Do you want to keep the dark/light toggle in the top bar, or remove it and force the new professional light theme everywhere?
2. **Scope priority:** Should we implement all pages in one pass, or would you prefer to start with the global shell + Dashboard + Ticket pages first, then continue with the rest?

Please confirm and we will implement.