import type { NextRequest } from 'next/server'

/**
 * Defensa CSRF en profundidad: una petición que muta datos debe provenir del
 * mismo origen. Los navegadores envían la cabecera `Origin` en POST/DELETE; si
 * está presente y su host no coincide con el de la petición, se rechaza.
 * Complementa las cookies SameSite de Supabase (que ya bloquean la mayoría de
 * CSRF). Las peticiones sin `Origin` (clientes no-navegador) se permiten.
 */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  const reqHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  try {
    return Boolean(reqHost) && new URL(origin).host === reqHost
  } catch {
    return false
  }
}
