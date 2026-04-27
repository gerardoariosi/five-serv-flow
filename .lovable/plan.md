# Analysis Report — PWA Icon + Technician Email

## ISSUE 1 — Desktop PWA Icon Not Showing

### Root cause confirmed
The single PNG referenced in `public/manifest.json` is **708×248 pixels** (a wide logo, not square). Chrome desktop PWA installer requires actual square PNG files at exactly 192×192 and 512×512. The manifest currently lies about the dimensions:

```json
{ "src": "/FiveServ_Logo_2_No_BG.png", "sizes": "192x192", ... }
{ "src": "/FiveServ_Logo_2_No_BG.png", "sizes": "512x512", ... }
```

Chrome inspects the actual pixel dimensions, sees 708×248, rejects the icon as invalid for installability, and falls back to the generic page-screenshot icon.

### Files in `/public/` today
| File | Actual size | Notes |
|---|---|---|
| `FiveServ_Logo_2_No_BG.png` | 708×248 | Wide logo, transparent bg |
| `FiveServ_Logo_Black_Text.png` | 706×256 | Wide logo, black text |
| `logo.png` | 1533×2000 | Tall portrait, not square |
| `favicon.ico` | — | Browser favicon only |

**No square 192×192 or 512×512 PNG exists.** That's why the desktop icon is broken.

### Fix required
1. Generate two new square PNGs from `logo.png` (or the wordmark on a dark `#1A1A1A` square canvas with padding):
   - `/public/icon-192.png` — exactly 192×192
   - `/public/icon-512.png` — exactly 512×512
   - `/public/icon-512-maskable.png` — exactly 512×512 with safe-zone padding (~20%) and full-bleed `#1A1A1A` background, `purpose: "maskable"`
2. Update `public/manifest.json` to reference these three files with correct `sizes` and explicit `purpose` values (`"any"` for the first two, `"maskable"` for the third).
3. Optionally update `index.html` `<link rel="apple-touch-icon">` to point to `/icon-512.png` for nicer iOS home-screen icons.

No code/route changes — purely asset generation + manifest update.

---

## ISSUE 2 — Technician Assignment Email Has Broken Variables & Buttons

### Template confirmed in DB
`email_templates.template_key = 'technician_assigned'` references **8 variables**:

```
{{technician_name}}  {{fs_number}}  {{property_name}}  {{property_address}}
{{unit}}             {{work_type}}  {{appointment_date}} {{appointment_time}}
{{job_description}}  {{app_url}}    {{directions_url}}
```

### Caller call sites
Both call sites only pass **6 variables** (`fs_number`, `property_name`, `work_type`, `appointment_time`, `technician_name`):

| File | Line | Trigger |
|---|---|---|
| `src/pages/tickets/TicketForm.tsx` | 306–320 | New ticket created with technician |
| `src/pages/tickets/TicketDetail.tsx` | 206–220 | Tech assigned to existing ticket |

### Missing variables → why they render as literal `{{...}}`
The `send-business-email` edge function (lines 99–113 of `supabase/functions/send-business-email/index.ts`) does a literal `template.replace(/\{\{(\w+)\}\}/g, ...)` and **leaves any unmatched token unchanged**. So every variable not passed in shows up as `{{property_address}}` etc. in the recipient's inbox.

| Token | Source data needed |
|---|---|
| `{{property_address}}` | `properties.address` — not currently fetched in either caller |
| `{{unit}}` | `tickets.unit` — column exists, never passed |
| `{{job_description}}` | `tickets.description` — never passed |
| `{{appointment_date}}` | Currently only `appointment_time` is sent (combined date+time string). Template wants date and time as **separate** lines |
| `{{app_url}}` | Never passed → "Open in App" button has empty `href` |
| `{{directions_url}}` | Never passed → "Get Directions" button has empty `href` |

### Fix required (per call site)

**TicketForm.tsx (line 306–320)** — add to the `variables` object:
```
property_address: prop?.address ?? '',
unit: form.unit ?? '',
job_description: form.description ?? '',
appointment_date: form.appointment_time
  ? new Date(form.appointment_time).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday:'short', month:'short', day:'numeric', year:'numeric' })
  : 'Not scheduled',
appointment_time: form.appointment_time
  ? new Date(form.appointment_time).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour:'numeric', minute:'2-digit' })
  : '',
app_url: `https://app.fiveserv.net/tickets/${ticketId}`,
directions_url: prop?.address
  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prop.address)}`
  : '',
```

**TicketDetail.tsx (line 206–220)** — same additions, but using existing context:
- `property_address` ← `properties[ticket.property_id]?.address`
- `unit` ← `ticket.unit`
- `job_description` ← `ticket.description`
- `appointment_date` ← split formatter on `ticket.appointment_time`
- `appointment_time` ← time-only formatter
- `app_url` ← `https://app.fiveserv.net/tickets/${id}`
- `directions_url` ← `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(properties[ticket.property_id]?.address ?? '')}`

### Also verify
- `TicketForm.tsx` `properties` array must include `address` in its select. Let me note: if the `properties` list was loaded with `select('id, name')` only, `prop?.address` will be `undefined`. The fix should also widen the properties query to include `address` (and `unit` is on ticket, not property).
- `TicketDetail.tsx` `properties` lookup map — same check; ensure `address` is loaded.

### No edge function changes needed
`send-business-email` is generic — it substitutes whatever tokens are passed. The fix is **entirely client-side** in the two call sites.

---

## Summary of Changes (when approved)

**Issue 1 — Assets + manifest**
- Generate `public/icon-192.png` (192×192), `public/icon-512.png` (512×512), `public/icon-512-maskable.png` (512×512 maskable) from `logo.png`
- Update `public/manifest.json` icons array to reference the three new files
- Optionally update `<link rel="apple-touch-icon">` in `index.html`

**Issue 2 — Technician email payload**
- `src/pages/tickets/TicketForm.tsx` (≈line 310): add 7 missing variables; ensure `properties` query includes `address`
- `src/pages/tickets/TicketDetail.tsx` (≈line 210): add 7 missing variables; ensure `properties` map includes `address`
- No edge function changes
- No DB / template changes (template is already correct)
