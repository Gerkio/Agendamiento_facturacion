import { createClient } from '@/lib/supabase/server'

export interface AdminContext {
  userId: string
}

/**
 * Verifica que el solicitante esté autenticado y sea admin.
 * Devuelve { ok: true, userId } o { ok: false, status, error }.
 */
export async function requireAdmin(): Promise<
  { ok: true; ctx: AdminContext } | { ok: false; status: number; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { ok: false, status: 403, error: 'Requiere rol administrador' }
  return { ok: true, ctx: { userId: user.id } }
}
