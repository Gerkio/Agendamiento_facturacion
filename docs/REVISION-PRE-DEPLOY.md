# ✅ Revisión pre-despliegue — Checklist de productividad y funcionalidad

Revisión a fondo del código (4 revisores: pipeline DIAN, UI, seguridad/auth, build).
Estado final: **typecheck ✅ · lint ✅ (0 errores)**.

## A. Arreglado en esta revisión

### Seguridad
- [x] Los 3 endpoints de prueba DIAN (`test-cufe`, `preview-xml`, `test-set`) ahora exigen **admin** (`requireAdmin`). Antes, un limpiador autenticado podía disparar envíos reales a la DIAN.
- [x] `reset-password`: valida longitud mínima de la contraseña personalizada (antes aceptaba 1 carácter).
- [x] Auditoría: se registran `cleaner_created` y `password_reset` (la infraestructura existía pero no se llamaba).

### Correctitud
- [x] Creación de limpiador: **rollback completo** si falla el vínculo de perfil (antes dejaba una cuenta huérfana sin `cleaner_id` y sin forzar cambio de clave).
- [x] Facturación: al crear factura, si falla vincular los servicios se **revierte** el borrador (antes quedaba huérfano y se mostraba como éxito).
- [x] Filtro de fechas en facturación: corregido el desfase de **zona horaria** (UTC-5); antes colaba/cortaba servicios de las primeras/últimas horas del día.
- [x] "Ver factura": guardia **anti-carrera** al abrir documentos seguidos (evita mezclar ítems).
- [x] "Duplicar semana": ahora solo copia servicios **agendados** (no completados ni facturados).
- [x] Reprogramar por arrastre y activar/desactivar limpiador: ahora **avisan si fallan** (antes silenciaban el error).
- [x] Lista de facturas: estado con **fallback** (no se rompe ante un estado inesperado).

### Build / Deploy
- [x] Ruta de envío DIAN: `export const runtime='nodejs'` y `maxDuration=60` (evita timeout en Vercel con WASM + SOAP).
- [x] Bug SOAP: `Expires` del Timestamp era ~16 h (60000 s) → corregido a 1 h (3600 s).
- [x] **ESLint** configurado (flat config de Next 16); el script `lint` estaba roto (`next lint` no existe en Next 16).
- [x] `engines.node >= 20` fijado.
- [x] Eliminado `tailwind.config.ts` (config v3 muerta; los colores ya están en `globals.css @theme`).
- [x] Dependencias: quitadas `rrule`, `@fullcalendar/rrule`, `autoprefixer`, `playwright` (sin uso); `@types/qrcode` movido a devDeps.

### Limpieza
- [x] `formatCOP` unificado en `src/lib/format.ts` (estaba duplicado en 3 archivos).
- [x] `aria-label` en buscadores y `type="button"` en botones que faltaban.

## B. Decisiones de GO-LIVE (requieren tu confirmación, el contador o la DIAN)

> Estas NO se tocaron a propósito: cambiarlas a ciegas violaría "nunca inventar"
> estructuras/respuestas DIAN, o son decisiones tributarias.

- [ ] **IVA = 0 (CRÍTICO).** Hoy toda factura se emite con IVA 0 ("servicios de aseo exentos").
      En Colombia los servicios de aseo **suelen estar gravados al 19%** (con base AIU especial).
      → **Confirmar con el contador.** Si son gravados, hay que calcular el IVA y propagarlo por
      CUFE + totales + cada línea (hoy todo está forzado a cero, así que es consistente pero podría
      estar mal). Archivos: `api/dian/send/route.ts`, `lib/dian/xml-generator.ts`.
- [ ] **Autenticación WSS del SOAP.** El `PasswordDigest` del UsernameToken debe verificarse contra
      el WSDL real de la DIAN (DIAN autentica por el certificado/firma del documento; el token puede
      ser vestigial). No se cambia sin la fuente oficial. Archivo: `lib/dian/soap-wrapper.ts`.
- [ ] **Firma XAdES / canonicalización.** Validar la firma contra un documento **aceptado real** de la
      DIAN (no solo el verificador interno, que siempre concuerda consigo mismo). Archivo: `lib/dian/xml-signer.ts`.
- [ ] **Vigencia de la resolución.** `EndDate` de la autorización está fijo en `2030-12-31`; debería salir
      de la resolución real. Archivo: `lib/dian/xml-generator.ts`.
- [ ] **Variables requeridas en producción.** Validar al arranque que `COMPANY_NIT`, `DIAN_TECHNICAL_KEY`,
      etc. existan (hoy un valor faltante produce un CUFE inválido en vez de un error claro).
- [ ] **Actualizar Next.js.** `next@16.2.6` tiene una vulnerabilidad media conocida → subir a la última 16.x.

## C. Mejoras opcionales (no bloquean el deploy)
- [ ] Recuperación de facturas atascadas en `processing` (si el pipeline se cae a mitad).
- [ ] Parsear las respuestas SOAP de la DIAN con un parser XML real en vez de regex (`lib/dian/dian-client.ts`).
- [ ] Consolidar las listas de ciudades y los mapas de estado (hoy duplicados en 2-3 lugares).
- [ ] Endurecer `must_change_password` también en middleware (defensa en profundidad).
