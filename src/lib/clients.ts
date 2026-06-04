/** Helpers y constantes del módulo de clientes (compartidos cliente/servidor). */

export const NATURALEZAS = [
  { value: 'natural', label: 'Persona Natural' },
  { value: 'juridica', label: 'Persona Jurídica' },
] as const

export const CUSTOMER_TYPES = ['Hogar', 'Comercio', 'Empresa', 'Conjunto', 'Otro']
export const ORIGENES = ['Referido', 'Publicidad', 'Página web', 'Redes sociales', 'Otro']

export const CITY_OPTIONS = [
  { code: '11001', name: 'Bogotá D.C.' },
  { code: '05001', name: 'Medellín' },
  { code: '76001', name: 'Cali' },
  { code: '08001', name: 'Barranquilla' },
  { code: '13001', name: 'Cartagena' },
  { code: '17001', name: 'Manizales' },
  { code: '54001', name: 'Cúcuta' },
  { code: '41001', name: 'Neiva' },
]

export const TAX_SCHEMES = [
  { value: '01', label: '01 — IVA' },
  { value: 'ZV', label: 'ZV — No responsable de IVA' },
]

export const FISCAL_REGIMENS = [
  { value: 'R-99-PN', label: 'R-99-PN — No aplica' },
  { value: 'O-13', label: 'O-13 — Gran contribuyente' },
  { value: 'O-15', label: 'O-15 — Autorretenedor' },
  { value: 'O-23', label: 'O-23 — Agente de retención de IVA' },
  { value: 'O-47', label: 'O-47 — Regimen simple de tributación' },
]

export interface NameParts {
  naturaleza?: string | null
  company_name?: string | null
  first_name?: string | null
  second_name?: string | null
  first_surname?: string | null
  second_surname?: string | null
}

/**
 * Razón social / nombre canónico que usa el DIAN. Para 'natural' se deriva de
 * los 4 nombres; para 'juridica' es company_name tal cual. Siempre debe quedar
 * no vacío para no romper la facturación.
 */
export function deriveCompanyName(c: NameParts): string {
  if (c.naturaleza === 'natural') {
    return [c.first_name, c.second_name, c.first_surname, c.second_surname]
      .map(s => (s ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return (c.company_name ?? '').trim()
}

/** Para 'natural' exige al menos primer nombre + primer apellido. */
export function nameIsValid(c: NameParts): boolean {
  if (c.naturaleza === 'natural') {
    return Boolean((c.first_name ?? '').trim() && (c.first_surname ?? '').trim())
  }
  return Boolean((c.company_name ?? '').trim())
}
