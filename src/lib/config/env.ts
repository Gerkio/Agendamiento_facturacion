import 'server-only'
import { z } from 'zod'

/**
 * Configuración del servidor validada con zod. Reemplaza los `process.env.X!`
 * dispersos por un único punto que:
 *   - falla rápido y con un mensaje claro que lista TODO lo que falta/está mal,
 *   - valida FORMATO (no solo presencia): un consecutivo no numérico o un
 *     `DIAN_ENVIRONMENT` inválido se detecta aquí y no revienta más adentro.
 *
 * No se importa desde los generadores XML (que se ejecutan también en los
 * validadores offline .mjs vía type-stripping de Node); esos siguen leyendo
 * process.env directamente y quedan protegidos por checkEmissionEnv() en la ruta.
 */

// ── Infra base: sin esto la app no funciona en absoluto ──────────────────────
const coreSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('debe ser una URL válida'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'falta o es demasiado corta'),
})

let cachedCore: z.infer<typeof coreSchema> | null = null

/**
 * Env de infraestructura (Supabase service_role). Lanza una vez, con todos los
 * problemas juntos, la primera vez que se accede. Cachea el resultado.
 */
export function getServerEnv(): z.infer<typeof coreSchema> {
  if (cachedCore) return cachedCore
  const parsed = coreSchema.safeParse(process.env)
  if (!parsed.success) {
    const problems = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
    throw new Error('Configuración de servidor inválida:\n- ' + problems.join('\n- '))
  }
  cachedCore = parsed.data
  return cachedCore
}

// ── Emisión DIAN: obligatoria solo al emitir; se valida en la ruta ───────────
const numericStr = (label: string) =>
  z.string().regex(/^\d+$/, `${label} debe ser numérico`)

const emissionSchema = z.object({
  COMPANY_NIT: numericStr('COMPANY_NIT'),
  COMPANY_DV: z.string().regex(/^\d$/, 'COMPANY_DV debe ser un dígito'),
  COMPANY_NAME: z.string().min(1),
  COMPANY_ADDRESS: z.string().min(1),
  COMPANY_CITY_CODE: numericStr('COMPANY_CITY_CODE'),
  COMPANY_EMAIL: z.string().email('COMPANY_EMAIL inválido'),
  COMPANY_PHONE: z.string().min(1),
  INVOICE_PREFIX: z.string().min(1),
  INVOICE_RESOLUTION_NUMBER: z.string().min(1),
  INVOICE_RESOLUTION_DATE: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'INVOICE_RESOLUTION_DATE debe ser YYYY-MM-DD'),
  INVOICE_FROM_NUMBER: numericStr('INVOICE_FROM_NUMBER'),
  INVOICE_TO_NUMBER: numericStr('INVOICE_TO_NUMBER'),
  DIAN_TECHNICAL_KEY: z.string().min(1),
  DIAN_SOFTWARE_ID: z.string().min(1),
  DIAN_SOFTWARE_PIN: z.string().min(1),
})

export type EmissionEnv = z.infer<typeof emissionSchema>

/**
 * Valida las variables de emisión. Devuelve la lista de problemas (nombre +
 * motivo) en vez de solo los ausentes: así el mensaje 422 de la ruta también
 * distingue un valor mal formado de uno faltante.
 */
export function checkEmissionEnv(): { ok: true; env: EmissionEnv } | { ok: false; problems: string[] } {
  const parsed = emissionSchema.safeParse(process.env)
  if (parsed.success) return { ok: true, env: parsed.data }
  const problems = parsed.error.issues.map(i => {
    const key = i.path.join('.')
    return i.code === 'invalid_type' ? `${key} (falta)` : `${key} (${i.message})`
  })
  return { ok: false, problems }
}
