import 'server-only'

/**
 * Variables OBLIGATORIAS para emitir una factura ante la DIAN. Si falta alguna,
 * el CUFE/XML saldría inválido o incompleto. Se valida ANTES de consumir un
 * consecutivo, para fallar rápido y con un mensaje claro (no silenciosamente).
 * El certificado se valida aparte (loadCertFromEnv + validateCertificate).
 */
const REQUIRED_EMISSION_VARS = [
  'COMPANY_NIT',
  'COMPANY_DV',
  'COMPANY_NAME',
  'COMPANY_ADDRESS',
  'COMPANY_CITY_CODE',
  'COMPANY_EMAIL',
  'COMPANY_PHONE',
  'INVOICE_PREFIX',
  'INVOICE_RESOLUTION_NUMBER',
  'INVOICE_RESOLUTION_DATE',
  'INVOICE_FROM_NUMBER',
  'INVOICE_TO_NUMBER',
  'DIAN_TECHNICAL_KEY',
  'DIAN_SOFTWARE_ID',
  'DIAN_SOFTWARE_PIN',
] as const

/** Devuelve la lista de variables de emisión faltantes (vacío = todo OK). */
export function missingEmissionEnv(): string[] {
  return REQUIRED_EMISSION_VARS.filter(k => {
    const v = process.env[k]
    return v === undefined || v.trim() === ''
  })
}
