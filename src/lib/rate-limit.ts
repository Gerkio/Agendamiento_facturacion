import 'server-only'

/**
 * Rate limiter de ventana deslizante EN MEMORIA. Best-effort:
 * en serverless (Vercel) cada instancia lambda tiene su propio Map, así que no
 * es un límite global duro — sirve para frenar ráfagas, doble-clicks y abuso
 * trivial desde una misma instancia caliente. Para un límite estricto y
 * compartido haría falta un store externo (Upstash/Redis); queda como mejora.
 */
const hits = new Map<string, number[]>()

export interface RateLimitResult {
  ok: boolean
  /** Segundos hasta que se libere un cupo (0 cuando ok=true). */
  retryAfterSec: number
}

/**
 * Registra un intento para `key` y decide si se permite.
 * @param key    identidad del sujeto (p. ej. `create-admin:<userId>`)
 * @param limit  máximo de intentos permitidos dentro de la ventana
 * @param windowMs tamaño de la ventana en milisegundos
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const cutoff = now - windowMs
  const arr = (hits.get(key) ?? []).filter(t => t > cutoff)

  if (arr.length >= limit) {
    hits.set(key, arr)
    const retryAfterSec = Math.max(1, Math.ceil((arr[0] + windowMs - now) / 1000))
    return { ok: false, retryAfterSec }
  }

  arr.push(now)
  hits.set(key, arr)

  // Limpieza best-effort para que el Map no crezca sin límite.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every(t => t <= cutoff)) hits.delete(k)
  }
  return { ok: true, retryAfterSec: 0 }
}
