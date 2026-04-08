

# Fix: Master PIN — No se puede crear el primer PIN

## Problema
La tabla `master_pin` ya tiene un registro con el PIN por defecto `0000` (insertado automáticamente). La UI solo muestra un formulario de "Update PIN" que pide el "Current PIN". Como nunca configuraste un PIN, no sabes que el valor actual es `0000`, así que no puedes actualizarlo.

## Solución
Modificar `MasterPinSection` en `SettingsPage.tsx` para detectar si el PIN es el valor por defecto (`0000`) y en ese caso:

1. **Ocultar el campo "Current PIN"** — no tiene sentido pedirlo si nunca se configuró
2. **Mostrar un aviso** tipo "No PIN configured yet. Set your first PIN below."
3. **Saltar la validación** de `currentPin !== pinData?.pin` cuando el PIN actual es `0000`
4. **Cambiar el botón** a "Set PIN" en vez de "Update PIN" cuando es la primera vez

### Cambio único
**Archivo:** `src/pages/settings/SettingsPage.tsx` (líneas 340-380)

- Agregar `const isDefault = pinData?.pin === '0000';`
- Si `isDefault`: no renderizar el input de "Current PIN", no validar current pin
- Si no `isDefault`: mantener el flujo actual de 3 campos
- Ajustar texto del botón dinámicamente

No se requieren cambios en la base de datos ni migraciones.

