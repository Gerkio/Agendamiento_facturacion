import { formatCOP, fmtDate } from '@/lib/format'
import { billingCls, billingLabel } from '@/lib/status'
import type { Invoice } from '@/types/database'

/** Pestaña de solo-lectura "Últimos Pagos". Server Component (cero JS al cliente),
 *  se pasa como prop a ClientDetail. */
export default function ClientPaymentsTab({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
          <th className="text-left px-4 py-3">N° Factura</th><th className="text-left px-4 py-3">Fecha</th>
          <th className="text-right px-4 py-3">Total</th><th className="text-left px-4 py-3">Estado</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {invoices.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-gray-500">Sin facturas.</td></tr>}
          {invoices.map(inv => (
            <tr key={inv.id}>
              <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number ?? 'BORRADOR'}</td>
              <td className="px-4 py-3 text-gray-600">{fmtDate(inv.issue_date)}</td>
              <td className="px-4 py-3 text-right font-medium">{formatCOP(Number(inv.total_amount))}</td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${billingCls(inv.billing_status)}`}>{billingLabel(inv.billing_status)}</span></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  )
}
