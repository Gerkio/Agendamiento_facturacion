import Link from 'next/link'
import { formatCOP } from '@/lib/format'

interface Props {
  serviciosHoy: number
  serviciosSemana: number
  ingresosMes: number
  borradores: number
  novedadesPendientes: number
  auxiliaresActivos: number
}

/** Tablero de mando (P7): correlaciona Agenda + Facturación + Novedades + Auxiliares
 *  en una tira de tarjetas-puente. Cada tarjeta enlaza a su herramienta. Server
 *  Component (cero JS al cliente); solo se muestra al admin. */
export default function DashboardKpis({
  serviciosHoy, serviciosSemana, ingresosMes, borradores, novedadesPendientes, auxiliaresActivos,
}: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Kpi href="/dashboard" title="Servicios hoy" value={String(serviciosHoy)} sub={`${serviciosSemana} esta semana`} accent="brand" />
      <Kpi href="/dashboard/invoices" title="Ingresos del mes" value={formatCOP(ingresosMes)} sub="facturas validadas DIAN" accent="green" />
      <Kpi href="/dashboard/invoices" title="Borradores" value={String(borradores)} sub="facturas sin enviar" accent={borradores > 0 ? 'amber' : 'gray'} />
      <Kpi href="/dashboard/novedades" title="Novedades" value={String(novedadesPendientes)} sub="pendientes" accent={novedadesPendientes > 0 ? 'red' : 'gray'} />
      <Kpi href="/dashboard/cleaners" title="Auxiliares" value={String(auxiliaresActivos)} sub="activos" accent="gray" />
    </div>
  )
}

type Accent = 'brand' | 'green' | 'amber' | 'red' | 'gray'
const ACCENT: Record<Accent, string> = {
  brand: 'border-brand-200 bg-brand-50',
  green: 'border-green-200 bg-green-50',
  amber: 'border-amber-200 bg-amber-50',
  red: 'border-red-200 bg-red-50',
  gray: 'border-gray-200 bg-white',
}

function Kpi({ href, title, value, sub, accent }: { href: string; title: string; value: string; sub: string; accent: Accent }) {
  return (
    <Link href={href} className={`rounded-xl border shadow-sm p-4 transition hover:shadow-md ${ACCENT[accent]}`}>
      <p className="text-xs uppercase text-gray-500 font-semibold truncate">{title}</p>
      <p className="text-lg font-bold text-gray-800 mt-1 truncate">{value}</p>
      <p className="text-xs text-gray-600 mt-0.5 truncate">{sub}</p>
    </Link>
  )
}
