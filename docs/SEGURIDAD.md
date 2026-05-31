# 🛡️ Barrido de seguridad — protección de datos sensibles

Endurecimiento defensivo de la app (maneja PII: NIT, correos, direcciones, cédulas).
Enfoque: **defensa en profundidad** (base de datos → red → aplicación).

## Lo aplicado en este barrido

### 1. Headers de seguridad ([next.config.ts](../next.config.ts))
- **Content-Security-Policy**: restringe de dónde se cargan scripts/estilos/imágenes/conexiones.
  `frame-ancestors 'none'` + `object-src 'none'` + `connect-src` limitado a la app y Supabase.
  En producción es estricta (sin `unsafe-eval`, con `upgrade-insecure-requests`); en dev se relaja para el HMR.
- **Strict-Transport-Security** (HSTS): fuerza HTTPS por 2 años, subdominios incluidos.
- **X-Frame-Options: DENY** + **frame-ancestors**: anti-clickjacking.
- **X-Content-Type-Options: nosniff**: evita ataques por adivinación de MIME.
- **Referrer-Policy: strict-origin-when-cross-origin**: no filtra URLs completas a terceros.
- **Permissions-Policy**: desactiva cámara, micrófono, geolocalización, pagos, USB.
- **x-powered-by eliminado**: menos huella para fingerprinting.

### 2. Mínimo privilegio en RLS ([migración 006](../supabase/migrations/006_rls_least_privilege.sql))
> ⚠️ **Pendiente: ejecutar `006_rls_least_privilege.sql` en el SQL Editor de Supabase.**
- Antes, **cualquier aseador** autenticado podía leer la base **completa** de clientes
  (NIT, correo, dirección, teléfono) y de limpiadores pegando directo a la API.
- Ahora un aseador solo lee **los clientes con un servicio asignado a él** y **su propia ficha**.
  Limita el daño si una cuenta de aseador se ve comprometida.

### 3. Defensa CSRF ([origin.ts](../src/lib/auth/origin.ts))
- Verificación de **mismo origen** en todas las rutas que mutan datos
  (`cleaners/create`, `cleaners/[id]` DELETE, `reset-password`, `dian/send`, `change-password`).
  Complementa las cookies SameSite de Supabase.

### 4. Validación y no-filtración
- **IDs validados como UUID** antes de tocar la base (`dian/send`, rutas de limpiadores).
- El envío a la DIAN ya **no devuelve el mensaje de error interno** al cliente
  (solo un mensaje genérico; el detalle queda en la bitácora, accesible solo a admin).
- Endpoints de prueba DIAN exigen **admin** (cerrado en un barrido anterior).

### 5. Cambio de contraseña forzado en el middleware ([middleware.ts](../src/middleware.ts))
- La contraseña inicial de un aseador = su cédula (conocible). Ahora el **middleware**
  exige cambiarla **antes de acceder a cualquier ruta** (páginas → redirige a
  `/auth/change-password`; APIs → 403), no solo en el layout del dashboard.
  Cierra la ventana de toma de cuenta con la contraseña inicial.

## Lo que ya estaba bien (verificado)
- **RLS habilitado** en las 5 tablas; servicios e invoices sin IDOR.
- **Bitácora (`audit_log`) inmutable**: solo lectura de admin, escritura solo por `service_role`.
- **`service_role` server-only**: no llega al bundle del cliente; funciones `SECURITY DEFINER` con `search_path` fijo.
- **Supabase Auth** ya aplica rate-limiting propio al login (mitiga fuerza bruta).
- Numeración de facturas **atómica e idempotente**.

## Pendiente / recomendado (no bloqueante)
- [ ] **Ejecutar la migración 006** en Supabase (clave para que el mínimo privilegio tenga efecto).
- [ ] **Rotar las llaves comprometidas** (compartidas por chat): Supabase `service_role`/`anon`, token Vercel.
- [ ] **CSP con nonce** para eliminar `'unsafe-inline'` en scripts (XSS aún más fuerte) — requiere middleware.
- [ ] **Rate-limiting propio** en las rutas `/api` sensibles (defensa extra sobre la de Supabase).
- [ ] Activar **backups / PITR** en Supabase.
