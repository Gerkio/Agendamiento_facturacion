import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AgendaMatrix from '@/components/calendar/AgendaMatrix'
import DashboardKpis from '@/components/dashboard/DashboardKpis'
import { bogotaNow, bogotaDayOf } from '@/lib/dates'
import type { Service, ServiceCatalog } from '@/types/database'

// Semana actual (lunes 00:00 Colombia = 05:00 UTC), inicio de mes y día de hoy.
// En función de módulo (no en el render) para no violar react-hooks/purity.
function currentBogotaPeriods() {
  const nowBo = bogotaNow()
  const weekStart = new Date(Date.UTC(nowBo.getUTCFullYear(), nowBo.getUTCMonth(), nowBo.getUTCDate() - ((nowBo.getUTCDay() + 6) % 7), 5, 0, 0))
  const monthStart = new Date(Date.UTC(nowBo.getUTCFullYear(), nowBo.getUTCMonth(), 1, 5, 0, 0))
  return {
    weekStartISO: weekStart.toISOString(),
    weekEndISO: new Date(weekStart.getTime() + 7 * 86400_000).toISOString(),
    monthStartISO: monthStart.toISOString(),
    todayStr: nowBo.toISOString().slice(0, 10),
  }
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
  const { weekStartISO, weekEndISO, monthStartISO, todayStr } = currentBogotaPeriods()
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

  // KPIs del tablero (solo admin): ingresos del mes (facturas validadas), borradores
  // por enviar y novedades pendientes. Para el limpiador se resuelven vacíos.
  const monthIncomeQuery = isAdmin
    ? supabase.from('invoices').select('total_amount').eq('billing_status', 'sent_dian').gte('issue_date', monthStartISO)
    : Promise.resolve({ data: [] as { total_amount: number }[] })
  const draftsQuery = isAdmin
    ? supabase.from('invoices').select('id', { count: 'exact', head: true }).in('billing_status', ['draft', 'processing'])
    : Promise.resolve({ count: 0 })
  const pendNovQuery = isAdmin
    ? supabase.from('novedades').select('id', { count: 'exact', head: true }).eq('status', 'pendiente')
    : Promise.resolve({ count: 0 })

  const [{ data: cleaners }, { data: clients }, { data: catalog }, { data: services }, { data: monthIncome }, { count: draftsCount }, { count: pendNovCount }] = await Promise.all([
    cleanersQuery,
    isAdmin ? supabase.from('clients').select('*').order('company_name') : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from('service_catalog').select('*').eq('is_active', true).order('segment').order('name').returns<ServiceCatalog[]>()
      : Promise.resolve({ data: [] as ServiceCatalog[] }),
    svcQuery.returns<Service[]>(),
    monthIncomeQuery,
    draftsQuery,
    pendNovQuery,
  ])

  const serviceList = services ?? []
  const ingresosMes = (monthIncome ?? []).reduce((s, r) => s + Number(r.total_amount), 0)
  const serviciosHoy = serviceList.filter(s => bogotaDayOf(s.start_time) === todayStr).length

  return (
    <div className="space-y-6">
      {isAdmin && (
        <DashboardKpis
          serviciosHoy={serviciosHoy}
          serviciosSemana={serviceList.length}
          ingresosMes={ingresosMes}
          borradores={draftsCount ?? 0}
          novedadesPendientes={pendNovCount ?? 0}
          auxiliaresActivos={(cleaners ?? []).length}
        />
      )}
      <AgendaMatrix
        cleaners={cleaners ?? []}
        clients={clients ?? []}
        catalog={catalog ?? []}
        isAdmin={isAdmin}
        cleanerId={cleanerId}
        initialServices={serviceList}
        initialWeekStartISO={weekStartISO}
      />
    </div>
  )
}
