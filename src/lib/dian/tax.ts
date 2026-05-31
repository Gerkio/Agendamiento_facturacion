/**
 * Cálculo de IVA consistente para la factura. Se computa por línea (cada
 * servicio) y se suma, de modo que el total de impuestos del documento sea
 * EXACTAMENTE la suma de los impuestos de las líneas (requisito del Schematron
 * DIAN). La tasa se toma de la configuración (COMPANY_IVA_RATE); por defecto 0.
 *
 * ⚠️ NOTA TRIBUTARIA: este cálculo aplica el IVA sobre el valor total de cada
 * servicio. Si el régimen aplicable es el de servicios de aseo/vigilancia con
 * base especial AIU (Administración, Imprevistos, Utilidad), el IVA se calcula
 * solo sobre esa porción y se requiere lógica adicional. CONFIRMAR con el
 * contador antes de fijar una tasa distinta de 0.
 */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export interface TaxLine {
  base: number
  tax: number
}

export interface TaxBreakdown {
  taxableBase: number
  taxAmount: number
  total: number
  rate: number
  lines: TaxLine[]
}

/** Calcula la base, el IVA por línea y los totales para una tasa dada (en %). */
export function computeTax(prices: number[], ratePct: number): TaxBreakdown {
  const rate = Number.isFinite(ratePct) && ratePct > 0 ? ratePct : 0
  const lines: TaxLine[] = prices.map(p => {
    const base = round2(Number(p) || 0)
    return { base, tax: round2((base * rate) / 100) }
  })
  const taxableBase = round2(lines.reduce((s, l) => s + l.base, 0))
  const taxAmount = round2(lines.reduce((s, l) => s + l.tax, 0))
  return { taxableBase, taxAmount, total: round2(taxableBase + taxAmount), rate, lines }
}

/** Tasa de IVA configurada (en %). Por defecto 0 (exento, comportamiento actual). */
export function configuredIvaRate(): number {
  const r = Number(process.env.COMPANY_IVA_RATE ?? '0')
  return Number.isFinite(r) && r > 0 ? r : 0
}
