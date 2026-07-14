# FiveServ — Color & Status System Proposal

## 1. Research Notes (Jobber, Housecall Pro, Buildium, ServiceTitan)

All four converge on the same restraint pattern:

- **~1 brand accent, 3–4 semantic status colors, everything else neutral.** Jobber = green brand + red/amber/blue/grey status. Housecall Pro = blue brand + red/amber/green. Buildium = teal brand + red/amber/green. ServiceTitan = blue brand + red/amber/green.
- **Numbers on stat cards are always neutral (near-black in light, near-white in dark).** Color appears only in a small delta chip or an icon, never on the number itself. FiveServ currently colors the number (orange, yellow, purple, green) which is the biggest source of "busy".
- **Badges are one shape** — subtle rounded pill, ~11px, medium weight, tinted background + darker text of the same hue. Never solid saturated fills except for destructive/emergency.
- **Color is reserved for state, not category.** Job types ("Repair", "Install", "Maintenance") are neutral gray text or an outlined chip. Only *status* (open / in progress / overdue / done) carries color.
- **Left-border stripes** are rare and reserved for exceptions (overdue, emergency, unread). Default rows have a subtle bottom divider, not a colored spine.
- **Typography**: one large bold number, small uppercase muted label, generous vertical padding. No secondary color on the label.

Your hypothesis is directionally correct and matches this playbook. Two pushbacks:

1. **Gold as sole brand accent is fine, but reserve a "primary action" tint separate from "brand mark".** Gold on FAB + primary button is high-visibility; using the same gold on "active nav" and the logo is OK but avoid ever tinting data with it (currently `text-primary` on the Active metric does this).
2. **Don't use colored left-borders for work-type at all.** Jobber/HCP/Buildium don't. Use a small neutral outlined chip ("Repair", "Emergency") where the *Emergency* chip is the only red one. Reserve the left-border stripe for a single meaning: **needs attention** (emergency OR overdue). This kills 4 competing border colors on the ticket list at once.

## 2. Proposed Color Tokens

Add semantic tokens in `index.css` — components consume names only, never hex.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--brand` | #FFD700 | #FFD700 | Logo, FAB, primary button bg, active nav indicator. **Never** on data, numbers, or borders. |
| `--foreground` | #1A1A1A | #FFFFFF | All numbers, headings, body text by default |
| `--muted-foreground` | #666 | #999 | Labels, secondary text, neutral chips |
| `--border` | #E5E5E5 | #333 | All card/row borders by default |
| `--status-urgent` | #DC2626 | #EF4444 | Emergency, overdue, error, destructive action |
| `--status-waiting` | #B45309 | #F59E0B | Pending PM, awaiting estimate, paused, "waiting on someone" |
| `--status-progress` | #1D4ED8 | #3B82F6 | In progress, scheduled, active work |
| `--status-done` | #15803D | #22C55E | Completed, approved, responded, closed |

**Retired** (remove from all screens): `text-orange-400`, `text-purple-400`, `text-yellow-400`, `text-green-400`, `text-blue-400`, hardcoded `#f97316`/`#3b82f6`/`#22c55e` left-borders, `bg-red-600` buttons.

Alternative directions considered:
- **A. Mono + one accent** (Linear-style): drop `--status-progress`, fold "in progress" into neutral, keep only urgent/waiting/done. Most minimal, but loses at-a-glance triage on the ticket list.
- **B. Two-tone status** (chosen above): 4 status colors. Matches Jobber/HCP exactly. Best balance.
- **C. Icon-led, color-light**: status shown by icon (●○◐✓) + neutral text, color only for urgent. Very clean but requires more per-row real estate — probably overkill for a mobile-first list.

Recommend **B**.

## 3. Badge / Status System

One component, one shape everywhere:

```
rounded-full · px-2 py-0.5 · text-[11px] · font-medium
bg-<status>/10  text-<status>  (no border, no shadow)
```

Variants map to the 4 status tokens + `neutral` (default gray). Status → variant table:

| Status | Variant |
|---|---|
| emergency, overdue, rejected, cancelled | urgent |
| draft, paused, pending_evaluation, pending_estimate, pending_pricing, unassigned | waiting |
| open, in_progress, scheduled, estimate_sent | progress |
| closed, complete, estimate_approved, pm_responded, converted | done |
| work type labels (Repair, Make-Ready, CapEx) | neutral |

Only *Emergency* work-type gets the `urgent` variant — because emergency IS a state, not just a category. All other work types render as neutral outlined chips.

## 4. Dashboard Changes (Dashboard.tsx)

- **Metric numbers**: remove `color: 'text-*'` entirely. Numbers render `text-foreground`. Label stays muted.
- **Metric card left-borders**: remove all `border-l-*` colored stripes. Cards become plain neutral. Optional: keep a single accent stripe *only* on Emergencies when count > 0, using `--status-urgent`.
- **Ticket cards in list**: drop the 4-color `workTypeBorder` map. Left-border stripe appears **only** if `work_type === 'emergency'` OR ticket is overdue — in `--status-urgent`. Everything else: no stripe, just the standard card border.
- **Priority pill** (`bg-orange-500 text-white`): re-route through the badge system → `waiting` for high, `urgent` for emergency.
- **Inspections divider**: keep; already added last pass.
- **FAB / New Ticket button**: stays brand gold.

## 5. Other Screens With The Same Inconsistency

Grep confirms these all need the same pass:

- **TicketList.tsx** (lines 19–23, 273, 287, 296) — identical `workTypeBorder` map + `bg-orange-500` priority pill. Same fix as Dashboard.
- **TicketDetail.tsx** — status badge colors from `src/lib/ticketColors.ts` use 8 different hues (yellow/amber/indigo/emerald/purple/green/blue/orange). Collapse to the 4 status variants.
- **InspectionList.tsx** (line 134) — inline `bg-yellow-500/20 text-yellow-400`; also uses `src/lib/inspectionColors.ts` with 6 hues. Collapse.
- **InspectionDetail.tsx** — same inspectionColors palette.
- **AccountingList.tsx** (line 257) — `bg-red-600 hover:bg-red-700` on bulk delete; should be `variant="destructive"` via token.
- **AccountingDetail.tsx** — likely mirrors list; audit in same pass.
- **DrawerMenu.tsx / TopNav.tsx** — audit for stray colored role badges / nav highlights that should be `--brand` only.
- **Shared color libs to refactor**: `src/lib/ticketColors.ts`, `src/lib/inspectionColors.ts`, `src/pages/Dashboard.tsx` (`workTypeBorder`), `src/pages/tickets/TicketList.tsx` (`workTypeBorder`). These are the choke points — fixing the maps propagates everywhere.

## Implementation Scope (when approved)

1. Add 4 status tokens to `index.css` (both themes) + Tailwind config.
2. Create `<StatusBadge variant="urgent|waiting|progress|done|neutral">` component; replace ad-hoc badges.
3. Rewrite `ticketColors.ts` + `inspectionColors.ts` to map status → variant name (no hex, no Tailwind color classes).
4. Remove `workTypeBorder` maps; introduce `needsAttentionBorder(ticket)` helper returning `border-l-[--status-urgent]` or `''`.
5. Strip `text-*-400` from Dashboard metric arrays; numbers become neutral.
6. Sweep AccountingList/InspectionList for stray hardcoded color classes.

No code changes in this step — awaiting your approval on the token list and the "no color on work-type, borders reserved for urgency" calls before proceeding.
