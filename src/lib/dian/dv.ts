/**
 * Cálculo del Dígito de Verificación (DV) del NIT/cédula según el algoritmo
 * oficial mod-11 de la DIAN. Determinístico: para cada número hay un único DV.
 * Verificado: NIT 900123456 → DV 8.
 */
const WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]

export function calcularDV(nit: string): string {
  const digits = (nit ?? '').replace(/\D/g, '')
  if (!digits) return ''
  const rev = digits.split('').reverse()
  let sum = 0
  for (let i = 0; i < rev.length && i < WEIGHTS.length; i++) {
    sum += parseInt(rev[i], 10) * WEIGHTS[i]
  }
  const mod = sum % 11
  return String(mod > 1 ? 11 - mod : mod)
}
