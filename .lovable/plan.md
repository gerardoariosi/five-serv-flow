

## Causa raíz: el Schedule no aparece en el calendario

Dos bugs combinados:

**Bug 1 — Filtro de status incompleto en CalendarPage**
`CalendarPage.tsx` línea 133 filtra inspecciones por `['draft','inspecting','pricing','sent']`. Cuando agendas una inspección con "Schedule for later", el status se guarda como `'scheduled'` (lo verifiqué en DB: INS-2026-0006 está con `status='scheduled'`, `visit_date='2026-04-25'`). Como `'scheduled'` no está en el filtro, la inspección nunca se incluye en `events` → el calendario nunca la muestra.

**Bug 2 — `inspections` no está en la publicación realtime**
La publicación `supabase_realtime` solo incluye `chat_messages`, `notifications` y `tickets`. La tabla `inspections` falta. Aunque el listener realtime de `CalendarPage` (líneas 171-173) intenta escuchar cambios en `inspections`, Postgres nunca emite esos eventos → el calendario no se refresca cuando se crea/edita una inspección, hay que recargar la página.

**Bonus relacionado — TechnicianCalendar**
Tampoco mostrará inspecciones (solo carga tickets), pero esto es por diseño — los técnicos ven solo sus tickets. No requiere cambio.

---

## Cambios a aplicar

| # | Archivo / acción | Cambio |
|---|---|---|
| 1 | Migración SQL nueva | `ALTER PUBLICATION supabase_realtime ADD TABLE public.inspections;` y `ALTER TABLE public.inspections REPLICA IDENTITY FULL;` para que UPDATE entregue payload completo |
| 2 | `src/pages/calendar/CalendarPage.tsx` línea 133 | Cambiar el filtro de status a `['draft','scheduled','inspecting','pricing','sent']` para que las inspecciones recién agendadas aparezcan |

Con esos dos cambios:
- Las inspecciones agendadas aparecerán inmediatamente en el calendario (mes/semana/día) en azul.
- El calendario se refrescará en tiempo real cuando crees, edites o reagendes una inspección desde otra pestaña o usuario.
- Los tickets ya funcionan correctamente (tienen filtro `neq('status','draft')` que sí incluye los recién creados, y `tickets` ya está en la publicación realtime).

