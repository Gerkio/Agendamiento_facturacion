import { requireAdmin } from '@/lib/auth'
import ContractsView from '@/components/payroll/ContractsView'
import type { Cleaner } from '@/types/database'

export default async function ContractsPage() {
  const supabase = await requireAdmin()
  const { data } = await supabase.from('cleaners').select('*').eq('is_active', true).order('full_name').returns<Cleaner[]>()

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Contratos</h1>
      <p className="text-sm text-gray-500 mb-6">Datos laborales de cada auxiliar (salario, tipo, riesgo ARL, banco). Necesarios para liquidar la nómina.</p>
      <ContractsView initial={data ?? []} />
    </div>
  )
}
