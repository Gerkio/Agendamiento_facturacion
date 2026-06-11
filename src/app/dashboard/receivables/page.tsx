import { requireAdmin } from '@/lib/auth'
import ReceivablesView, { type Inv, type Pay } from '@/components/receivables/ReceivablesView'

export default async function ReceivablesPage() {
  const supabase = await requireAdmin()

  // Siembra desde el servidor: facturas validadas + abonos en paralelo, la vista
  // pinta de inmediato sin spinner ni round-trips del navegador.
  const [{ data: invoices }, { data: payments }] = await Promise.all([
    supabase.from('invoices').select('id, invoice_number, issue_date, total_amount, client_id, clients(company_name, forma_pago)').eq('billing_status', 'sent_dian').order('issue_date').returns<Inv[]>(),
    supabase.from('invoice_payments').select('id, invoice_id, amount, paid_at, method, note').returns<Pay[]>(),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Cartera (cuentas por cobrar)</h1>
      <p className="text-sm text-gray-500 mb-6">Facturas validadas con su saldo y mora. Registra abonos para llevar el control de pagos.</p>
      <ReceivablesView initialInvoices={invoices ?? []} initialPayments={payments ?? []} />
    </div>
  )
}
