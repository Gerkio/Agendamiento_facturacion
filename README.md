# CleanSched & Direct Billing Colombia

Aplicación interna para una empresa de aseo: agenda servicios manualmente y emite
facturas electrónicas **directamente a la DIAN** (UBL 2.1 + firma XAdES-EPES + SOAP/WSS),
sin APIs intermediarias de pago.

**Stack:** Next.js (App Router) · Supabase · FullCalendar.io · criptografía nativa de Node.js.

---

## 1. Requisitos

- Node.js 20+ y npm
- Una cuenta gratuita de [Supabase](https://supabase.com)
- `openssl` en el PATH (sólo para la conversión inicial del certificado)
- Certificado de firma digital `.pfx` / `.p12` (lo entrega la DIAN)

## 2. Instalación

```bash
npm install
cp .env.local.example .env.local   # luego edita .env.local
```

En Windows también puedes ejecutar `iniciar.bat`, que instala dependencias si faltan,
levanta el servidor y abre el navegador.

## 3. Base de datos (Supabase)

1. Crea un proyecto en Supabase.
2. En **SQL Editor**, pega y ejecuta [`supabase/schema.sql`](supabase/schema.sql).
   Esto crea las tablas (`clients`, `cleaners`, `services`, `invoices`, `user_profiles`),
   las políticas RLS por rol y el trigger que crea el perfil al registrarse un usuario.
3. Crea tu usuario administrador:
   - **Authentication → Users → Add user** (email + password).
   - En **SQL Editor**: `update user_profiles set role = 'admin' where email = 'tu@correo.com';`
4. Para vincular un usuario "limpiador" a su ficha:
   `update user_profiles set role = 'cleaner', cleaner_id = '<uuid>' where email = '...';`

Copia el **Project URL** y la **anon key** (Settings → API) a `.env.local`.

## 4. Certificado DIAN

Node firma con claves PEM y no extrae la clave de un `.pfx` de forma nativa, así que se
convierte **una sola vez**:

```bash
node scripts/pfx-to-env.mjs ruta/al/certificado.pfx TU_PASSWORD
```

El script imprime `DIAN_PRIVATE_KEY_BASE64=...` y `DIAN_CERTIFICATE_BASE64=...`
listos para pegar en `.env.local`. (Si el `.pfx` usa cifrado antiguo, el script
reintenta automáticamente con `openssl -legacy`.)

Completa también `DIAN_SOFTWARE_ID`, `DIAN_SOFTWARE_PIN`, `DIAN_TECHNICAL_KEY` y los
datos de empresa/resolución según tu habilitación DIAN.

## 5. Ejecutar

```bash
npm run dev      # http://localhost:3000
```

- `/auth/login` — inicio de sesión
- `/dashboard` — calendario (admin: todos; limpiador: sólo los suyos)
- `/dashboard/clients`, `/dashboard/cleaners` — directorios (admin)
- `/dashboard/invoices` — motor de facturación + envío a DIAN + notas crédito
- `/dashboard/debug` — conjunto de pruebas DIAN (preview XML, CUFE, test set)

## 6. Pipeline DIAN

| Paso | Módulo | Qué hace |
|------|--------|----------|
| 1 | [`lib/dian/xml-generator.ts`](src/lib/dian/xml-generator.ts) | Genera el XML UBL 2.1 |
| 2 | [`lib/dian/cufe-calculator.ts`](src/lib/dian/cufe-calculator.ts) | Calcula el CUFE (SHA-384, Anexo 1.9) |
| 3 | [`lib/dian/xml-signer.ts`](src/lib/dian/xml-signer.ts) | Firma XAdES-EPES (RSA-SHA256) |
| 4 | [`lib/dian/soap-wrapper.ts`](src/lib/dian/soap-wrapper.ts) | Envuelve en SOAP 1.2 + WSS, comprime ZIP |
| 5 | [`lib/dian/dian-client.ts`](src/lib/dian/dian-client.ts) | Envía a DIAN y parsea la respuesta |

Orquestado por [`app/api/dian/send/route.ts`](src/app/api/dian/send/route.ts).
Las **notas crédito** (anulación/corrección) usan el mismo pipeline:
[`lib/dian/credit-note-generator.ts`](src/lib/dian/credit-note-generator.ts) +
[`lib/dian/cude-calculator.ts`](src/lib/dian/cude-calculator.ts), orquestadas por
[`app/api/dian/credit-note/route.ts`](src/app/api/dian/credit-note/route.ts).

La factura y la nota crédito se validan contra el **XSD y el Schematron oficiales** de la
DIAN antes de enviarse (`npm run align:generator`, `npm run validate:credit-note`).

## 📚 Documentación

- [`docs/PUESTA-EN-MARCHA.md`](docs/PUESTA-EN-MARCHA.md) — pasos DIAN, datos de empresa y despliegue.
- [`docs/CHECKLIST-PRODUCCION.md`](docs/CHECKLIST-PRODUCCION.md) — qué falta para producción real.
- [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) — barrido de seguridad aplicado.
- [`SECURITY.md`](SECURITY.md) — política de manejo de secretos.

## ⚠️ Pendiente antes de producción

Ver el [checklist completo](docs/CHECKLIST-PRODUCCION.md). En resumen: confirmar la **tasa de IVA**
con el contador, obtener el **certificado y la resolución reales**, pasar el **set de habilitación**
de la DIAN, y verificar **CUFE/CUDE/firma** contra vectores/documentos oficiales aceptados.
