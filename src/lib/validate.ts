/** Valida que un string tenga forma de UUID (8-4-4-4-12 hex), igual que acepta
 *  el tipo `uuid` de Postgres. No se exigen los bits de versión/variante de la
 *  RFC 4122 para no rechazar UUID válidos en la base (p.ej. datos sembrados o
 *  importados). Solo previene entradas malformadas. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}
