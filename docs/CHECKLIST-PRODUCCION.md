# 🚦 Checklist para producción real

Lo que falta para emitir facturas legales con datos reales. Ordenado por prioridad.
Leyenda: 🔴 bloqueante · 🟠 importante · 🟡 recomendado.

---

## 1. 🔴 Seguridad (antes de cualquier despliegue)

- [ ] **Rotar TODAS las llaves comprometidas.** Se compartieron por chat: `service_role`,
      `anon`/publishable de Supabase y el token de Vercel. Rótalas:
      Supabase → *Settings → API → Roll keys*; Vercel → revocar y crear token nuevo.
- [ ] **Proteger el certificado .pfx y su contraseña.** Nunca en el repo ni en el chat;
      solo en variables de entorno de Vercel (cifradas).
- [ ] **Contraseñas iniciales de aseadores.** Hoy la clave inicial = la cédula (dato
      conocible). Mitigado porque se obliga a cambiarla, pero conviene **reforzar
      `must_change_password` también en el middleware** (no solo en el layout) o usar
      una clave temporal aleatoria.
- [ ] **Deshabilitar/ocultar los endpoints de prueba DIAN** (`test-set`, `test-cufe`,
      `preview-xml`) en producción, o dejarlos solo para admin (ya exigen admin).
- [ ] 🟠 Rate limiting en login y rutas `/api` (evitar fuerza bruta / abuso).

## 2. 🔴 Habilitación y cumplimiento DIAN (lo legal)

- [x] **IVA configurable implementado.** La plomería ya calcula el IVA por línea y lo
      propaga consistente por CUFE + totales + XML + representación gráfica. Se controla
      con la variable `COMPANY_IVA_RATE` (por defecto **0** = exento, sin cambios). Verificado
      sin regresión: con tasa 0 el XML sigue pasando XSD + Schematron.
- [ ] **Confirmar la TASA con el contador (CRÍTICO).** Falta decidir el valor de
      `COMPANY_IVA_RATE`. ⚠️ Si aplica el régimen **AIU** de aseo/vigilancia, el IVA va
      sobre la base AIU (no sobre el total) y requiere lógica adicional — confirmar antes
      de poner una tasa distinta de 0.
- [ ] **Certificado de firma real** (.p12/.pfx de entidad autorizada) → convertir con
      `scripts/pfx-to-env.mjs` a `DIAN_PRIVATE_KEY_BASE64` / `DIAN_CERTIFICATE_BASE64`.
- [ ] **Datos reales de la resolución DIAN**: `INVOICE_PREFIX`, rango (`FROM`/`TO`),
      número y fecha, **clave técnica** (`DIAN_TECHNICAL_KEY`), `DIAN_SOFTWARE_ID`, `DIAN_SOFTWARE_PIN`.
- [ ] **Pasar el “Set de pruebas de habilitación”** en ambiente 2 (`DIAN_ENVIRONMENT=2`)
      hasta que la DIAN te marque **HABILITADO**.
- [ ] **Validar la firma XAdES contra un documento ACEPTADO real** por la DIAN
      (no solo el verificador interno, que siempre concuerda consigo mismo).
- [ ] **Verificar la autenticación WSS del SOAP** contra el WSDL real de la DIAN.
- [ ] **Activar el Schematron** (`DIAN_SCHEMATRON_ENFORCE=true`) una vez pasen todas las reglas.
- [ ] **Vigencia de la resolución**: el `EndDate` está fijo en `2030-12-31`; debe salir de la resolución real.
- [ ] **Pasar a producción**: `DIAN_ENVIRONMENT=1` y `NEXT_PUBLIC_DIAN_ENV=1`.

## 3. 🔴 Funcionalidad legal faltante

- [ ] **Envío de la factura al cliente.** La DIAN exige entregar al adquiriente la
      **representación gráfica (PDF) + el XML** validado. Hoy se puede imprimir/guardar
      PDF manualmente, pero **no hay envío automático por correo**. Falta implementarlo.
- [x] **Notas crédito (anulación/corrección) implementadas.** Generador UBL CreditNote
      (CUDE, BillingReference, DiscrepancyResponse) **validado contra el XSD y el Schematron
      oficiales de la DIAN**; tabla `credit_notes` + API `/api/dian/credit-note` (firma → XSD →
      Schematron → SOAP) + UI (botón “Nota crédito” en facturas validadas, con concepto/motivo).
      ⚠️ El **CUDE** sigue el Anexo (PIN en vez de clave técnica) pero debe verificarse contra un
      vector oficial antes de producción, igual que se hizo con el CUFE.
- [ ] 🟠 **Numeración de contingencia.** Plan para cuando la DIAN no responde
      (reintentos / cola). Hoy una factura puede quedar atascada en `processing` sin recuperación.

## 4. 🟠 Robustez y datos

- [x] **Validación fail-fast de variables de emisión implementada.** Antes de consumir un
      consecutivo, el envío verifica que estén todas las variables obligatorias
      (`COMPANY_*`, `INVOICE_*`, `DIAN_TECHNICAL_KEY`, `DIAN_SOFTWARE_*`) y, si falta alguna,
      responde con un mensaje claro en vez de generar un CUFE inválido.
- [ ] **Recuperación de facturas atascadas en `processing`** (si el pipeline se cae a mitad).
- [ ] **Parsear las respuestas SOAP de la DIAN con un parser XML real** (hoy usa regex,
      frágil ante variaciones de namespace).
- [ ] **Confirmar que las migraciones están aplicadas** en la BD de producción
      (`schema.sql` + `002`–`005`, incluida la que agrega el estado `processing`).
- [ ] **Backups / Point-in-Time Recovery** activados en Supabase.
- [ ] `maxDuration` del envío ya está en 60 s; confirmar que el **plan de Vercel** lo permite.

## 5. 🟠 Operación y monitoreo

- [ ] **Monitoreo de errores** (p. ej. Sentry) para el pipeline DIAN y la app.
- [ ] **Alertas de vencimiento del certificado** (hoy solo se audita; falta notificación real).
- [ ] **Revisar la bitácora de auditoría** (`audit_log`) y definir retención.
- [ ] **Actualizar Next.js** (16.2.6 tiene una vulnerabilidad media conocida → última 16.x).

## 6. 🟡 Legal / negocio

- [ ] **Política de tratamiento de datos (Habeas Data, Ley 1581/2012).** Se almacena
      PII de clientes y aseadores; se necesita política de privacidad y autorización.
- [ ] **Base AIU** para servicios de aseo/vigilancia (si aplica el régimen especial) — confirmar con contador.

## 7. 🟡 Calidad / QA

- [ ] **Prueba de punta a punta** del set de habilitación completo (factura, nota crédito, nota débito).
- [ ] **Prueba de concurrencia** de la numeración (varios envíos simultáneos sin huecos ni duplicados).
- [ ] Pruebas con clientes de distintos regímenes (IVA / no responsable / gran contribuyente).

---

### Resumen del camino crítico
1. **Rotar llaves** (seguridad).
2. **Contador define el IVA** (lo más importante para la corrección de las facturas).
3. **Trámite DIAN**: certificado + resolución + set de pruebas → habilitado.
4. **Envío al cliente + notas crédito** (funcionalidad legal faltante).
5. Validar firma/SOAP contra documentos reales → activar Schematron → producción.
