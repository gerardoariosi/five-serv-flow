## Goal

Replace the substring-matching search in `src/pages/HelpCenter.tsx` with weighted fuzzy search using `fuse.js`, so users can find articles even when wording doesn't match exactly (e.g. "create job" → "How to Create a Ticket"). Existing UI, highlight rendering, and all other behavior stay identical.

## Changes

### 1. Add dependency
- Install `fuse.js` (not currently in `package.json`).

### 2. `src/pages/HelpCenter.tsx`

**Build searchable indexes (module scope, computed once):**
- Flatten `HELP_SECTIONS` into a list of `{ sectionId, article, title, body, tip, note }` records, where `body` is normalized to a single string:
  - `string` → as-is
  - `string[]` → joined with `\n`
  - `DefItem[]` → `label + ' ' + description` joined with `\n`
- Create two Fuse instances:
  - **Articles Fuse** — keys: `[{ name: 'title', weight: 0.4 }, { name: 'body', weight: 0.4 }, { name: 'tip', weight: 0.1 }, { name: 'note', weight: 0.1 }]`
  - **FAQ Fuse** — keys: `[{ name: 'q', weight: 0.5 }, { name: 'a', weight: 0.5 }]`
- Shared options: `threshold: 0.4`, `includeMatches: true`, `minMatchCharLength: 2`, `ignoreLocation: true` (so matches work anywhere in the field).

**Replace `articleMatches` + `filteredSections` / `filteredFaqs` logic:**
- When `q.length < 2` → return original `HELP_SECTIONS` / `FAQS` unchanged (preserves "no query" behavior; avoids Fuse running on 1 char).
- When `q.length >= 2`:
  - Run `articlesFuse.search(q)` → collect matched article ids → rebuild `filteredSections` preserving original section order and original article order, keeping only matched articles, dropping empty sections.
  - Run `faqsFuse.search(q)` → rebuild `filteredFaqs` preserving original order.

**Highlighting (keep visual behavior, make it fuzzy-aware):**
- Keep `<Highlight>` component signature `({ text, query })` so all existing call sites work unchanged.
- Update its internals: if `query` has length ≥ 2, split `text` on a case-insensitive regex of escaped `query`; if no substring match (common with fuzzy hits), also try highlighting each whitespace-separated token of length ≥ 2. Render matches inside the existing `<mark className="bg-primary/30 text-foreground rounded px-0.5">`.
- This preserves the current look and gracefully handles fuzzy results where the exact query string isn't present.

**Untouched:**
- All content (`HELP_SECTIONS`, `FAQS`).
- Layout, sidebar, scroll-spy, breadcrumbs, back-to-top, Login / DrawerMenu entry points.
- Light/white styling and gold accents.

### Technical notes
- Fuse instances are created at module scope (outside the component) so they're built once, not on every render.
- `ignoreLocation: true` is added because article bodies are long; without it Fuse heavily penalizes matches far from the start of the string and "forgot password" wouldn't reliably hit the reset-password article.
- Article matching is by stable `article.id` to avoid duplicate-title collisions.

## Files
- `package.json` — add `fuse.js`
- `src/pages/HelpCenter.tsx` — fuzzy search + updated `Highlight`