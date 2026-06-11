import { requireAdmin } from '@/lib/auth'
import SalesReport, { type InvoiceRow, type ServiceRow } from '@/components/reports/SalesReport'
import { bogotaMonthRange, bogotaDayStartISO, bogotaDayEndISO } from '@/lib/dates'

export default async function ReportsPage() {
  const supabase = await requireAdmin()

  // Siembra del mes en curso desde el servidor: la vista pinta de inmediato sin
  // spinner ni round-trip del navegador. "Generar" recalcula otros periodos.
  const range = bogotaMonthRange()
  const fromISO = bogotaDayStartISO(range.from)
  const toISO = bogotaDayEndISO(range.to)
  const [{ data: invoices }, { data: services }] = await Promise.all([
    supabase.from('invoices').select('total_amount, billing_status, issue_date, client_id, clients(company_name)').gte('issue_date', fromISO).lte('issue_date', toISO).returns<InvoiceRow[]>(),
    supabase.from('services').select('price_cop, service_type, status').neq('status', 'canceled').gte('start_time', fromISO).lte('start_time', toISO).returns<ServiceRow[]>(),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-6">Reporte de ventas</h1>
      <SalesReport initialRange={range} initialInvoices={invoices ?? []} initialServices={services ?? []} />
    </div>
  )
}
