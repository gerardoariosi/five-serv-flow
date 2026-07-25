
# Shared Detail-Page Redesign — Client, Property, Vendor

## Research summary (applied)

From Linear, Attio, Stripe, HubSpot, Notion, and Height, the strongest common threads for record/detail pages are:

- **Compact identity header** — 36px logo/initials + name + one muted subline + inline status pill; no hero.
- **Metadata as label/value rows**, not stat cards. Groups separated by a hairline + small section label — this is the single biggest fix for the "wall of identical white cards" feeling.
- **Off-white app bg + pure-white surfaces + 1px low-opacity borders + no shadows on static panels.** This is what reads as "premium" vs. "generic admin."
- **Empty state = dashed-border block** (~120px), tiny icon, one CTA, kept the same height whether populated or not, so pages don't jump.
- **Sub-sections behind tabs** when they're large repeating datasets (Documents, Payments, Related records); metadata itself stays flowing.
- **One accent color** (FiveServ gold) reserved for primary buttons, active tab indicator, and links only. Status uses muted pastel pills.
- **Empty editable field** → dashed-underline "Add …" ghost link (turns gaps into affordances). Read-only empty → `—`.

## Design direction for FiveServ

Mobile-first single column across all three detail pages, always in this exact vertical order:

```text
┌────────────────────────────────────────────┐
│ ← chevron                                  │  top bar (unchanged)
├────────────────────────────────────────────┤
│ [avatar] Name              [status pill]   │  identity block
│         one muted subline                  │
├────────────────────────────────────────────┤
│ [Primary CTA] [icon] [icon]        [⋯]     │  actions row
├────────────────────────────────────────────┤
│ SECTION LABEL                              │
│ label            value                     │  metadata group 1
│ label            value                     │
│ ──────────────  hairline  ──────────────   │
│ SECTION LABEL                              │
│ label            value                     │  metadata group 2
│                                            │
├────────────────────────────────────────────┤
│ [Tab] [Tab] [Tab] [Tab]                    │  sub-sections
│                                            │
│  ...content or dashed empty block...       │
└────────────────────────────────────────────┘
```

## Shared building blocks (new components)

Create in `src/components/detail/` so all three pages compose the same primitives:

1. **`DetailHeader`** — avatar/icon slot, name, subline, status pill slot, actions slot. Handles back chevron. ~64px tall on mobile.
2. **`DetailActions`** — 1 primary button + up to 3 icon-ghost buttons + optional overflow `DropdownMenu`. Role-gated buttons simply aren't passed in.
3. **`FieldGroup`** — takes a group label + children (rows). Renders label (`text-xs font-semibold text-muted-foreground mb-2`) and a top hairline (`border-t border-border/60`) except for the first group in the page.
4. **`FieldRow`** — `grid grid-cols-[110px_1fr] gap-3 py-1.5`, label left (`text-xs text-muted-foreground`), value right (`text-sm text-foreground`). Empty read-only → `—`. Empty editable (`editHref` prop) → dashed-underline ghost link.
5. **`SectionTabs`** — thin underline tabs, horizontally scrollable on overflow, 44px tap targets. Reuses shadcn Tabs internally.
6. **`EmptyBlock`** — dashed-border container, icon, primary line, muted subline, optional small outline CTA. ~120–140px min-height so populated/empty don't jump.
7. **`StatusPill`** — one component, variants: `success` (green pastel), `neutral` (gray), `warning` (amber), `danger` (red). All muted, never saturated.

No new color tokens required — the existing off-white `--background`, pure-white `--card`, warm gray `--border`, and gold `--primary` already match the direction. The redesign will remove ad-hoc `bg-card border border-border rounded-lg` wrappers wherever a `FieldGroup` replaces them.

## Per-page application

### ClientDetail.tsx

- Header: `Building2` icon in a tinted-gold square (36px) · `company_name` · subline = `contact_name` + property count + "Client since {year}". Status pill: `type` (Property Manager / Residential). Referred-by and lead-source move out of the header into a **"Source"** field group.
- Actions: primary = "Add Property" (admin/supervisor); ghost = Email, Call (only when contact info exists); overflow = "Import Properties (CSV)", Edit, Deactivate.
- Field groups (replace the current single big header card):
  - **Contact** — Contact name, Email, Phone
  - **Source** — Type, Referred by, Lead source
