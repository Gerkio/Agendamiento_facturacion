import { requireAdmin } from '@/lib/auth'
import SettlementView from '@/components/payroll/SettlementView'
import type { Cleaner, PayrollParameters } from '@/types/database'

export default async function SettlementPage() {
  const supabase = await requireAdmin()

  const [{ data: cleaners }, { data: params }] = await Promise.all([
    supabase.from('cleaners').select('*').eq('is_active', true).order('full_name').returns<Cleaner[]>(),
    supabase.from('payroll_parameters').select('*').order('year', { ascending: false }).returns<PayrollParameters[]>(),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Liquidación definitiva de contrato</h1>
      <p className="text-sm text-gray-500 mb-6">Calcula cesantías, intereses, prima, vacaciones e indemnización (art. 64) al terminar un contrato. Cifras de referencia: valídalas con el contador antes de pagar.</p>
      <SettlementView cleaners={cleaners ?? []} params={params ?? []} />
    </div>
  )
}
