import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AgendaMatrix from '@/components/calendar/AgendaMatrix'
import type { ServiceCatalog } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, cleaner_id')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'cleaner'
  const cleanerId = profile?.cleaner_id ?? null
  const isAdmin = role === 'admin'

  // Filas de la matriz = auxiliares (admin: todos los activos; limpiador: solo él).
  const cleanersQuery = isAdmin
    ? supabase.from('cleaners').select('*').eq('is_active', true).order('full_name')
    : supabase.from('cleaners').select('*').eq('id', cleanerId ?? '')

  const [{ data: cleaners }, { data: clients }, { data: catalog }] = await Promise.all([
    cleanersQuery,
    isAdmin ? supabase.from('clients').select('*').order('company_name') : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from('service_catalog').select('*').eq('is_active', true).order('segment').order('name').returns<ServiceCatalog[]>()
      : Promise.resolve({ data: [] as ServiceCatalog[] }),
  ])

  return (
    <AgendaMatrix
      cleaners={cleaners ?? []}
      clients={clients ?? []}
      catalog={catalog ?? []}
      isAdmin={isAdmin}
      cleanerId={cleanerId}
    />
  )
}
