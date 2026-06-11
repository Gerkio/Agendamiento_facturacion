import { requireAdmin } from '@/lib/auth'
import PayrollReport, { type SvcRow } from '@/components/payroll/PayrollReport'
import { bogotaMonthRange, bogotaDayStartISO, bogotaDayEndISO } from '@/lib/dates'

export default async function PayrollPage() {
  const supabase = await requireAdmin()

  // Siembra del mes en curso desde el servidor (sin spinner inicial).
  const range = bogotaMonthRange()
  const { data: services } = await supabase
    .from('services')
    .select('cleaner_id, turno, recargo_dominical, cleaners(full_name)')
    .eq('status', 'completed')
    .gte('start_time', bogotaDayStartISO(range.from))
    .lte('start_time', bogotaDayEndISO(range.to))
    .returns<SvcRow[]>()

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Liquidación de auxiliares</h1>
      <p className="text-sm text-gray-500 mb-6">Cuenta los servicios completados por turno y los valora con las tarifas que definas.</p>
      <PayrollReport initialRange={range} initialServices={services ?? []} />
    </div>
  )
}
