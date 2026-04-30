# Help Center — Implementation Plan

Build a complete, public, searchable Help Center for FiveServ Operations, with all content provided, plus entry points from the Login page and the navigation drawer.

## 1. New page — `src/pages/HelpCenter.tsx`

A single self-contained page (route `/help`, public, no auth) using the existing dark-mode design tokens (`bg-background`, `text-foreground`, `text-primary` for gold, `bg-card`, `border-border`, `text-muted-foreground`, `fs-card`, `fs-section-title`, etc.) and the existing shadcn components: `Card`, `Input`, `Button`, `Badge`, `Collapsible` (`CollapsibleTrigger`, `CollapsibleContent`), `Accordion` from `@/components/ui/accordion`, plus `lucide-react` icons.

### Layout

```text
┌────────────────────────────────────────────────────────────┐
│ Sticky top bar: FiveServ wordmark · "Help Center"  · Back  │
├────────────────────────────────────────────────────────────┤
│ Hero: title + subtitle + Search input (with /Search icon)  │
│       Breadcrumb: Help Center › <current section>          │
├──────────────┬─────────────────────────────────────────────┤
│ Sidebar      │ Content                                     │
│ (sticky,     │  - Section header (gold number badge)       │
│  desktop ≥md)│  - Articles (cards) with steps, tips, notes │
│ Section list │  - FAQ accordion at bottom                  │
│ active = gold│                                             │
│ left border  │                                             │
└──────────────┴─────────────────────────────────────────────┘
                                  Floating "Back to top" (gold, after scroll>400px)
```

- **Desktop (≥ md):** two-column grid `md:grid-cols-[240px_1fr]` with sticky sidebar (`sticky top-20`).
- **Mobile (< md):** sidebar replaced by a `Collapsible` "Browse sections" panel. Each section is a `Collapsible` so subsections accordion in/out.

### Content data structure

A single in-file constant `HELP_SECTIONS` with the full content from the prompt (Sections 1–6, all articles 1.1 → 6.4). Each article has: `id`, `title`, `kind` ("steps" | "prose" | "list"), `body` (string[] for steps, string for prose, `{label, description}[]` for definition lists), optional `tip` and `note`.

A second constant `FAQS` with the 7 Q&A items.

### Search behavior

- Controlled `query` state; trimmed lowercase.
- `useMemo`-filtered sections: an article matches if its title OR any body line OR tip/note contains the query. A section is shown if any of its articles match (or the section title matches). FAQ filtered the same way.
- Matching substrings highlighted with a `<mark>` styled `bg-primary/30 text-foreground rounded px-0.5` via a small `Highlight` component.
- Empty state: card with `"No results for "<query>" — Contact your Admin if you need more help."` plus a button linking to `mailto:` (placeholder) — actually we'll just show muted text per spec. Use existing `EmptyState` component if convenient; otherwise plain card to match prompt copy exactly.

### Behaviors

- Smooth scroll on sidebar click: `document.getElementById(id)?.scrollIntoView({behavior: 'smooth', block: 'start'})`.
- Active section tracking via `IntersectionObserver` on each section heading; highlights the matching sidebar item with `border-l-2 border-primary pl-[10px] text-foreground`.
- Breadcrumb shows `Help Center › {activeSectionTitle}`.
- Back-to-top button: appears when `window.scrollY > 400`; fixed bottom-right, gold circular button (`bg-primary text-primary-foreground rounded-full h-11 w-11 shadow-[var(--gold-glow)]`).
- Inline anchor on each article (id = `article-2-3` style) for deep linking via hash.
- "Tip:" rendered in a callout: `bg-primary/10 border-l-2 border-primary text-foreground/90 text-sm p-3 rounded-r`.
- "Note:" rendered the same way but with `border-amber-500/70 bg-amber-500/10`.
- Section number badge: small `Badge` with `bg-primary text-primary-foreground` showing `1`, `2`, etc. Article number badge: muted `1.1`, `1.2` chip in `text-primary` on `bg-primary/10`.

### Content audit fixes vs. real codebase

While writing the content, auto-correct these wording mismatches I confirmed against the routes/menu:

- "Click Tickets in the navigation menu" — accurate (DrawerMenu has Tickets).
- "Go to Settings → User Management" — accurate (`/settings/users`).
- Technician menu: replace generic "Dashboard" wording in 4.1 with **"My Work"** (`/my-work`) since that is the real technician landing page in the drawer.
- Calendar: technicians have **"My Calendar"** (`/my-calendar`); preserve as-is in 4.1.
- "Active Role at the bottom of the menu" (article 6.4) — drawer actually shows a **"Switch Role" chip group near the top** (visible only when user has multiple roles). Update wording to: *"Open the navigation menu and use the **Switch Role** chips at the top to switch between your assigned roles. The Dashboard and menu update automatically. You can also change your active role from your Profile page."*
- "Quick Ticket button (gold + floating button on Dashboard)" (article 2.4): keep, matches existing FAB pattern.
- Inspection PDF export wording (3.6): keep both options ("Internal Report" / "PM Version") — matches `inspectionPdf.ts`.
- Add a small "Estimate / PM Approval Portals" mention under section 3.5 noting the same mechanism is used for the Estimate Portal in tickets (since `EstimatePortal.tsx` exists).

No other content changes — all article steps and FAQ entries kept verbatim.

## 2. Login page entry point — `src/pages/Login.tsx`

Add a small link below the **Sign In** button (above or alongside the existing "Forgot Password?" link) inside the same centered footer area:

```tsx
<Link to="/help" className="block mt-3 text-sm text-muted-foreground hover:text-foreground">
  Help Center
</Link>
```

No other Login changes.

## 3. Drawer entry point — `src/components/layout/DrawerMenu.tsx`

- Import `HelpCircle` from `lucide-react`.
- Add a new group at the very bottom of every role's `navGroupsByRole` array (admin, supervisor, technician, accounting):

```ts
{ title: 'SUPPORT', items: [
  { label: 'Help Center', icon: HelpCircle, path: '/help', color: 'text-muted-foreground' },
]},
```

This re-uses the existing nav rendering and active-state styling, keeps the "available to all roles" requirement, and matches the design system.

## 4. Routing — `src/App.tsx`

Add a public route alongside the other public ones (next to `/portal/:token`):

```tsx
<Route path="/help" element={<HelpCenter />} />
```

Plus the import `import HelpCenter from "./pages/HelpCenter";`.

## Design constraints honored

- Dark + light mode automatic via existing CSS variables; no hard-coded colors except `text-primary` (gold) which is already the brand token.
- Only existing UI primitives used: `Card`, `Input`, `Button`, `Badge`, `Collapsible`, `Accordion`, `Separator`. No new dependencies.
- Spacing/typography classes mirror existing pages (e.g. `fs-page-title`, `fs-section-title`, `fs-card`).
- Page works without the `AppLayout` (so it's accessible while logged out) — it owns its own minimal sticky header that links back to `/login` if unauthenticated, or to `/dashboard` if `useAuthStore().user` exists.

## Files touched

- **Add:** `src/pages/HelpCenter.tsx`
- **Edit:** `src/App.tsx` (import + route)
- **Edit:** `src/pages/Login.tsx` (Help Center link)
- **Edit:** `src/components/layout/DrawerMenu.tsx` (Support → Help Center entry on every role)

No DB, edge function, or backend changes required.