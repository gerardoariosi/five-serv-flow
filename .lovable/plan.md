
# Fix: Master PIN sigue fallando al crear el primer PIN

## Diagnóstico exacto
El problema ya no está en el formulario visual del PIN. El fallo real es de permisos.

La app decide si eres admin usando `users.roles`, pero la base de datos protege `master_pin` usando `user_roles` con la función `has_role(...)`.

Eso crea una inconsistencia:

- En frontend puedes entrar a Settings como admin
- Pero al guardar en `master_pin`, la política RLS solo te deja si también existes en `user_roles`

Revisando los datos actuales:
- `master_pin` sí existe y sigue en `0000`
- Hay usuarios admin en `users.roles`
- Pero al menos un admin (`owner@fiveserv.net`) no tiene fila en `user_roles`

Si estás entrando con un usuario que tiene `roles: ['admin']` en `users` pero no tiene su fila correspondiente en `user_roles`, el update del primer PIN falla y la UI solo muestra el error genérico `"Failed to update PIN"` / `"fail"`.

## Qué está roto
### 1. Doble fuente de verdad para roles
- `useAuth.ts` carga roles desde `users.roles`
- navegación y UI usan esos roles
- pero RLS de `master_pin` usa `has_role()` sobre `user_roles`

### 2. Mensaje de error poco útil
En `SettingsPage.tsx`, cualquier error del save cae en:
- `"Failed to update PIN."`

Por eso parece un fallo misterioso, cuando en realidad probablemente es un rechazo por permisos.

## Qué construir
### Paso 1: Corregir la fuente de roles en autenticación
Actualizar `useAuth.ts` para que el perfil lea los roles desde `user_roles`, no desde `users.roles`.

Objetivo:
- que frontend y RLS usen la misma fuente de verdad
- si el usuario no tiene rol real en `user_roles`, no aparezca como admin en UI

### Paso 2: Corregir el bootstrap / gestión de usuarios
Revisar los flujos que crean o editan usuarios para garantizar sincronización total:
- `SetupStep3.tsx`
- `UserManagement.tsx`

Regla:
- cuando se crea/administra un usuario, siempre mantener `user_roles` consistente
- opcionalmente dejar `users.roles` solo como legado visual o dejar de depender de él en frontend

### Paso 3: Mejorar el error del Master PIN
En `SettingsPage.tsx`, mostrar el mensaje real cuando falle el save:
- si el error viene por RLS/permisos, mostrar algo como:
  - “Your account does not have permission to update the Master PIN.”
- no esconderlo detrás de “Failed”

### Paso 4: Endurecer el estado inicial del primer PIN
Mantener la lógica actual:
- si `pin === '0000'`, mostrar flujo de “Set PIN”
- ocultar “Current PIN”
- permitir update directo del registro existente

Pero además:
- diferenciar error de permisos vs error de validación
- evitar que el usuario piense que el problema es el PIN actual

## Archivos a tocar
- `src/hooks/useAuth.ts`
- `src/pages/settings/SettingsPage.tsx`
- `src/pages/setup/SetupStep3.tsx`
- `src/pages/settings/UserManagement.tsx`

## Resultado esperado
Después del arreglo:
- solo los admins reales podrán ver/usar Settings como admin
- el primer Master PIN se podrá crear si el usuario tiene rol admin real
- si no tiene permisos reales, el sistema lo dirá claramente
- se elimina la inconsistencia entre frontend y RLS

## Technical details
```text
Current failing path:

Frontend admin check:
users.roles -> shows admin UI

Database admin check:
master_pin RLS -> has_role(auth.uid(), 'admin') -> checks user_roles

Mismatch:
user looks admin in UI
but DB rejects update

Current master_pin row:
pin = '0000'

So first-PIN flow is logically correct now,
but save still fails when logged-in user is missing user_roles row.
```
