# 🚀 Puesta en marcha — CleanSched & Facturación DIAN

Guía paso a paso para dejar el sistema 100% operativo y legal. Cinco fases:

1. Trámites ante la DIAN
2. Datos que necesito de la empresa
3. Certificado de firma (.pfx → variables)
4. Base de datos (Supabase)
5. Despliegue en Vercel

> ⚠️ **Seguridad primero:** las llaves de Supabase y el token de Vercel que se
> compartieron por chat se consideran **comprometidos**. Antes de producción:
> Supabase → *Project Settings → API → Roll keys*, y Vercel → revoca y crea un
> token nuevo. Nunca pongas el `service_role` ni el certificado en el código ni
> en el chat.

---

## FASE 1 — Trámites ante la DIAN (lo hace la empresa)

Estos pasos se hacen en el portal de la DIAN (muisca / portal de factura
electrónica). El orden y los nombres exactos de los menús los confirmas en el
portal; aquí va el flujo estándar de **habilitación como facturador electrónico**:

- [ ] **1.1 RUT actualizado** con la responsabilidad de **facturación electrónica**
      (responsabilidad *“52 - Facturador electrónico”*).
- [ ] **1.2 Inscribirse en el Servicio de Factura Electrónica** y entrar al módulo
      de **Habilitación**.
- [ ] **1.3 Registrar el software de facturación.** La DIAN te entrega:
  - **SoftwareID** (un UUID) → variable `DIAN_SOFTWARE_ID`
  - **PIN del software** (lo defines tú al registrarlo) → variable `DIAN_SOFTWARE_PIN`
- [ ] **1.4 Solicitar la Resolución de numeración** de facturación electrónica.
      La resolución te da:
  - **Prefijo** → `INVOICE_PREFIX`
  - **Rango autorizado** (desde / hasta) → `INVOICE_FROM_NUMBER` / `INVOICE_TO_NUMBER`
  - **Número y fecha de la resolución** → `INVOICE_RESOLUTION_NUMBER` / `INVOICE_RESOLUTION_DATE`
  - **Clave técnica (ClvTec)** → `DIAN_TECHNICAL_KEY`
- [ ] **1.5 Comprar el certificado de firma digital** (.p12 / .pfx) a una entidad
      autorizada (Certicámara, Andes SCD, GSE, etc.), a nombre del representante
      legal o de la empresa. → se convierte en `DIAN_PRIVATE_KEY_BASE64` y
      `DIAN_CERTIFICATE_BASE64` (ver Fase 3).
- [ ] **1.6 Pasar el “Set de pruebas de habilitación”.** La DIAN exige enviar con
      éxito un conjunto de documentos (facturas, notas crédito y débito) en el
      **ambiente de pruebas** (`DIAN_ENVIRONMENT=2`). Cuando todos pasan, la DIAN
      cambia tu estado a **HABILITADO**.
- [ ] **1.7 Pasar a Producción.** Una vez habilitado, cambias `DIAN_ENVIRONMENT=1`
      (y `NEXT_PUBLIC_DIAN_ENV=1`). Las URLs de envío ya están configuradas en el
      código para ambos ambientes.

> 📌 El detalle oficial está en el **Anexo Técnico 1.9** de la DIAN (se descarga de
> la *Caja de Herramientas* en el portal de la DIAN; se retiró del repo por peso).
> Si algún nombre de campo o menú difiere, manda la captura y lo ajustamos — no se
> inventan valores.

---

## FASE 2 — Datos que necesito de la empresa

Pásame estos datos (van a las variables `COMPANY_*` e `INVOICE_*`). Hoy están con
valores de ejemplo y por eso la factura muestra el aviso “datos de demostración”.

| Dato | Variable | Ejemplo |
|---|---|---|
| NIT (sin dígito de verificación) | `COMPANY_NIT` | `901234567` |
| Dígito de verificación | `COMPANY_DV` | `8` |
| Razón social | `COMPANY_NAME` | `AMARU Servicios de Aseo S.A.S.` |
| Dirección | `COMPANY_ADDRESS` | `Cra 50 # 10-20` |
| Código de ciudad (DANE) | `COMPANY_CITY_CODE` | `05001` (Medellín) |
| Esquema tributario | `COMPANY_TAX_SCHEME` | `01` (IVA) o `ZV` |
| Régimen fiscal | `COMPANY_FISCAL_REGIMEN` | `O-13`, `O-47`, etc. |
| Correo de facturación | `COMPANY_EMAIL` | `facturacion@amaru.co` |
| Teléfono | `COMPANY_PHONE` | `6041234567` |

Más los que entrega la DIAN (Fase 1): `INVOICE_PREFIX`, `INVOICE_RESOLUTION_NUMBER`,
`INVOICE_RESOLUTION_DATE`, `INVOICE_FROM_NUMBER`, `INVOICE_TO_NUMBER`,
`DIAN_SOFTWARE_ID`, `DIAN_SOFTWARE_PIN`, `DIAN_TECHNICAL_KEY`.

---

## FASE 3 — Certificado de firma (.pfx → variables)

El certificado viene en `.pfx`/`.p12`. Node firma con PEM, así que se convierte
**una sola vez** a dos valores base64:

```bash
node scripts/pfx-to-env.mjs ruta/al/certificado.pfx TU_PASSWORD
```

Ese comando imprime listas para pegar:

```
DIAN_PRIVATE_KEY_BASE64=...
DIAN_CERTIFICATE_BASE64=...
```

