import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** Autenticación compartida por request. `cache()` memoiza dentro del mismo
 *  render del servidor, así el layout y la página comparten UNA sola validación
 *  de sesión (getUser → servidor de auth) y UNA lectura de user_profiles, en vez
 *  de repetirlas en cada nivel. Menos round-trips por navegación, misma seguridad:
 *  el token se valida igual, solo que una vez. */
export const getAuth = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, role: null as string | null, cleanerId: null as string | null }
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, cleaner_id')
    .eq('id', user.id)
    .single()
  return {
    supabase,
    user,
    role: (profile?.role ?? 'cleaner') as string,
    cleanerId: (profile?.cleaner_id ?? null) as string | null,
  }
})

/** Guard de páginas solo-admin: redirige si no hay sesión o el rol no es admin.
 *  Devuelve el cliente Supabase listo para las consultas de la página. */
export async function requireAdmin() {
  const { supabase, user, role } = await getAuth()
  if (!user) redirect('/auth/login')
  if (role !== 'admin') redirect('/dashboard')
  return supabase
}
