import { requireAdmin } from '@/lib/auth'
import InvoicesView from '@/components/invoices/InvoicesView'
import { getEmisorConfig } from '@/lib/dian/emisor-config'
import type { Invoice, CreditNote } from '@/types/database'

export default async function InvoicesPage() {
  const supabase = await requireAdmin()

  // Se omiten columnas pesadas no usadas en la pantalla: `xml_content` (XML UBL
  // firmado, decenas de KB por factura/nota). El documento gráfico recarga sus
  // ítems aparte y usa qr_content/cufe/respuesta DIAN que sí se incluyen.
  const [{ data: clients }, { data: invoices }, { data: creditNotes }] = await Promise.all([
    supabase.from('clients').select('*').order('company_name'),
    supabase
      .from('invoices')
      .select('id, client_id, invoice_number, issue_date, subtotal, tax_amount, total_amount, billing_status, created_at, qr_content, cufe, dian_response_description, clients(company_name, nit_cedula, dv)')
      .order('created_at', { ascending: false })
      .returns<Invoice[]>(),
    supabase
      .from('credit_notes')
      .select('id, invoice_id, note_number, billing_status, created_at')
      .order('created_at', { ascending: false })
      .returns<CreditNote[]>(),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">Facturación Electrónica DIAN</h1>
      <InvoicesView clients={clients ?? []} invoices={invoices ?? []} creditNotes={creditNotes ?? []} emisor={getEmisorConfig()} />
    </div>
  )
}