- Sub-sections (keep the current 3–4 tabs, restyled): Properties · Tickets · Inspections · Internal Notes (role-gated).
- Empty states inside each tab replaced with `EmptyBlock` (icon + "No properties yet" + role-gated "Add Property" outline button).

### PropertyDetail.tsx

- Header: `MapPin` in tinted square · `formatAddress(property)` as the name (fallback to `name`) · subline = zone + PM name. Status pill: none by default; if `pm_changed_at` recent → amber "PM changed" pill.
- Actions: primary = "New Ticket"; ghost = "New Inspection", "Directions" (opens maps link that's currently inline in the header). Overflow = Edit, and Admin-only Delete.
- Field groups:
  - **Location** — Street, City/State/Zip, Zone, Directions link
  - **Property Management** — Current PM, Previous PM + change date (when present)
  - **Tenant** (admin/supervisor only, replaces the current collapsible "Property Notes" panel) — Tenant name, Tenant phone, General notes (inline-editable via existing upsert; keeps existing "Last updated" caption). This is a `FieldGroup` with inline `Input`/`Textarea` values instead of the current separate accordion card.
- Sub-sections (tabs unchanged): Active Tickets · History · Inspections. Empty states replaced with `EmptyBlock`.
- `PropertyDocumentsSections` (Gallery / Estimates & Invoices) stays as-is below the tabs but wrapped in `FieldGroup` styling for visual consistency (label + hairline, no extra card).

### VendorDetail.tsx

- Header: company logo slot (fallback: initials tinted-gold square) · `company_name` · subline = `contact_name` + specialties count. Status pill: Active/Archived, plus license/insurance expiring/expired pills relocated inline into the status area.
- Actions: primary = admin-only "Add Payment" when Payments tab is active, otherwise "Upload Document"; ghost = Email, Call; overflow = Edit, Archive.
- Field groups (replace the current 2-col grid card):
  - **Contact** — Phone, Email
  - **Compliance** — License #, License expiration, Insurance info, Insurance expiration
  - **Specialties** — chips (kept as-is inside the group)
  - **Notes** — plain text block
- Sub-sections become tabs: **Documents · Payments**. This replaces the current two stacked sections. Payments tab keeps the existing Balance / Total Paid summary strip *inside* the tab (two `FieldRow`-style tiles, no border) and the payments list, `AddVendorPaymentDialog`, and `MarkPaidDialog` wiring is untouched. `ProofLink` behavior unchanged.

## What stays the same (non-goals)

- All queries, mutations, RLS, role gating logic, and the underlying data model.
- All dialogs (`ImportPropertiesDialog`, `AddVendorPaymentDialog`, `MarkPaidDialog`, upload dialog).
- `PropertyDocumentsSections` internal behavior.
- Routing (`/edit` still opens the form pages).
- No color-token changes to `index.css`; palette already fits.

## Technical notes

- New primitives are dumb presentational components — no data-fetching, no store access — so the three page files stay thin.
- Detail pages will import from `@/components/detail/*` and drop most of their hand-rolled card markup. The three files should shrink to ~150–200 lines each.
- Tabs used only when there are ≥2 sub-datasets; single-dataset pages (unlikely here) would render inline.
- Mobile-first: no two-column layout is added. Desktop will simply center the content column at `max-w-3xl mx-auto`.
- Accessibility: `FieldRow` uses `<dl>/<dt>/<dd>` semantics; `EmptyBlock` uses `role="status"`; tabs come from shadcn Tabs so keyboard nav is preserved.

## Implementation order (when approved)

1. Create the 7 shared primitives in `src/components/detail/` with Storybook-free but exportable API.
2. Refactor `VendorDetail.tsx` first (biggest file, exercises every primitive including tabs + dashed empty + status pills).
3. Refactor `PropertyDetail.tsx` (adds the inline-editable Tenant group pattern).
4. Refactor `ClientDetail.tsx` (simplest, mostly tabs + one contact group).
5. Manual pass: verify role-gating removes actions cleanly, and that mobile viewports at 375px still fit without horizontal scroll.

No database migration, no route change, no store change.
