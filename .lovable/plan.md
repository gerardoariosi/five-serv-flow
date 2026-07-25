# FiveServ — Security, Clients, Vendors, Export & Audit Log

## Scope
Additive changes only. No existing tables, columns, pages, or flows are removed or renamed. Every new column/table is optional/nullable and defaults preserve current behavior.

---

## Phase 1 — Security audit (RLS)

Read-only audit first, then targeted migrations.

1. Run the DB linter and pull full policies for every table via `pg_policies`. Focus tables: `clients`, `properties`, `tickets`, `inspections`, `inspection_items`, `inspection_photos`, `ticket_photos`, `ticket_timeline`, `ticket_estimate_options`, `technicians_vendors`, `notifications`, `chat_messages`, `chat_groups`, `users`, `user_roles`, `two_factor_codes`, `push_subscriptions`, `email_send_log`, `master_pin`, `company_profile`, `holidays`, `work_types`, `specialties`, `zones`, `client_notes`, `property_notes`, `user_saved_filters`, `ticket_templates`, `inspection_item_defaults`, `email_unsubscribe_tokens`, `suppressed_emails`.
2. For each table verify the role matrix:
   - **admin**: full read/write.
   - **supervisor**: full read; write on operational tables (tickets, inspections, properties, clients) but not on `user_roles`, `users` admin fields, `master_pin`, `company_profile`.
   - **technician**: SELECT only on tickets/inspections where `technician_id = auth.uid()` or `assigned_to = auth.uid()`, plus the properties/clients linked to those. UPDATE only on their assigned rows for the fields they use (status transitions, checklist, photos, timeline). No access to accounting fields.
   - **accounting**: SELECT on tickets/clients/properties; UPDATE tickets only via the existing `enforce_accounting_ticket_column_scope` trigger (billing_status, qb_invoice_number, accounting_notes).
   - **anon**: only PM/Estimate portal reads gated by valid unexpired token (already partial).
3. Emit one migration per table where policies are missing, too broad, or missing a matching `WITH CHECK`. Add missing GRANTs.
4. Re-run the linter; hand back any residual warnings that require product decisions rather than silently ignoring them.

**Risk:** Tightening a policy can hide rows a role currently sees. Mitigation: before each policy change, run a `SELECT count(*)` diff query as each role via `set local role` to confirm impact.

---

## Phase 2 — Clients enhancements

Migration:
- `ALTER TABLE clients ADD CONSTRAINT clients_type_check CHECK (type IN ('pm','residential'))`. Pre-check with `SELECT DISTINCT type FROM clients` — abort and report if any row violates it.
- `ADD COLUMN referred_by text NULL` (free text; can hold a client name or ID string — simpler than FK, matches "free text or reference" wording).
- `ADD COLUMN lead_source text NULL` + CHECK in `('referral','google','social','other')`.

UI:
- `ClientForm.tsx`: two new optional inputs (Referred by = text, Lead source = select).
- `ClientDetail.tsx` + `ClientList.tsx` card: gold-outline badge "Referred by: {name}" when set. Reuse existing badge styling.

---

## Phase 3 — Vendors / Technicians

Migration A — new columns on `technicians_vendors`:
- `license_expiration_date date NULL`
- `insurance_expiration_date date NULL`

Migration B — `vendor_documents` table:
- Columns: `id`, `vendor_id (fk technicians_vendors, cascade)`, `doc_type text CHECK IN ('w9','insurance','contract','other')`, `file_path text`, `uploaded_at timestamptz default now()`, `uploaded_by uuid`.
- GRANTs to authenticated + service_role, RLS enabled.
- Policies: admin/supervisor full; others none.
- Storage bucket `vendor-documents` (private) via `storage_create_bucket`. Policies on `storage.objects`: only admin/supervisor can select/insert/delete, path prefixed by `vendor_id/`.

Migration C — `vendor_payments` table:
- Columns: `id`, `vendor_id (fk cascade)`, `amount numeric(12,2) not null`, `date date not null`, `note text`, `created_at`, `created_by`.
- GRANTs + RLS. Admin/accounting: full. Supervisor: read. Others: none.

UI (`VendorDetail.tsx`):
- New **Documents** section: list + upload (doc_type select, file input), download via signed URL, delete (admin only).
- New **Payments** section: list, add-payment dialog, running total card `SUM(amount)`.
- **Expiration badge** helper (`src/lib/vendorAlerts.ts`): returns `expired | expiring | ok`. Rendered on Vendor card in `TechnicianList` and on `VendorDetail` header: red pill (expired), amber pill (≤30d), none otherwise. Uses existing semantic tokens.

