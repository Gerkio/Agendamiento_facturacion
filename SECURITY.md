# Seguridad y gobernanza de secretos

Este documento rige el manejo de secretos, certificados y trazabilidad del módulo
de facturación electrónica DIAN. Cumple las directrices #1, #2, #6 y #7 del marco de
gobernanza (Anexo Técnico DIAN).

## Secretos y su ubicación

| Secreto | Variable | Dónde vive (dev) | Dónde vive (prod) |
|---|---|---|---|
| Clave privada del certificado | `DIAN_PRIVATE_KEY_BASE64` | `.env.local` (gitignored) | **Secret Manager / Vault** |
| Certificado X.509 (público) | `DIAN_CERTIFICATE_BASE64` | `.env.local` | Secret Manager / Vault |
| Password del `.pfx` | `DIAN_CERTIFICATE_PASSWORD` | solo para `scripts/pfx-to-env.mjs` | no se despliega |
| PIN/ID de software DIAN | `DIAN_SOFTWARE_PIN`, `DIAN_SOFTWARE_ID` | `.env.local` | Secret Manager / Vault |
| Service role Supabase | `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | Secret Manager / Vault |

Reglas obligatorias:
- `.env.local` está en `.gitignore` — **nunca** se commitea.
- Los módulos que tocan secretos (`lib/supabase/admin.ts`, `lib/dian/xml-signer.ts`,
  `lib/dian/cert-validator.ts`) importan `server-only`: si alguien los importa en un
  componente cliente, **el build falla**. Garantiza que ningún secreto llegue al navegador.
- Las API no devuelven secretos ni certificados en sus respuestas.
- Los logs no imprimen claves, tokens, certificados ni el sobre SOAP.

## En producción: NO usar `.env.local`

`.env.local` es aceptable solo en desarrollo local. Para producción, inyectar los
secretos desde el gestor del hosting (Vercel Environment Variables cifradas, AWS Secrets
Manager, GCP Secret Manager, HashiCorp Vault). El código lee `process.env` igual; cambia
solo el origen.

## Rotación de secretos

Rotar de inmediato si un secreto se expone (chat, captura, log, repо):

- **Supabase service_role / anon:** Dashboard → Project Settings → API → *Roll keys*.
  Actualizar la variable en el gestor de secretos. Revocación inmediata del valor viejo.
- **Certificado DIAN:** solicitar reemisión a la entidad certificadora; regenerar los
  PEM con `scripts/pfx-to-env.mjs` y actualizar el secreto. Registrar el evento en `audit_log`.

> ⚠️ Las llaves compartidas durante el desarrollo (chat/soporte) se consideran
> comprometidas y **deben rotarse antes de pasar a producción**.

## Trazabilidad

Toda emisión, firma, validación de certificado y envío a DIAN se registra en la tabla
`audit_log` (usuario, acción, hora UTC, resultado y **hash SHA-384 del documento**).
Nunca se registran secretos. Ver `supabase/migrations/003_audit_log.sql` y `lib/audit/log.ts`.
