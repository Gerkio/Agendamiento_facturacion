import Link from 'next/link'
import { formatCOP } from '@/lib/format'

interface Props {
  /** Servicios completados aún sin factura: valor por facturar y conteo. */
  porFacturarValor: number
  porFacturarCount: number
  /** Facturas validadas por la DIAN: total facturado y conteo. */
  facturadoValidado: number
  validadasCount: number
  /** Facturas sin validar (borrador/procesando/firmadas) y rechazadas. */
  enProcesoCount: number
  rechazadasCount: number
  totalFacturas: number
}

type Accent = 'amber' | 'green' | 'gray' | 'red'
const ACCENT: Record<Accent, string> = {
  amber: 'border-amber-200 bg-amber-50',
  green: 'border-green-200 bg-green-50',
  gray: 'border-gray-200 bg-white',
  red: 'border-red-200 bg-red-50',
}

/** Estado de cuenta 360° del cliente (P5): cruza servicios sin facturar con las
 *  facturas emitidas para mostrar el dinero por facturar, lo ya facturado/validado
 *  y el estado de la cartera. Server Component (cero JS al cliente). */
export default function ClientAccountTab({
  porFacturarValor, porFacturarCount, facturadoValidado, validadasCount, enProcesoCount, rechazadasCount, totalFacturas,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card accent="amber" title="Por facturar" value={formatCOP(porFacturarValor)} sub={`${porFacturarCount} servicio(s) completados sin factura`} />
        <Card accent="green" title="Facturado (validado DIAN)" value={formatCOP(facturadoValidado)} sub={`${validadasCount} factura(s) validada(s)`} />
        <Card accent="gray" title="En proceso / borrador" value={String(enProcesoCount)} sub="facturas sin validar" />
        <Card accent={rechazadasCount > 0 ? 'red' : 'gray'} title="Rechazadas" value={String(rechazadasCount)} sub={rechazadasCount > 0 ? 'requieren atención' : 'sin rechazos'} />
      </div>

      {porFacturarCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex flex-wrap items-center justify-between gap-3">
          <span>Hay <strong>{formatCOP(porFacturarValor)}</strong> en {porFacturarCount} servicio(s) completados pendientes de facturar.</span>
          <Link href="/dashboard/history" className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700">
            Facturar pendientes →
          </Link>
        </div>
      )}

      <p className="text-xs text-gray-500">Total histórico de facturas del cliente: {totalFacturas}.</p>
    </div>
  )
}

function Card({ accent, title, value, sub }: { accent: Accent; title: string; value: string; sub: string }) {
  return (
    <div className={`rounded-xl border shadow-sm p-4 ${ACCENT[accent]}`}>
      <p className="text-xs uppercase text-gray-500 font-semibold">{title}</p>
      <p className="text-xl font-bold text-gray-800 mt-1">{value}</p>
      <p className="text-xs text-gray-600 mt-1">{sub}</p>
    </div>
  )
}
