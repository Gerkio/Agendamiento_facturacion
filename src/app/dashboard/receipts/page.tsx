import { requireAdmin } from '@/lib/auth'
import ReceiptsView from '@/components/receipts/ReceiptsView'
import { getEmisorConfig } from '@/lib/dian/emisor-config'
import type { PaymentReceipt } from '@/types/database'

export default async function ReceiptsPage() {
  const supabase = await requireAdmin()

  const [{ data: receipts }, { data: clients }] = await Promise.all([
    supabase.from('payment_receipts').select('*, clients(company_name)').order('issue_date', { ascending: false }).limit(200).returns<PaymentReceipt[]>(),
    supabase.from('clients').select('id, company_name').order('company_name'),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Recibos de caja</h1>
      <p className="text-sm text-gray-500 mb-6">Comprobantes de pago del cliente (formalizan los abonos de cartera). Emite, imprime y anula. Documento interno, no DIAN.</p>
      <ReceiptsView initialReceipts={receipts ?? []} clients={clients ?? []} emisorName={getEmisorConfig().name} />
    </div>
  )
}
