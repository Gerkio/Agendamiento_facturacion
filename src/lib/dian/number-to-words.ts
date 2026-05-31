/**
 * Convierte un monto en pesos colombianos a su expresión en letras
 * (mayúsculas), p. ej. 1234567 → "UN MILLÓN DOSCIENTOS TREINTA Y CUATRO MIL
 * QUINIENTOS SESENTA Y SIETE PESOS M/CTE". Se usa en la representación gráfica.
 * Trabaja sobre la parte entera (los pesos no manejan centavos en la práctica).
 */
const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']
const ESPECIALES: Record<number, string> = {
  10: 'DIEZ', 11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
  16: 'DIECISÉIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
  20: 'VEINTE', 21: 'VEINTIUNO', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS', 24: 'VEINTICUATRO',
  25: 'VEINTICINCO', 26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE',
}
const DECENAS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

function menorAMil(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'
  let out = ''
  const c = Math.floor(n / 100)
  const resto = n % 100
  if (c > 0) out += CENTENAS[c] + ' '
  if (resto > 0) {
    if (resto < 10) out += UNIDADES[resto]
    else if (ESPECIALES[resto]) out += ESPECIALES[resto]
    else {
      const d = Math.floor(resto / 10)
      const u = resto % 10
      out += DECENAS[d] + (u > 0 ? ' Y ' + UNIDADES[u] : '')
    }
  }
  return out.trim()
}

function seccion(n: number, singular: string, plural: string): string {
  if (n === 0) return ''
  if (n === 1) return singular
  return `${menorAMil(n)} ${plural}`
}

export function numeroALetras(monto: number): string {
  const n = Math.floor(Math.abs(monto))
  if (n === 0) return 'CERO PESOS M/CTE'

  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000

  const partes: string[] = []
  if (millones > 0) partes.push(seccion(millones, 'UN MILLÓN', 'MILLONES'))
  if (miles > 0) partes.push(seccion(miles, 'MIL', 'MIL'))
  if (resto > 0) partes.push(menorAMil(resto))

  const texto = partes.join(' ').replace(/\s+/g, ' ').trim()
  return `${texto} PESOS M/CTE`
}
