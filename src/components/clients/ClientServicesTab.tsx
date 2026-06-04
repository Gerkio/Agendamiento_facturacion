import { formatCOP } from '@/lib/format'
import { serviceCls, serviceLabel } from '@/lib/status'
import type { Service } from '@/types/database'

/** Pestaña de solo-lectura "Histórico de Servicios". Es un Server Component: se
 *  renderiza en el servidor (cero JS al cliente) y se pasa como prop a ClientDetail.
 *  La fecha se ancla a la zona de Colombia para no depender del reloj del navegador. */
export default function ClientServicesTab({ services }: { services: Service[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
          <th className="text-left px-4 py-3">Fecha</th><th className="text-left px-4 py-3">Auxiliar</th>
          <th className="text-left px-4 py-3">Estado</th><th className="text-right px-4 py-3">Precio</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {services.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-gray-500">Sin servicios.</td></tr>}
          {services.map(s => (
            <tr key={s.id}>
              <td className="px-4 py-3 text-gray-600">{new Date(s.start_time).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' })}</td>
              <td className="px-4 py-3 text-gray-700">{(s.cleaners as { full_name?: string } | undefined)?.full_name ?? '—'}</td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${serviceCls(s.status)}`}>{serviceLabel(s.status)}</span></td>
              <td className="px-4 py-3 text-right font-medium">{formatCOP(Number(s.price_cop))}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  )
}
