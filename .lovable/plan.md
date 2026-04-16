

## Análisis: work_type del ticket no se actualiza en el Dashboard

### Causa raíz

El Dashboard SÍ tiene una suscripción realtime sobre `tickets` (líneas 72-77 de `Dashboard.tsx`) que dispara `fetchData()` ante cualquier cambio. La tabla `tickets` está en `supabase_realtime` (migración `20260406171739`). En teoría debería funcionar.

El problema real son **dos bugs combinados**:

**Bug 1 — Falta `REPLICA IDENTITY FULL` en `tickets`**
Postgres realtime necesita `REPLICA IDENTITY FULL` para que los eventos UPDATE entreguen el payload completo de la fila. Sin esto, el evento aún se dispara, pero en algunos clientes Supabase Realtime el cambio no se notifica de forma confiable cuando solo cambian columnas no-indexadas como `work_type`. Esto explica el comportamiento intermitente.

**Bug 2 — Inconsistencia de claves `work_type`**
El formulario (`TicketForm.tsx` línea 369) guarda `make-ready` (con guión), pero otras partes del código (`AccountingList.tsx` 116, `ReportDetail.tsx` 262, calendar) usan `make_ready` (con guión bajo). El Dashboard busca colores con `workTypeColors[ticket.work_type]` y el mapa solo tiene la clave `'make-ready'` — si en algún momento se guarda con guión bajo, el badge queda con el color por defecto (Repair) y el usuario percibe que "no se actualizó". El mismo `TicketDetail` (línea 89) compara contra `'make-ready'` ignorando `'make_ready'`.

Además, los work types ahora son **dinámicos** (tabla `work_types` editable en Settings), pero el `<Select>` del formulario sigue **hardcodeado** con 4 valores fijos. Si un admin agrega un nuevo work type en Settings, no aparece en el formulario, y los tickets viejos con esa clave no encuentran color/label.

### Qué hay que arreglar

**1. Migración DB**
- `ALTER TABLE public.tickets REPLICA IDENTITY FULL;` para que realtime entregue payloads completos en UPDATE.

**2. `TicketForm.tsx`**
- Reemplazar el `<Select>` hardcodeado de Work Type por uno alimentado desde `supabase.from('work_types').select('key,label')`.
- Esto asegura que la clave guardada coincide con la tabla maestra y elimina el desfase guión vs guión-bajo.

**3. `src/lib/ticketColors.ts`**
- Agregar alias `'make_ready'` apuntando a los mismos colores que `'make-ready'` (fallback defensivo para tickets ya existentes con cualquiera de las dos claves).

**4. `Dashboard.tsx`**
- El listener realtime ya existe pero refetch completo es pesado. Mantenerlo, pero también escuchar específicamente eventos UPDATE para forzar el refresh inmediato (ya lo hace con `event: '*'`, así que solo confirmar que sigue así tras el fix de REPLICA IDENTITY).
- Agregar un `useEffect` que refetch al volver a montarse (ya pasa por defecto), y opcionalmente un refetch al recobrar foco de la ventana (`visibilitychange`) para cubrir el caso de navegación rápida en mobile.

**5. `TicketDetail.tsx`**
- Línea 89: cambiar la comparación a `['make-ready','make_ready'].includes(tRes.data?.work_type)` para que el countdown funcione con ambas claves.

### Archivos a modificar

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | Nueva migración SQL | `ALTER TABLE tickets REPLICA IDENTITY FULL` |
| 2 | `src/pages/tickets/TicketForm.tsx` | Select de work_type alimentado desde tabla `work_types` |
| 3 | `src/lib/ticketColors.ts` | Alias `make_ready` → mismos colores que `make-ready` |
| 4 | `src/pages/Dashboard.tsx` | Refetch on `visibilitychange` (defensa adicional) |
| 5 | `src/pages/tickets/TicketDetail.tsx` | Aceptar ambas variantes de make-ready en el countdown |