---

## Phase 4 — Client Export ZIP & Delete

Location: `ClientList.tsx` bulk action + a per-client action on `ClientDetail`.

Approach — client-side ZIP with `jszip` (add dependency):
1. Fetch client row, properties, tickets, inspections, `client_notes`, `property_notes`, plus any `vendor_documents` linked via tickets' technicians (scoped to this client's tickets only).
2. Compose ZIP:
   ```
   {client_name}/client.json
   {client_name}/properties.json
   {client_name}/tickets.json
   {client_name}/inspections.json
   {client_name}/documents/{doc_id}_{filename}
   {client_name}/README.txt   (export timestamp, exported_by)
   ```
   For storage files, download via signed URL and add as binary.
3. Trigger browser download.
4. Only after the user's download completes (Promise resolves) call the existing soft-delete path (`is_deleted=true`, `deleted_at=now()`). Do NOT hard delete — matches the app-wide soft-delete rule from earlier phases.
5. Show progress toast; roll back the download attempt on any fetch error and skip the delete.

Update the button label to reflect soft delete: "Export & Archive".

**Risk:** Large clients could produce big ZIPs. Guard with a size warning at >100 MB and a per-file 25 MB skip with a note in README.

---

## Phase 5 — Audit log

Migration:
- Table `audit_log`: `id`, `actor_id uuid`, `actor_email text`, `action text` (`insert|update|delete`), `table_name text`, `record_id uuid`, `changes jsonb`, `created_at timestamptz default now()`.
- GRANTs: `SELECT` to authenticated (RLS gates it), `INSERT` to authenticated + service_role.
- RLS: SELECT policy `has_role(auth.uid(),'admin')`; INSERT allowed to any authenticated (triggers use SECURITY DEFINER so this is safe).
- Generic trigger function `public.log_audit()` (SECURITY DEFINER) — captures `TG_OP`, diffs `OLD`/`NEW` into jsonb, resolves email via `auth.jwt() ->> 'email'`.
- Attach AFTER INSERT/UPDATE/DELETE triggers to: `clients`, `properties`, `tickets`, `technicians_vendors`.

Verification query for owner:
```sql
SELECT * FROM user_roles ur
JOIN auth.users u ON u.id=ur.user_id
WHERE u.email='owner@fiveserv.net';
```
If `admin` row missing, insert it.

Admin UI:
- New page `src/pages/settings/AuditLog.tsx` — table with filters (table, actor, date range), paginated 50/page, "View changes" opens JSON diff modal.
- Route `/settings/audit-log`, guarded by `has_role('admin')`.
- Add link inside `SettingsPage.tsx` (admin-only nav item).

**Risk:** Trigger overhead on high-write tables (tickets). Mitigation: keep `changes` jsonb small by storing only changed keys (`to_jsonb(NEW) - to_jsonb(OLD)`), not full row.

---

## Implementation order

```text
1. Phase 1 audit reads       → produce policy diff report
2. Phase 1 migrations        → per-table, smallest first
3. Phase 2 migration + UI    → clients (low blast radius)
4. Phase 3 migrations        → vendor columns, documents, payments
5. Phase 3 storage bucket + policies
6. Phase 3 UI                → VendorDetail sections + badges
7. Phase 5 migration + triggers  (before Phase 4 so exports/deletes are logged)
8. Phase 5 admin page + owner role check
9. Phase 4 export/delete flow (uses Phase 5 logging automatically)
10. Full smoke pass: login as each role, verify no regressions
```

---

## Cross-cutting risks

- **RLS tightening** can hide rows from technicians/accounting mid-session; roll each policy change as its own migration so it can be reverted independently.
- **CHECK on clients.type** fails the migration if any legacy row has a different value — pre-flight query required.
- **Audit triggers** on `tickets` will fire for every status change, PM link generation, etc.; keep the payload minimal.
- **Storage bucket** must be private; verify workspace allows creation (some workspaces block public buckets — private is fine).
- **jszip** adds ~100 KB gzipped to the bundle; acceptable, only loaded on the clients page via dynamic import.

No existing table, column, page, or route is removed. All new columns are nullable. Existing UI keeps working if a user never sets the new fields.
