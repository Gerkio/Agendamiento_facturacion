# Artefactos oficiales DIAN — Facturación Electrónica 1.9

Repositorio local de los insumos normativos y técnicos para la integración directa
con la DIAN. Adopción vigente: **Resolución 000165 de 2023** (Anexo Técnico Factura
Electrónica de Venta v1.9 + Documento Equivalente Electrónico v1.0).

> ⚠️ Por la directriz #10 (no inventar), los artefactos oficiales **no se generan**:
> se descargan del micrositio de Documentación Técnica DIAN y de la **Caja de
> Herramientas 1.9**, y se colocan en las carpetas indicadas. El preflight
> `node scripts/check-dian-artifacts.mjs` verifica que existan.

## Estructura y qué va en cada carpeta

| Carpeta | Contenido | Fuente | Estado |
|---|---|---|---|
| `anexo-1.9/` | Anexo Técnico FE v1.9 (PDF) | Micrositio DIAN | ✅ presente |
| `resoluciones/` | Resolución 000165 de 2023 (PDF) | DIAN | ⬜ pendiente |
| `xsd/` | **XSD oficiales DIAN** (UBL maindoc + common + `DIAN_UBL_Structures.xsd`) | Caja de Herramientas 1.9 | ✅ presente (valida ejemplos oficiales) |
| `catalogos/` | Tablas/catálogos (tributos, municipios, etc.) | Caja → "Listas de valores" | ⬜ pendiente |
| `ejemplos-xml/` | XML válidos de ejemplo (factura, NC, ND) | Caja → "Ejemplificaciones" | ⬜ pendiente |
| `wsdl/` | WSDL de los Web Services DIAN | Guías de WS DIAN (aparte) | ⛔ falta |
| `soap/` | Ejemplos de sobre SOAP / WS-Security | Caja de Herramientas 1.9 | ⬜ pendiente |
| `tablas-referenciadas/` | Tablas referenciadas del Anexo | DIAN | ⬜ pendiente |
| Schematron reglas de negocio | `DIAN-UBL21-model.sch` (capa 2) | Caja → "Schemes" | ✅ disponible en la Caja |

> El validador [`src/lib/dian/xsd-validator.ts`](../src/lib/dian/xsd-validator.ts) ya usa el set **oficial DIAN** de `dian/xsd/` (capa 1, verificado contra los ejemplos firmados de la Caja).

## Esquemas UBL 2.1 (OASIS) ya disponibles

El cierre OASIS UBL 2.1 (incluye `UBL-XAdESv132/141` y `UBL-xmldsig-core`) está en
[`schemas/ubl21/`](../schemas/ubl21/) y lo usa el validador
[`src/lib/dian/xsd-validator.ts`](../src/lib/dian/xsd-validator.ts) (capa 1 de validación).
La **capa 2** (XSD propios de la DIAN) se activará cuando `dian/xsd/` contenga el paquete oficial.

## Schematron — reglas de negocio (capa 2, ACTIVA en modo advertencia)

El Schematron oficial `DIAN-UBL21-model.sch` se compila a un validador ejecutable:

- **Build (requiere Java + `tools/Saxon-HE-9.9.jar` + esqueletos ISO):** `node scripts/build-schematron.mjs`
- **Runtime (portable, sin Java):** [`src/lib/dian/schematron-validator.ts`](../src/lib/dian/schematron-validator.ts) ejecuta el SEF con SaxonJS y devuelve las aserciones fallidas (SVRL).
- Conectado como **capa 2** en el envío; por defecto **solo audita** (`DIAN_SCHEMATRON_ENFORCE=false`).

### Alineación del generador (verificada)

`npm run align:generator` genera una factura con nuestro `xml-generator`, la firma y la
valida contra XSD + Schematron oficiales. **Resultado: XSD ✅ y Schematron ✅** (0 reglas
relevantes; solo se ignoran 2 reglas obsoletas de la Caja — ver abajo). Correcciones aplicadas:
`X509SerialNumber` decimal, `ProviderID/@schemeID`, política de firma + `SignerRole` reincorporados.

### ⚠️ Deviaciones / inconsistencias detectadas (directriz #10 — a confirmar)
1. **`listacodigos` v2.0 NO está en la Caja** (solo v1.5/v1.6); además su expansión agota el heap.
   Por eso el validador actual cubre **reglas estructurales**, no la pertenencia a catálogos.
2. **`queryBinding` xslt3 → xslt2**: el skeleton ISO no soporta xslt3; las reglas DIAN son XPath 2.0.
3. **Regla `AA07`**: sobre un ejemplo oficial 2019 exige que `ProfileID` contenga "DIAN 2.0",
   mientras que el **Anexo 1.9 / XSD** exigen "DIAN 2.1: Factura Electrónica de Venta".
   Sugiere que las reglas estructurales de esta Caja son de una versión previa → **verificar con la DIAN**.

## WSDL / Web Services (pendiente de spec oficial)

Los métodos referenciados por la integración directa — `SendBillSync`/`SendBillAsync`,
`GetStatus`, `GetNumberingRange`, `SendEventUpdateStatus` — deben tomarse del **WSDL oficial**.
El cliente actual ([`src/lib/dian/dian-client.ts`](../src/lib/dian/dian-client.ts)) implementa
`SendBillSync` de forma manual; debe **conciliarse contra el WSDL** antes de producción.

## Política de firma (pendiente)

El valor de `xades:SigPolicyHash/ds:DigestValue` sale del documento oficial de **política de
firma**. Colócalo (PDF) en `resoluciones/` o `anexo-1.9/` y comunícame el hash para inyectarlo
en el firmador.
