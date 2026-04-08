
Qué está fallando en el flujo completo de fotos de inspección, sin hacer cambios:

1. Flujo actual que encontré
- Frontend: `src/pages/inspections/AreaInspection.tsx`
  - El input usa `type="file"` con `accept="image/*"`.
  - Al subir, arma una ruta así:
    `inspections/{inspectionId}/{areaKey}/{timestamp}-{safeName}`
  - Sube el archivo al bucket privado `inspection-photos`.
  - Luego inserta un registro en `ticket_photos`.
- Visualización:
  - `AreaInspection.tsx` y `InspectionDetail.tsx` leen `ticket_photos`.
  - Si `url` no empieza con `http`, generan signed URLs desde `inspection-photos`.

2. Errores reales identificados
- Error A: restricción de base de datos en `ticket_photos.stage`
  - La tabla `ticket_photos` tiene este check:
    `stage IN ('start','process','close')`
  - Antes, el flujo de inspección estaba intentando guardar valores de área como `kitchen`, `bedroom_1`, etc. Eso rompe con:
    `ticket_photos_stage_check`
  - En el código actual ya vi un “parche” donde siempre inserta `stage: 'process'`.
  - Conclusión:
    - El diseño sigue siendo inconsistente.
    - La tabla es de fotos de tickets, pero se está reutilizando para inspecciones.
    - `stage` ya no representa el área real de la inspección, solo un valor válido para pasar el check.

- Error B: clave inválida en Storage
  - El error:
    `Invalid key: inspections/.../kitchen/...Screenshot 2026-04-06 at 9.30.54 AM.png`
  - La causa es el nombre original del archivo con espacios y caracteres especiales.
  - En el código actual sí existe sanitización:
    `file.name.replace(/[^a-zA-Z0-9._-]/g, '_')`
  - Eso indica que:
    - el error vino de una versión previa del flujo, o
    - todavía hay rutas antiguas guardadas/intentos desde otro punto sin sanitizar.
  - En el flujo actual leído, esta parte parece ya corregida.

3. Problemas estructurales del flujo
- Problema 1: las fotos de inspección se guardan en `ticket_photos`
  - `AreaInspection.tsx` inserta en `ticket_photos` usando:
    - `ticket_id: id`
    - pero `id` aquí es el ID de la inspección, no el de un ticket.
  - La FK de `ticket_photos.ticket_id` apunta a `tickets(id)`.
  - Entonces hay una incompatibilidad conceptual fuerte:
    - una inspección no es un ticket,
    - pero se está guardando como si lo fuera.
  - Esto puede causar:
    - inserts fallidos por FK si no existe un ticket con ese mismo UUID,
    - o lecturas inconsistentes si casualmente coincide algún ID.
  - Aunque no viste ese error específico en tu mensaje, el flujo está mal modelado.

- Problema 2: la agrupación de fotos es inconsistente entre pantallas
  - En `AreaInspection.tsx` el área se reconstruye desde la ruta del archivo:
    `inspections/{id}/{area}/{filename}`
  - En `InspectionDetail.tsx` las fotos se agrupan por `p.stage`.
  - Pero ahora `stage` se está guardando como `'process'`.
  - Resultado:
    - en una pantalla las fotos se agrupan por área extraída del path,
    - en otra se agrupan por `stage`,
    - eso puede hacer que todas aparezcan bajo `process` en detalle, perdiendo la agrupación real por kitchen, bedroom, etc.

- Problema 3: si falla el insert en DB después del upload, queda archivo huérfano en storage
  - El orden actual es:
    1. subir archivo a storage
    2. insertar fila en `ticket_photos`
  - Si el paso 2 falla, el archivo ya quedó subido.
  - No hay rollback ni limpieza.
  - Eso genera archivos “fantasma” en `inspection-photos`.

- Problema 4: solo se procesa el primer archivo
  - El input acepta imágenes, pero `handlePhotoUpload` usa solo:
    `const file = e.target.files[0]`
  - O sea:
    - picker funciona,
    - pero no soporta selección múltiple aunque el usuario elija varias si el navegador lo permite en ese flujo futuro.
  - No rompe el upload, pero sí limita el flujo.

- Problema 5: posible fallo de RLS si `user?.id` no está listo
  - El insert usa:
    `technician_id: user?.id ?? null`
  - La política de insert en `ticket_photos` exige:
    `technician_id = auth.uid()`
  - Si por timing el store no tiene `user.id`, insertaría `null` y RLS lo bloquearía.
  - No parece ser tu error principal ahora, pero es un punto frágil del flujo.

4. Qué sí está bien en este momento
- El bucket `inspection-photos` existe.
- El bucket es privado y hay políticas para:
  - `SELECT` autenticado
  - `INSERT` autenticado
- La UI usa signed URLs para mostrar imágenes privadas.
- El input `accept="image/*"` permite:
  - desktop: selector de archivos
  - mobile: galería/fotos según el SO/navegador.

5. Diagnóstico final
La razón de fondo por la que fallan las fotos no es una sola; son varios errores combinados:
- Se reutilizó la tabla `ticket_photos` para inspecciones, aunque su esquema está diseñado para tickets.
- `stage` tiene un check incompatible con áreas de inspección como `kitchen`.
- Los nombres de archivo con espacios/símbolos producían keys inválidas en storage.
- La visualización usa dos criterios distintos para agrupar fotos.
- El flujo puede dejar archivos subidos sin registro si el insert falla.

6. En resumen, los errores exactos del flujo end-to-end
- Frontend:
  - usa solo el primer archivo seleccionado
  - depende de `user.id` para pasar RLS
- Mapping de datos:
  - usa `ticket_id` con un `inspection.id`
  - usa `ticket_photos` para algo que no es ticket
- Base de datos:
  - `ticket_photos_stage_check` solo acepta `start/process/close`
- Storage:
  - los nombres sin sanitizar producen `Invalid key`
- Lectura/UI:
  - una vista agrupa por path
  - otra por `stage`
  - eso rompe consistencia

7. Enfoque correcto para arreglarlo después
- Separar fotos de inspección del modelo de tickets:
  - idealmente con tabla propia para inspection photos o una estructura que relacione correctamente con `inspections`
- Guardar el área real explícitamente
- Mantener filename sanitization
- Unificar cómo se construyen y leen las URLs
- Evitar archivos huérfanos si falla el insert
- Mantener el bucket `inspection-photos` como backend de almacenamiento

## Technical details
```text
Current inspection upload flow:

AreaInspection.tsx
  file input
    -> build path inspections/{inspectionId}/{areaKey}/{safeFileName}
    -> storage bucket: inspection-photos
    -> insert row into ticket_photos
         ticket_id = inspectionId
         stage = 'process'
         technician_id = current user id
         url = storage path

Display:
  AreaInspection.tsx
    -> reads ticket_photos by ticket_id = inspectionId
    -> extracts area from url path

  InspectionDetail.tsx
    -> reads ticket_photos by ticket_id = inspectionId
    -> groups by stage

Schema conflict:
  ticket_photos.ticket_id -> FK to tickets.id
  inspection flow passes inspections.id

Constraint conflict:
  ticket_photos.stage CHECK IN ('start','process','close')
  inspection areas are values like kitchen, hvac, bedroom_1
```
