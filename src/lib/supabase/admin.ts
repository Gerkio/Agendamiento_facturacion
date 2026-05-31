import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con service_role — SOLO para usar en el servidor
 * (route handlers / server actions). Omite RLS y puede usar la Admin API
 * (crear usuarios, resetear contraseñas). NUNCA importar en componentes cliente.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
