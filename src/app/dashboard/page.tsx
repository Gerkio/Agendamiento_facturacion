import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AgendaMatrix from '@/components/calendar/AgendaMatrix'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'cleaner'
  const cleanerId = profile?.cleaner_id ?? null
  const isAdmin = role === 'admin'

  // Filas de la matriz = auxiliares (admin: todos los activos; limpiador: solo él).
  const cleanersQuery = isAdmin
    ? supabase.from('cleaners').select('*').eq('is_active', true).order('full_name')
    : supabase.from('cleaners').select('*').eq('id', cleanerId ?? '')

  const [{ data: cleaners }, { data: clients }] = await Promise.all([
    cleanersQuery,
    isAdmin ? supabase.from('clients').select('*').order('company_name') : Promise.resolve({ data: [] }),
  ])

  return (
    <AgendaMatrix
      cleaners={cleaners ?? []}
      clients={clients ?? []}
      isAdmin={isAdmin}
      cleanerId={cleanerId}
    />
  )
}
