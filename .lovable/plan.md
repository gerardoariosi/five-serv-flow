
Findings only — no changes made.

1. Inspection detail export + email flow

Exact status: this feature does not currently exist in the inspection detail screen.

What is present:
- `src/pages/inspections/InspectionDetail.tsx` fetches and renders the inspection data needed for both report variants:
  - FiveServ/internal data: items, technician notes, photos, pricing, linked tickets
  - PM-response data: `pm_selected`, `pm_note`, `pm_general_note`, `pm_signature_data`, `pm_total_selected`
- So the data is available in the page state.

What is missing/broken:
- No export buttons exist in `InspectionDetail.tsx`
  - The action area (`lines 252-289`) only has status-driven buttons like Continue Inspection, View PM Portal, Mark Estimate Approved, Convert to Ticket(s)
  - There is no `Export FiveServ PDF`, no `Export PM Version PDF`, and no `Send by Email` UI
- No PDF generation implementation exists anywhere
  - No PDF library usage in the app (`jsPDF`, `pdf-lib`, `react-pdf`, `html2pdf`, `html2canvas`, etc. were not found)
  - No inspection PDF edge function exists
  - So PDF generation is not “broken” — it is completely unimplemented
- No email send flow exists from inspection detail
  - No dialog/input for manual free-text recipient entry
  - No handler that generates a PDF blob/file and sends it
  - No success/error flow for sending report emails from this screen
- Existing email functions cannot send inspection PDFs as attachments
  - `supabase/functions/send-transactional-email/index.ts` only accepts `templateName`, `recipientEmail`, `idempotencyKey`, `templateData`
  - `supabase/functions/send-business-email/index.ts` only accepts `template_name`, `to_email`, `variables`
  - Neither function supports attachment payloads
- Resend is not connected
  - No `RESEND_API_KEY` usage
  - No Resend connector gateway calls
  - No inspection email code path uses Resend

Bottom line:
- The inspection detail screen currently has the report data, but it has no export UI, no PDF generator, no email dialog, no attachment sending path, and no Resend integration.
- Both expected flows are missing end-to-end:
  1. Export FiveServ PDF
  2. Export PM Version PDF
  3. Send either PDF by email to a manually entered address

2. Ticket edit screen black screen

Exact cause:
- The edit route `/tickets/:id/edit` mounts `src/pages/tickets/TicketForm.tsx`
- That component renders this in the “Related Inspection” field:
  - `src/pages/tickets/TicketForm.tsx:490`
  - `<SelectItem value="">None</SelectItem>`

Why this crashes:
- The project’s `Select` component is Radix-based (`src/components/ui/select.tsx`)
- Radix Select does not allow a `SelectItem` with an empty-string value
- Empty string is reserved as the “cleared / placeholder” state
- Rendering `<SelectItem value="">` throws a runtime error, which causes the page to blank out

Why this matches the symptom:
- The fetch logic for edit now has fallback handling (`maybeSingle()`, toast, redirect), so the current hard failure is not the load query
- The render crash happens when the form mounts, which is why the user sees a black/blank screen instead of the edit form

Bottom line:
- The exact render-breaking bug is the invalid Radix Select option:
  - `TicketForm.tsx` → `Related Inspection` → `<SelectItem value="">None</SelectItem>`
- That invalid item value is what is causing the ticket edit screen to fail and appear black.
