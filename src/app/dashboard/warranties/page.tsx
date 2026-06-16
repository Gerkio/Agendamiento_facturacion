import { requireAdmin } from '@/lib/auth'
import WarrantiesReport from '@/components/reports/WarrantiesReport'
import { bogotaMonthRange, bogotaDayStartISO, bogotaDayEndISO } from '@/lib/dates'
import type { Service } from '@/types/database'

export default async function WarrantiesPage() {
  const supabase = await requireAdmin()

  // Siembra del mes en curso: garantías + total de servicios completados (denominador
  // de la tasa), en paralelo, para pintar sin spinner.
  const range = bogotaMonthRange()
  const fromISO = bogotaDayStartISO(range.from)
  const toISO = bogotaDayEndISO(range.to)
  const [{ data: warranties }, { count: completed }] = await Promise.all([
    supabase.from('services').select('id, start_time, end_time, price_cop, warranty_reason, original_service_id, clients(company_name), cleaners(full_name)').eq('service_class', 'Garantía').gte('start_time', fromISO).lte('start_time', toISO).order('start_time', { ascending: false }).returns<Service[]>(),
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('start_time', fromISO).lte('start_time', toISO),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Garantías</h1>
      <p className="text-sm text-gray-500 mb-6">Re-aseos por reclamo (servicios repetidos sin cobro). Mide la tasa de garantía, su causa y las horas invertidas.</p>
      <WarrantiesReport initialRange={range} initialWarranties={warranties ?? []} initialCompleted={completed ?? 0} />
    </div>
  )
}
