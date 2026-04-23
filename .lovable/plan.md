

# Plan: Ticket workflow — 6 mejoras

## 1. Notificación + email al técnico cuando se le asigna un ticket

**Trigger**: cualquier `INSERT` o `UPDATE` de `tickets` donde `technician_id` cambie a un valor no nulo.

- **DB migration**: trigger SQL `notify_technician_assigned` sobre `public.tickets` (AFTER INSERT OR UPDATE OF technician_id). Inserta en `notifications` (`type='ticket'`, link `/my-work/{id}`) cuando `(OLD.technician_id IS DISTINCT FROM NEW.technician_id) AND NEW.technician_id IS NOT NULL`.
- **Frontend** (`src/pages/tickets/TicketForm.tsx` `handleSubmit` y `TicketDetail.tsx` `handleAssignTech`): tras guardar, si `technician_id` cambió, llamar `supabase.functions.invoke('send-business-email', { body: { template_name: 'technician_assigned', to_email: <tech.email>, variables: { fs_number, property_name, work_type, appointment_time, technician_name } } })`. Necesita traer `email` del técnico desde `users` (ya cargado en `technicians`, agregar `email` al select).

## 2. Notificación + email a admins cuando técnico marca "Ready for Review"

**Trigger**: `tickets.status` cambia a `ready_for_review`.

- **DB migration**: trigger `notify_ready_for_review` sobre `tickets` AFTER UPDATE. Inserta una fila en `notifications` por cada `user_id` con `role='admin'` (vía `user_roles` join `users`). Mensaje: `"{fs_number} listo para revisión"`, link `/tickets/{id}`.
- **Frontend** (`src/pages/tickets/TicketWork.tsx` `handleMarkComplete`): después del `update`, query `users` con rol admin (vía `user_roles`) y por cada email llamar `send-business-email` con `template_name: 'ready_for_review'`.
  - Alternativa más limpia: nueva edge function `notify-ready-for-review` que reciba `ticket_id` y haga el fan-out server-side. **Recomendado** porque el cliente no debe asumir lista de admins ni iterar emails.

## 3. Modal editable "Send Report to PM"

**Archivos**: `src/pages/tickets/TicketDetail.tsx` (botón línea 464–469) y `src/pages/tickets/TicketReview.tsx` (línea 236).

- Reemplazar el `toast.info` por abrir un nuevo `<Dialog>` `SendPMReportModal` que precarga:
  - Property (name + address), Unit, Work type, Description / work done (de `ticket.description` + última nota de timeline), Technician (full_name), URLs de fotos `stage='close'`/`final`.
- Campos editables: subject, mensaje libre, lista de fotos (checkbox para incluir/excluir).
- Submit → `supabase.functions.invoke('send-business-email', { body: { template_name: 'ticket_pm_report', to_email: <pm.email>, variables: { ... html con fotos ... } } })`.
- **DB**: nueva fila en `email_templates` con `template_key='ticket_pm_report'` (insertar via insert tool, no migration) con subject y body HTML usando placeholders `{{fs_number}}`, `{{property_name}}`, `{{summary}}`, `{{photos_html}}`, `{{technician_name}}`, `{{unsubscribe_url}}`.
- PM email viene de `clients.email` (ticket.client_id → clients.email).

## 4. Merge "Start Work" + "In Progress" → "Working"

**Archivo**: `src/pages/tickets/TicketWork.tsx`.

- Cambiar `WorkStep` type: `'en_camino' | 'llegue' | 'working' | 'ready_for_review'`.
- `stepOrder = ['en_camino', 'llegue', 'working', 'ready_for_review']`.
- `stepLabels.working = 'Working'`.
- `getCurrentStep()`: simplificar — si `status==='in_progress'` (con o sin `work_started_at`) → `'working'`.
- En el bloque de UI (líneas 323–360): un solo botón "Start Working" que requiere foto de inicio Y setea `work_started_at` Y deja status `in_progress`. Mientras esté en `working`: botón "Mark Complete" + upload de progress photos. Eliminar el bloque separado de `start_work` vs `in_progress`.
- **No requiere cambio en DB**: status sigue siendo `in_progress` internamente. Solo se simplifica UI.

## 5. Checklists por work_type en TicketWork

**Archivo nuevo**: `src/lib/workChecklists.ts` exporta:
```ts
export const WORK_CHECKLISTS: Record<string, string[]> = {
  'make-ready': ['Paint', 'Clean', 'Repairs', 'Appliance check', 'Final walkthrough'],
  'repair':     ['Diagnose', 'Parts needed', 'Fix', 'Test', 'Photo'],
  'emergency':  ['Contain issue', 'Fix', 'Verify', 'Photo'],
  'capex':      ['Site assessment', 'Work execution', 'Quality check', 'Final documentation'],
};
```

- **DB migration**: agregar `tickets.checklist_progress jsonb default '{}'::jsonb` (mapa `{itemLabel: boolean}`).
- **TicketWork.tsx**: cuando `currentStep === 'working'`, render una sección "Checklist" con `Checkbox` por item del work_type. Toggle persiste con `update tickets set checklist_progress = ...`. Mostrar progreso `X / Y completados`. No bloquea Mark Complete pero advierte si hay items sin marcar.

## 6. Realtime en TicketDetail

**Archivo**: `src/pages/tickets/TicketDetail.tsx`.

- Agregar `useEffect` que suscribe canal `ticket-detail-{id}` con tres listeners `postgres_changes`:
  - `tickets` filter `id=eq.{id}` → re-llama `fetchTicket()`
  - `ticket_timeline` filter `ticket_id=eq.{id}` → re-llama `fetchTicket()`
  - `ticket_photos` filter `ticket_id=eq.{id}` → re-llama `fetchTicket()`
- Cleanup `removeChannel` en return.
- **DB migration**: agregar `ticket_timeline` y `ticket_photos` al publication `supabase_realtime` y `REPLICA IDENTITY FULL`. (`tickets` ya está.)

---

## Resumen de archivos a tocar

| # | Archivo / acción |
|---|---|
| 1a | Nueva migración: trigger `notify_technician_assigned` + agregar `users.email` al select en TicketForm/TicketDetail |
| 1b | `TicketForm.tsx`, `TicketDetail.tsx`: invocar `send-business-email` (template `technician_assigned`) tras asignar |
| 2a | Nueva migración: trigger `notify_ready_for_review` |
| 2b | Nueva edge function `notify-ready-for-review` (server-side fan-out a admins) llamada desde `TicketWork.handleMarkComplete` |
| 3a | Insert en `email_templates` (`ticket_pm_report`) — vía insert tool, no migration |
| 3b | Nuevo componente `SendPMReportModal.tsx` + integrarlo en `TicketDetail.tsx` y `TicketReview.tsx` |
| 4 | `TicketWork.tsx`: refactor del flujo de pasos a 4 (`En Camino` → `Llegué` → `Working` → `Ready for Review`) |
| 5a | Nueva migración: agregar columna `tickets.checklist_progress jsonb` |
| 5b | Nuevo `src/lib/workChecklists.ts` + sección Checklist en `TicketWork.tsx` |
| 6a | Nueva migración: `supabase_realtime` += `ticket_timeline`, `ticket_photos` + `REPLICA IDENTITY FULL` |
| 6b | `TicketDetail.tsx`: suscripciones realtime con cleanup |

Todas las migraciones SQL son aditivas (no rompen datos existentes).

