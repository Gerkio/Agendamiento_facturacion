import { requireAdmin } from '@/lib/auth'
import NominaHub from '@/components/payroll/NominaHub'
import type { PayrollRun, PayrollParameters, Cleaner } from '@/types/database'

export default async function NominaPage() {
  const supabase = await requireAdmin()
  const [{ data: runs }, { data: params }, { data: cleaners }] = await Promise.all([
    supabase.from('payroll_runs').select('*').order('year', { ascending: false }).order('month', { ascending: false }).limit(60).returns<PayrollRun[]>(),
    supabase.from('payroll_parameters').select('*').order('year', { ascending: false }).returns<PayrollParameters[]>(),
    supabase.from('cleaners').select('*').eq('is_active', true).not('base_salary', 'is', null).order('full_name').returns<Cleaner[]>(),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Nómina</h1>
      <p className="text-sm text-gray-500 mb-6">Liquida la nómina del periodo: devengados, deducciones, aportes patronales y provisiones de prestaciones por auxiliar.</p>
      <NominaHub initialRuns={runs ?? []} params={params ?? []} cleaners={cleaners ?? []} />
    </div>
  )
}
