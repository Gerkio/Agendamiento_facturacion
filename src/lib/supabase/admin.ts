import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getServerEnv } from '@/lib/config/env'

/**
 * Cliente Supabase con service_role — SOLO para usar en el servidor
 * (route handlers / server actions). Omite RLS y puede usar la Admin API
 * (crear usuarios, resetear contraseñas). NUNCA importar en componentes cliente.
 */
export function createAdminClient() {
  const env = getServerEnv()
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
