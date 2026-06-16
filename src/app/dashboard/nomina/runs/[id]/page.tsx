import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import RunDetail from '@/components/payroll/RunDetail'
import { getEmisorConfig } from '@/lib/dian/emisor-config'
import { isUuid } from '@/lib/validate'
import type { PayrollRun, PayrollItem } from '@/types/database'

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const supabase = await requireAdmin()

  const [{ data: run }, { data: items }] = await Promise.all([
    supabase.from('payroll_runs').select('*').eq('id', id).single(),
    supabase.from('payroll_items').select('*, cleaners(full_name, document_id)').eq('run_id', id).order('created_at').returns<PayrollItem[]>(),
  ])
  if (!run) notFound()

  return <RunDetail run={run as PayrollRun} items={items ?? []} emisorName={getEmisorConfig().name} />
}
