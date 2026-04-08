
Diagnóstico exacto:

- El 2FA sí está generando el código correctamente.
- El 2FA sí lo está guardando en la base de datos correctamente.
- Lo que está fallando es el envío del email después de generar el código.

Qué está pasando en tu flujo:
1. Login de admin entra bien.
2. La pantalla `/verify-2fa` llama a `send-2fa-code`.
3. `send-2fa-code` genera el OTP de 6 dígitos y lo inserta en `two_factor_codes`.
4. Después lo manda a la cola de correos `transactional_emails`.
5. El procesador de correos intenta enviarlo 5 veces.
6. El proveedor de email lo rechaza las 5 veces.
7. Finalmente ese correo cae en DLQ y nunca llega al inbox.

La causa exacta del fallo:
- El correo 2FA se está encolando como `purpose: "transactional"`.
- Pero ese payload NO incluye `unsubscribe_token`.
- El procesador devuelve este error exacto en los logs:

```text
Email API error: 400
missing_unsubscribe
Transactional emails must include an unsubscribe_token
```

Por eso no llega:
- No es que no se genere el OTP.
- No es que falle el login.
- No es que falle la tabla `two_factor_codes`.
- Falla porque el email es rechazado por la infraestructura de envío antes de salir.

Por qué los demás correos sí llegan:
- Los otros correos de la app sí siguen el formato correcto para correos transaccionales.
- Por ejemplo, otros flujos agregan `unsubscribe_token` antes de encolar.
- Los correos del sistema de autenticación usan otro patrón distinto.
- El 2FA quedó en un punto intermedio: usa la cola nueva, pero no arma el payload completo que esa cola exige.

Sobre el registro que viste en `two_factor_codes`:
- Ese registro solo prueba que el código fue creado.
- No prueba que el email fue entregado.
- En tu caso:
  - `used = false` significa que nadie logró verificarlo.
  - `expires_at` es la hora límite del código.
  - El código que mostraste (`101419`) ya estaba expirado.
- Además encontré un código más reciente para ese mismo usuario:
  - `633732`
  - creado a las `22:20:26 UTC`
  - expiraba a las `22:30:26 UTC`
- Ese también fue generado, pero su email igualmente falló.

Evidencia real en logs:
- Para `gerardoariosi@gmail.com`, el mensaje 2FA más reciente terminó así:
  - 5 intentos fallidos por `missing_unsubscribe`
  - luego estado final `dlq`
- O sea: sí salió de la app, sí entró a la cola, pero el sistema de correo lo rechazó cada vez.

Servicio que realmente lo está manejando:
- No lo está mandando el flujo nativo de autenticación.
- Lo está mandando la infraestructura de correos de la app a través de:
  - `send-2fa-code` -> cola `transactional_emails` -> `process-email-queue`
- El problema está en cómo se construye ese payload de 2FA para esa infraestructura.

Qué está roto en código:
- `supabase/functions/send-2fa-code/index.ts`
  - encola el 2FA como transaccional
  - no adjunta `unsubscribe_token`
- `supabase/functions/process-email-queue/index.ts`
  - intenta enviarlo correctamente
  - pero recibe 400 del proveedor y lo reintenta hasta moverlo a DLQ

Plan de arreglo correcto:
1. Corregir `send-2fa-code` para que el payload del correo 2FA cumpla con lo que exige la cola de correos.
2. Alinear este flujo con el mismo patrón que usan los correos que sí llegan.
3. Verificar después en logs que el estado pase de `pending` a `sent`, en lugar de `failed`/`dlq`.

## Technical details
```text
Current failing path:

Login.tsx
  -> admin redirected to /verify-2fa

VerifyTwoFactor.tsx
  -> invoke send-2fa-code

send-2fa-code
  -> generate 6-digit code
  -> insert into two_factor_codes
  -> enqueue into transactional_emails
     purpose: "transactional"
     NO unsubscribe_token

process-email-queue
  -> tries to send
  -> email API rejects:
     "Transactional emails must include an unsubscribe_token"
  -> retries 5 times
  -> moves message to DLQ

Result:
  two_factor_codes row exists
  email never delivered
```
