import { requireAdmin } from '@/lib/auth'
import PayrollReport, { type SvcRow } from '@/components/payroll/PayrollReport'
import { bogotaMonthRange, bogotaDayStartISO, bogotaDayEndISO } from '@/lib/dates'

export default async function PayrollPage() {
  const supabase = await requireAdmin()

  // Siembra del mes en curso desde el servidor (sin spinner inicial): servicios
  // completados + el juego de tarifas VIGENTE al inicio del periodo (effective_from
  // más reciente <= range.from). Tarifas compartidas (tabla, no localStorage).
  const range = bogotaMonthRange()
  const [{ data: services }, { data: rate }] = await Promise.all([
    supabase
      .from('services')
      .select('cleaner_id, turno, recargo_dominical, cleaners(full_name)')
      .eq('status', 'completed')
      .gte('start_time', bogotaDayStartISO(range.from))
      .lte('start_time', bogotaDayEndISO(range.to))
      .returns<SvcRow[]>(),
    supabase
      .from('payroll_shift_rates')
      .select('effective_from, manana, tarde, dia_completo, recargo_dominical')
      .lte('effective_from', range.from)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Liquidación de auxiliares</h1>
      <p className="text-sm text-gray-500 mb-6">Cuenta los servicios completados por turno y los valora con las tarifas vigentes que definas.</p>
      <PayrollReport initialRange={range} initialServices={services ?? []} initialRate={rate ?? null} />
    </div>
  )
}
