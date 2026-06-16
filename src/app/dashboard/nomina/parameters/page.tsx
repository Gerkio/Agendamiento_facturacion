import { requireAdmin } from '@/lib/auth'
import ParametersView from '@/components/payroll/ParametersView'
import type { PayrollParameters } from '@/types/database'

export default async function PayrollParametersPage() {
  const supabase = await requireAdmin()
  const { data } = await supabase.from('payroll_parameters').select('*').order('year', { ascending: false }).returns<PayrollParameters[]>()

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Parámetros de nómina</h1>
      <p className="text-sm text-gray-500 mb-6">SMMLV, auxilio de transporte, aportes y exoneración por año. El contador los verifica antes de liquidar.</p>
      <ParametersView initial={data ?? []} />
    </div>
  )
}
