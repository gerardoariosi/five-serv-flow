## Goal
Add a per-client CSV bulk import for Properties on the Client Detail page. Additive only — the existing single "Add Property" flow, Clients, and every other page stay untouched.

## Scope
- Entry point lives on `src/pages/clients/ClientDetail.tsx`, Properties tab.
- All new logic contained in a new component + one small helper. No schema changes, no RLS changes, no edits to unrelated pages.

## Steps

### 1. Dependency
- Add `papaparse` and `@types/papaparse` for robust CSV parsing (handles quoting, escaped commas, BOM, line-ending variations). Small footprint, industry standard.

### 2. CSV template
- New helper `src/lib/propertyCsvTemplate.ts` exports:
  - Column list: `name, street_address, city, state, zip_code, zone`
  - `downloadTemplate()` that triggers a browser download of `properties-template.csv` with the header row and one example row.

### 3. New component `src/components/properties/ImportPropertiesDialog.tsx`
Self-contained dialog with three internal stages:

  a. **Upload stage**
   - Buttons: "Download template", "Choose CSV file".
   - Parses with `Papa.parse(file, { header: true, skipEmptyLines: true, transformHeader: trim/lowercase })`.
   - Loads existing zones for this workspace once (`supabase.from('zones').select('id, name')`) for name→id resolution and dropdown.

  b. **Preview & edit stage** (the critical gate)
   - Editable table, one row per CSV row. Columns: include checkbox, name, street_address, city, state, zip_code, zone (Select of existing zones + "— none —"), status.
   - Each cell is an `Input`/`Select`; edits update local state.
   - Per-row validation runs on every change:
     - `street_address` required
     - `city` required
     - `state` required (2-letter, validated against `US_STATES` from `src/lib/propertyAddress.ts`)
     - `zip_code` required, matches `/^\d{5}(-\d{4})?$/`
     - `zone`: if the CSV value doesn't match a known zone name (case-insensitive), row is flagged with a "zone not found — pick one or clear" hint; the Select lets the user map or blank it.
   - Rows with errors get a red left border + inline field-level messages. They stay in the table but are auto-excluded from the import (checkbox disabled until fixed). User can also manually exclude any valid row.
   - Sticky footer shows: `X ready to import · Y with errors · Z excluded`.
   - "Confirm Import" is disabled while any *included* row still has errors, or while nothing is included.

  c. **Result stage**
   - After confirm: batch insert via a single `supabase.from('properties').insert(rows)` where each row has `current_pm_id = clientId`, `zone_id` (or null), plus the address fields. The existing `sync_property_address` DB trigger will fill `full_address`/`address` automatically, matching the manual form's output exactly.
   - On success: toast, invalidate `['client-properties', id]`, show summary ("N properties created"), close.
   - On partial failure (network/permission): show error, keep the dialog open with edits intact so the user can retry.

### 4. Wire into `ClientDetail.tsx`
- Import the dialog and add an `Import Properties (CSV)` outline button next to `Add Property` inside the Properties `TabsContent`. Only rendered when the tab is active — no other markup touched.

## Technical notes (for engineer review)
- Uses existing `properties` insert path and `current_pm_id` — no policy changes needed; admin RLS already permits inserts.
- Zone resolution done client-side against loaded zones list; no fuzzy matching, exact case-insensitive name match only, otherwise user picks in the dropdown.
- Validation mirrors the manual `PropertyForm` required fields (street_address, city, state, zip_code) so bulk-created rows are indistinguishable from manual ones.
- All-or-nothing single insert keeps the operation atomic per Postgres transaction; if the user wants "skip failing rows" behavior later, easy to switch to per-row inserts.

## Risks / flags
1. **Large files**: rendering thousands of editable rows can lag. Mitigation: soft cap at 500 rows per import with a clear message; recommend splitting larger files. Confirm this cap is acceptable.
2. **Duplicate properties**: there is no unique constraint on address for a client today, so re-uploading the same CSV would create duplicates. Options: (a) do nothing — user's responsibility; (b) warn on rows whose `street_address + zip` already exist for this client. Recommend (b) as a non-blocking warning. Confirm preference.
3. **Zone auto-create**: current plan does *not* create missing zones — user must map to an existing one or leave blank. Confirm that's desired vs. offering "create zone 'X'" inline.
4. **State/zip strictness**: US-only validation. Confirm that's fine (matches existing `US_STATES` list).
5. **CSV encoding**: PapaParse handles UTF-8 + BOM; Excel-exported CSVs on Windows should work. Non-UTF-8 exotic encodings are not supported.

## Deliverables
- `package.json` (+ papaparse, @types/papaparse)
- `src/lib/propertyCsvTemplate.ts` (new)
- `src/components/properties/ImportPropertiesDialog.tsx` (new)
- `src/pages/clients/ClientDetail.tsx` (button + dialog mount only)

Nothing else is modified.