- [ ] Ejecutar el script y copiar las dos líneas a las variables de entorno.
- [ ] **NO** subir el `.pfx` ni el password al repositorio. El password
      (`DIAN_CERTIFICATE_PASSWORD`) solo lo usa ese script localmente.

---

## FASE 4 — Base de datos (Supabase)

En **Supabase → SQL Editor**, ejecuta en orden (una vez):

- [ ] `supabase/schema.sql` — tablas base (clientes, limpiadores, servicios, facturas, perfiles).
- [ ] `supabase/migrations/002_cleaner_users.sql` — usuarios de limpiadores + cambio de contraseña.
- [ ] `supabase/migrations/003_audit_log.sql` — registro de auditoría DIAN.
- [ ] `supabase/migrations/004_invoice_numbering.sql` — consecutivo atómico + estado `processing`.
- [ ] `supabase/migrations/005_client_indicaciones.sql` — campo de indicaciones de llegada.

Luego:

- [ ] Crear tu usuario administrador (registrarte en la app) y marcarlo admin:
  ```sql
  update user_profiles set role = 'admin' where email = 'tu-correo@dominio.com';
  ```
- [ ] (Opcional) Revisar `supabase/seed.sql` si quieres datos de ejemplo.

---

## FASE 5 — Despliegue en Vercel

### 5.1 Subir el código a GitHub
- [ ] Confirmar que `.env.local` está en `.gitignore` (lo está) — **nunca** se sube.
- [ ] Crear el repo y hacer push:
  ```bash
  git init
  git add .
  git commit -m "CleanSched & Facturación DIAN"
  git branch -M main
  git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
  git push -u origin main
  ```

> Nota: la carpeta `dian/` con los artefactos oficiales (XSD, Schematron `.sef.json`)
> **sí** se necesita en el deploy (el código los carga en `/api/dian`). El PDF de
> 11 MB del Anexo y la “Caja de herramientas” completa puedes excluirlos del repo
> para no pesar — no se usan en runtime.

### 5.2 Importar en Vercel
- [ ] En vercel.com → **Add New → Project → Import** tu repo de GitHub.
- [ ] Framework: **Next.js** (se detecta solo). No cambies el build command.

### 5.3 Cargar TODAS las variables de entorno
En **Project → Settings → Environment Variables**, agrega cada variable de tu
`.env.local` (usa el entorno *Production*; repite en *Preview* si lo necesitas):

**Supabase**
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` *(secreta)*

**Certificado DIAN** *(secretas)*
- [ ] `DIAN_PRIVATE_KEY_BASE64`
- [ ] `DIAN_CERTIFICATE_BASE64`

**Software / Resolución DIAN**
- [ ] `DIAN_SOFTWARE_ID`
- [ ] `DIAN_SOFTWARE_PIN` *(secreta)*
- [ ] `DIAN_TECHNICAL_KEY` *(secreta)*
- [ ] `DIAN_ENVIRONMENT` (empieza en `2`, luego `1`)
- [ ] `NEXT_PUBLIC_DIAN_ENV` (igual que el anterior)

**Validaciones**
- [ ] `DIAN_XSD_ENFORCE=true`
- [ ] `DIAN_SCHEMATRON_ENFORCE=false` (lo subes a `true` cuando valides todo el set)
- [ ] `DIAN_CERT_EXPIRY_WARNING_DAYS=30`
- [ ] `DIAN_CA_BUNDLE_BASE64` *(opcional)*

**Empresa**
- [ ] `COMPANY_NIT`, `COMPANY_DV`, `COMPANY_NAME`, `COMPANY_ADDRESS`,
      `COMPANY_CITY_CODE`, `COMPANY_TAX_SCHEME`, `COMPANY_FISCAL_REGIMEN`,
      `COMPANY_EMAIL`, `COMPANY_PHONE`

**Numeración**
- [ ] `INVOICE_PREFIX`, `INVOICE_RESOLUTION_NUMBER`, `INVOICE_RESOLUTION_DATE`,
      `INVOICE_FROM_NUMBER`, `INVOICE_TO_NUMBER`

### 5.4 Deploy y verificación
- [ ] **Deploy**. Vercel construye y publica.
- [ ] Entrar a la URL, iniciar sesión como admin.
- [ ] Crear un cliente y un limpiador de prueba.
- [ ] Agendar un servicio y marcarlo *completado*.
- [ ] Generar una factura **borrador** → **Ver factura** (debe verse la
      representación gráfica con tus datos reales).
- [ ] Con `DIAN_ENVIRONMENT=2`, **Enviar DIAN** y revisar la respuesta del set
      de pruebas hasta habilitar.
- [ ] Cuando la DIAN te habilite → cambiar a `DIAN_ENVIRONMENT=1` y `NEXT_PUBLIC_DIAN_ENV=1`, re-deploy.

---

## ✅ Resumen del “quién hace qué”

| Quién | Qué |
|---|---|
| **La empresa / contador** | Fase 1 completa (RUT, software, resolución, certificado, set de pruebas). |
| **Tú (admin)** | Pasarme los datos de Fase 2 y las llaves DIAN de Fase 1; correr migraciones (Fase 4); cargar variables y desplegar (Fase 5). |
| **Yo (sistema)** | Ya genera CUFE, XML UBL 2.1, firma XAdES, valida XSD/Schematron, envía a la DIAN y produce la representación gráfica con QR. |

> Mientras no tengas la habilitación real, todo funciona en **ambiente de pruebas**:
> puedes ver, imprimir y guardar PDF de las facturas (marcadas como proforma/pruebas)
> sin riesgo fiscal.
