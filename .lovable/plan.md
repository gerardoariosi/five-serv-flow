

# PM-Facing Documents & Portals — Redesign Audit

## Current state summary

| File | Status |
|---|---|
| `PMPortal.tsx` | Working web portal, light-mode forced, basic card layout, "FS" text (not real wordmark), no formal header/footer, no legal text |
| `inspectionPdf.ts` | Working `generateFiveServPdf` + `generatePmVersionPdf`. White header (not black), bullet-point items (not table), no alternating rows, summary box has no gold border, footer missing center contact line |
| `AccountingDetail.tsx` | "Export PDF" button is a `toast.info('Exporting PDF...')` **stub** — no PDF generation exists |
| `ReportDetail.tsx` | "Export PDF" button is a `toast.info('Exporting PDF...')` **stub** — no PDF generation exists |

---

## 1. PMPortal.tsx — exact changes

| # | Location | Change |
|---|---|---|
| 1 | Lines 335–345 (header) | Replace white header with black `#1A1A1A` full-width bar. Center FiveServ wordmark (`F` gold #FFD700 + `iveServ` white). Add gold 2px line at bottom. Below header in small gray text: property name + `INS-####` |
| 2 | New block after header | Add **hero card** (white, rounded, subtle shadow): single elegant info row with property name, address, visit date, technician name |
| 3 | Lines 397–435 (items) | Replace bordered checkbox cards with **invoice-style rows**: checkbox + item name (bold left), status badge (colored), qty × unit price, total right-aligned. Thin `border-b border-gray-100` separators only (no heavy borders) |
| 4 | Lines 446–457 (photos) | Cleaner grid: add area caption below each photo (small gray text), softer hover (`hover:opacity-90` + subtle shadow lift) |
| 5 | Lines 462–466 (total) | Convert to invoice-style: top separator line, "Selected Total" label gray, amount large black with gold underline accent. Drop the heavy yellow border |
| 6 | New block before closing `<div>` (line 533) | Add **footer**: small FiveServ wordmark, "Licensed & Insured · Central Florida", `info@fiveserv.net`, `(407) 881-4942`, italic gray "This document is confidential." |
| 7 | Lines 482–493 (signature) | Add legal text below signature pad: *"By signing, you authorize FiveServ Property Solutions to proceed with selected work."* |
| 8 | Lines 282 / 338 (PIN screen + sticky header) | Replace `<span>FS</span>` with proper FiveServ wordmark component (reuse `FiveServLogo` or inline) |

---

## 2. inspectionPdf.ts — exact changes

Both `generateFiveServPdf` and `generatePmVersionPdf` share helpers. Refactor the helpers and they propagate.

### `addHeader` (lines 21–42)
- Black rectangle full width, height **40** (was 36, white)
- FiveServ wordmark in white text on black (`F` gold, `iveServ` white)
- Gold 2px line at y=40
- Add **right-aligned** small white text in header: property name (top) + document type subtitle (bottom). Requires header signature change to accept `propertyName` and `docType`.

### `addInfoRow` (lines 69–79)
- Render as **two-column table**: light gray label cell, dark value cell, thin `#E5E5E5` line below each row spanning full content width
- Adjust x positions for proper column alignment

### `addSectionTitle` (lines 58–67)
- Keep gold 3px left border
- Make text **uppercase + bold**
- Add **full-width light gray separator line** under the title

### Item rendering (lines 149–199 in `generateFiveServPdf` and 263–300 in `generatePmVersionPdf`)
- Replace bullet+text rows with a **table layout**:
  - Columns: item name | status badge (colored pill) | qty | unit price | total
  - **Alternating row backgrounds**: `#FAFAFA` and white
  - Column header row at top of each area
- Status rendered as small filled rounded pill (not just colored text)

### Summary box (lines 219–231 and 307–312)
- Replace light gray rounded rect with **white rectangle + gold 1.5px border**
- Total amount: large bold black, with gold accent label

### `addFooter` (lines 44–56)
- Keep gold separator line
- **Left**: tagline `Five Days. One Call. Done.` (note: spec says "Five Days" — current code has "One Team. One Call. Done." — confirm/replace)
- **Center**: `FiveServ Property Solutions LLC · info@fiveserv.net · (407) 881-4942`
- **Right**: `Page X of Y`

---

## 3. AccountingDetail.tsx — exact changes

Currently no PDF generation — line 201 is a `toast.info` stub.

- Add new file **`src/lib/ticketPdf.ts`** exporting `generateTicketAccountingPdf(ticket, photos, technician, approver)` reusing the same redesigned helpers from `inspectionPdf.ts` (refactor helpers into a shared `src/lib/pdfHelpers.ts` to share black header, footer, info table, item table, summary box).
- Sections: Header (black + property + ticket FS#) → Ticket Info table (PM, property, unit, type, technician, approved by) → Timestamps table → Photos by stage (start/process/close, embedded as images via `addImage`) → Billing summary box (status, QB invoice #, accounting notes).
- Replace stub at line 201 with real call: `const doc = await generateTicketAccountingPdf(...); doc.save(\`${ticket.fs_number}-billing.pdf\`)`.

---

## 4. ReportDetail.tsx — exact changes

Currently no PDF generation — line 273 is a `toast.info` stub.

- Add `generateReportPdf(reportData, filters)` to a new shared report PDF generator (or extend `ticketPdf.ts`).
- Sections: Header (black + report title + date range from filters) → Filters applied (info table) → Summary metrics box (gold border) → Data table (alternating rows) → Footer.
- Replace stub at line 273 with real call.

---

## 5. Shared helper extraction (recommended)

Create **`src/lib/pdfHelpers.ts`** with the redesigned `addBlackHeader`, `addFooter`, `addSectionTitle`, `addInfoTableRow`, `addItemTableRow`, `addSummaryBox`, `STATUS_PILL_COLORS`, brand color constants. Then `inspectionPdf.ts`, `ticketPdf.ts`, and `reportPdf.ts` all import from it. This guarantees visual consistency across all four PDFs and keeps the redesign DRY.

---

## Files to create / modify

| Action | File |
|---|---|
| Create | `src/lib/pdfHelpers.ts` (shared header/footer/table primitives) |
| Create | `src/lib/ticketPdf.ts` (`generateTicketAccountingPdf`) |
| Create | `src/lib/reportPdf.ts` (`generateReportPdf`) |
| Modify | `src/lib/inspectionPdf.ts` (use new helpers, table-style items, black header, gold-border summary, full footer) |
| Modify | `src/pages/inspections/PMPortal.tsx` (header, hero card, invoice items, photo grid, total, footer, legal text under signature, real wordmark) |
| Modify | `src/pages/accounting/AccountingDetail.tsx` (replace toast stub with real PDF download) |
| Modify | `src/pages/reports/ReportDetail.tsx` (replace toast stub with real PDF download) |

No DB changes, no edge function changes, no migrations required. Pure presentation layer.

