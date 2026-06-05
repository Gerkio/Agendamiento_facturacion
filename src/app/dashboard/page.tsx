import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AgendaMatrix from '@/components/calendar/AgendaMatrix'
import type { Service, ServiceCatalog } from '@/types/database'

// Lunes 00:00 hora de Colombia (UTC-5 fijo = 05:00 UTC) y el lunes siguiente.
// En función de módulo (no en el render) para no violar react-hooks/purity.
function currentBogotaWeek() {
  const nowBo = new Date(Date.now() - 5 * 3600_000)
  const weekStart = new Date(Date.UTC(nowBo.getUTCFullYear(), nowBo.getUTCMonth(), nowBo.getUTCDate() - ((nowBo.getUTCDay() + 6) % 7), 5, 0, 0))
  return { weekStartISO: weekStart.toISOString(), weekEndISO: new Date(weekStart.getTime() + 7 * 86400_000).toISOString() }
}

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

  // Semana actual (lunes 00:00 Colombia → 05:00 UTC). Se calcula en el servidor
  // para precargar los servicios de la semana (mismo rango que pide AgendaMatrix
  // en el cliente) y pintar la agenda sin un segundo round-trip → LCP/FCP más rápidos.
  const { weekStartISO, weekEndISO } = currentBogotaWeek()
  const svcCols = isAdmin
    ? '*'
    : 'id, client_id, cleaner_id, start_time, end_time, status, is_recurring, recurrence_group_id, invoice_id, price_cop, service_type, obs_auxiliar, catalog_id, service_class, turno, recargo_dominical, forma_pago, created_at'
  let svcQuery = supabase
    .from('services')
    .select(`${svcCols}, clients(company_name, address, phone, indicaciones, forma_pago, city_code), cleaners(full_name, address)`)
    .neq('status', 'canceled')
    .gte('start_time', weekStartISO)
    .lt('start_time', weekEndISO)
  if (!isAdmin && cleanerId) svcQuery = svcQuery.eq('cleaner_id', cleanerId)

  const [{ data: cleaners }, { data: clients }, { data: catalog }, { data: services }] = await Promise.all([
    cleanersQuery,
    isAdmin ? supabase.from('clients').select('*').order('company_name') : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from('service_catalog').select('*').eq('is_active', true).order('segment').order('name').returns<ServiceCatalog[]>()
      : Promise.resolve({ data: [] as ServiceCatalog[] }),
    svcQuery.returns<Service[]>(),
  ])

  return (
    <AgendaMatrix
      cleaners={cleaners ?? []}
      clients={clients ?? []}
      catalog={catalog ?? []}
      isAdmin={isAdmin}
      cleanerId={cleanerId}
      initialServices={services ?? []}
      initialWeekStartISO={weekStartISO}
    />
  )
}
