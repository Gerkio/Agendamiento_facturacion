import 'server-only'
import { checkEmissionEnv } from '@/lib/config/env'

/**
 * Variables OBLIGATORIAS para emitir una factura ante la DIAN. La validación
 * real (presencia + FORMATO) vive en el esquema zod de `@/lib/config/env`; aquí
 * se conserva la firma histórica para los llamadores existentes.
 * El certificado se valida aparte (loadCertFromEnv + validateCertificate).
 *
 * Devuelve la lista de problemas (nombre + motivo) — vacío = todo OK.
 */
export function missingEmissionEnv(): string[] {
  const r = checkEmissionEnv()
  return r.ok ? [] : r.problems
}
