/**
 * Datos del emisor y de la resolución DIAN de habilitación, tomados de las
 * variables de entorno (NO secretos: NIT, razón social, resolución, etc.).
 * Se usan para construir la representación gráfica legal de la factura.
 *
 * Importante: si los valores siguen siendo los del ejemplo (.env.local.example),
 * `configured` será false y la representación gráfica avisará que son datos de
 * demostración. Nunca se inventan valores aquí: solo se reflejan los de entorno.
 */
export interface EmisorConfig {
  nit: string
  dv: string
  name: string
  address: string
  cityCode: string
  taxScheme: string
  fiscalRegimen: string
  email: string
  phone: string
  invoicePrefix: string
  resolutionNumber: string
  resolutionDate: string
  fromNumber: string
  toNumber: string
  environment: '1' | '2'
  /** Tasa de IVA configurada (en %). 0 = exento (por defecto). */
  ivaRate: number
  /** false cuando los datos son los de ejemplo o faltan → no usar en producción. */
  configured: boolean
}

const EXAMPLE_NIT = '900123456'

export function getEmisorConfig(): EmisorConfig {
  const nit = process.env.COMPANY_NIT ?? ''
  const name = process.env.COMPANY_NAME ?? ''
  const configured = Boolean(nit) && nit !== EXAMPLE_NIT && Boolean(name) && name !== 'Empresa de Aseo S.A.S.'

  return {
    nit,
    dv: process.env.COMPANY_DV ?? '',
    name: name || 'Razón social no configurada',
    address: process.env.COMPANY_ADDRESS ?? '',
    cityCode: process.env.COMPANY_CITY_CODE ?? '',
    taxScheme: process.env.COMPANY_TAX_SCHEME ?? '',
    fiscalRegimen: process.env.COMPANY_FISCAL_REGIMEN ?? '',
    email: process.env.COMPANY_EMAIL ?? '',
    phone: process.env.COMPANY_PHONE ?? '',
    invoicePrefix: process.env.INVOICE_PREFIX ?? '',
    resolutionNumber: process.env.INVOICE_RESOLUTION_NUMBER ?? '',
    resolutionDate: process.env.INVOICE_RESOLUTION_DATE ?? '',
    fromNumber: process.env.INVOICE_FROM_NUMBER ?? '',
    toNumber: process.env.INVOICE_TO_NUMBER ?? '',
    environment: (process.env.DIAN_ENVIRONMENT ?? '2') as '1' | '2',
    ivaRate: (() => { const r = Number(process.env.COMPANY_IVA_RATE ?? '0'); return Number.isFinite(r) && r > 0 ? r : 0 })(),
    configured,
  }
}
