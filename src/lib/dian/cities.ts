/** Nombre de municipio a partir del código DIAN (DANE). Lista parcial; si no
 *  está, se devuelve el propio código para no inventar un nombre. */
const CITIES: Record<string, string> = {
  '11001': 'Bogotá D.C.',
  '05001': 'Medellín',
  '76001': 'Cali',
  '08001': 'Barranquilla',
  '13001': 'Cartagena',
  '17001': 'Manizales',
  '54001': 'Cúcuta',
  '41001': 'Neiva',
}

export function cityName(code: string | null | undefined): string {
  if (!code) return ''
  return CITIES[code] ?? code
}
