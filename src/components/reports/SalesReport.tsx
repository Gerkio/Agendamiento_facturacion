'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP } from '@/lib/format'
import { buildCsv, downloadCsv } from '@/lib/csv'

interface InvoiceRow {
  total_amount: number
  billing_status: string
  issue_date: string
  client_id: string
  clients?: { company_name?: string } | null
}
interface ServiceRow {
  price_cop: number
  service_type: string | null
  status: string
}

// Rango por defecto: del 1.° del mes a hoy, en hora de Colombia (UTC-5).
function bogotaMonthRange() {
  const nowBo = new Date(Date.now() - 5 * 3600_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = nowBo.getUTCFullYear(), m = pad(nowBo.getUTCMonth() + 1)
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${pad(nowBo.getUTCDate())}` }
}

const PROCESO = ['draft', 'processing', 'signed']

/** Reporte de ventas (F3): cruza Facturación + Servicios + Clientes en un periodo.
 *  KPIs (facturado validado, ticket promedio, en proceso, rechazadas) + desglose
 *  por cliente y por tipo de servicio. Sin dependencia de gráficos. */
export default function SalesReport() {
  const supabase = createClient()
  const { toast } = useUI()
  const [range, setRange] = useState(() => bogotaMonthRange())
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [services, setServices] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(true)

  const toUtc = (d: string, end: boolean) => new Date(`${d}T${end ? '23:59:59.999' : '00:00:00'}-05:00`).toISOString()

  async function load(from: string, to: string) {
    if (!from || !to) return
    setLoading(true)
    const fromISO = toUtc(from, false), toISO = toUtc(to, true)
    const [{ data: inv, error: e1 }, { data: svc, error: e2 }] = await Promise.all([
      supabase.from('invoices').select('total_amount, billing_status, issue_date, client_id, clients(company_name)').gte('issue_date', fromISO).lte('issue_date', toISO),
      supabase.from('services').select('price_cop, service_type, status').neq('status', 'canceled').gte('start_time', fromISO).lte('start_time', toISO),
    ])
    if (e1 || e2) toast('Error cargando el reporte: ' + (e1?.message ?? e2?.message ?? ''), 'error')
    setInvoices((inv as InvoiceRow[]) ?? [])
    setServices((svc as ServiceRow[]) ?? [])
    setLoading(false)
  }

  // Carga inicial (mes en curso). El usuario recarga con "Generar".
  useEffect(() => { load(range.from, range.to) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const kpis = useMemo(() => {
    const validadas = invoices.filter(i => i.billing_status === 'sent_dian')
    const facturado = validadas.reduce((s, i) => s + Number(i.total_amount), 0)
    const enProceso = invoices.filter(i => PROCESO.includes(i.billing_status))
    const enProcesoTotal = enProceso.reduce((s, i) => s + Number(i.total_amount), 0)
    const rechazadas = invoices.filter(i => i.billing_status === 'rejected').length
    return {
      facturado,
      validadasCount: validadas.length,
      ticket: validadas.length ? facturado / validadas.length : 0,
      enProcesoCount: enProceso.length,
      enProcesoTotal,
      rechazadas,
      totalFacturas: invoices.length,
    }
  }, [invoices])

  // Ingresos por cliente (solo facturas validadas), de mayor a menor.
  const porCliente = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>()
    invoices.filter(i => i.billing_status === 'sent_dian').forEach(i => {
      const name = i.clients?.company_name ?? '—'
      const acc = map.get(i.client_id) ?? { name, count: 0, total: 0 }
      acc.count++; acc.total += Number(i.total_amount)
      map.set(i.client_id, acc)
    })
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [invoices])

  // Valor de los servicios por tipo (operativo; no depende de la facturación).
  const porTipo = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>()
    services.forEach(s => {
      const key = s.service_type?.trim() || 'Sin tipo'
      const acc = map.get(key) ?? { count: 0, total: 0 }
      acc.count++; acc.total += Number(s.price_cop)
      map.set(key, acc)
    })
    return [...map.entries()].map(([tipo, v]) => ({ tipo, ...v })).sort((a, b) => b.total - a.total)
  }, [services])

  function exportCsv() {
    const headers = ['Cliente', 'Facturas validadas', 'Total facturado (COP)']
    const rows = porCliente.map(c => [c.name, c.count, c.total])
    rows.push(['TOTAL', kpis.validadasCount, kpis.facturado])
    downloadCsv(`reporte-ventas-${range.from}_a_${range.to}`, buildCsv(headers, rows))
  }

  const selectCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-4">
      {/* Periodo */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
          <input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} className={selectCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
          <input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} className={selectCls} />
        </div>
        <button type="button" onClick={() => load(range.from, range.to)} disabled={loading}
          className="text-sm px-4 py-2 rounded-lg bg-gray-700 text-white font-medium hover:bg-gray-800 disabled:opacity-50">
          {loading ? 'Cargando…' : 'Generar'}
        </button>
        <button type="button" onClick={exportCsv} disabled={porCliente.length === 0}
          className="ml-auto inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50">
          <span aria-hidden="true">⬇️</span> Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi title="Facturado (validado DIAN)" value={formatCOP(kpis.facturado)} sub={`${kpis.validadasCount} factura(s)`} accent="green" />
        <Kpi title="Ticket promedio" value={formatCOP(kpis.ticket)} sub="por factura validada" accent="brand" />
        <Kpi title="En proceso / borrador" value={formatCOP(kpis.enProcesoTotal)} sub={`${kpis.enProcesoCount} sin validar`} accent="amber" />
        <Kpi title="Rechazadas" value={String(kpis.rechazadas)} sub={`de ${kpis.totalFacturas} factura(s)`} accent={kpis.rechazadas > 0 ? 'red' : 'gray'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ingresos por cliente */}
        <Panel title="Ingresos por cliente (validado)">
          <Table head={['Cliente', 'Facturas', 'Total']} empty={porCliente.length === 0} loading={loading}>
            {porCliente.map(c => (
              <tr key={c.name} className="border-t border-gray-100">
                <td className="px-4 py-2 text-gray-700">{c.name}</td>
                <td className="px-4 py-2 text-center text-gray-600">{c.count}</td>
                <td className="px-4 py-2 text-right font-medium">{formatCOP(c.total)}</td>
              </tr>
            ))}
          </Table>
        </Panel>

        {/* Servicios por tipo */}
        <Panel title="Servicios por tipo (valor)">
          <Table head={['Tipo de servicio', 'Servicios', 'Valor']} empty={porTipo.length === 0} loading={loading}>
            {porTipo.map(t => (
              <tr key={t.tipo} className="border-t border-gray-100">
                <td className="px-4 py-2 text-gray-700">{t.tipo}</td>
                <td className="px-4 py-2 text-center text-gray-600">{t.count}</td>
                <td className="px-4 py-2 text-right font-medium">{formatCOP(t.total)}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </div>
  )
}

type Accent = 'green' | 'brand' | 'amber' | 'red' | 'gray'
const ACCENT: Record<Accent, string> = {
  green: 'border-green-200 bg-green-50',
  brand: 'border-brand-200 bg-brand-50',
  amber: 'border-amber-200 bg-amber-50',
  red: 'border-red-200 bg-red-50',
  gray: 'border-gray-200 bg-white',
}

function Kpi({ title, value, sub, accent }: { title: string; value: string; sub: string; accent: Accent }) {
  return (
    <div className={`rounded-xl border shadow-sm p-4 ${ACCENT[accent]}`}>
      <p className="text-xs uppercase text-gray-500 font-semibold truncate">{title}</p>
      <p className="text-lg font-bold text-gray-800 mt-1 truncate">{value}</p>
      <p className="text-xs text-gray-600 mt-0.5 truncate">{sub}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700">{title}</h3></div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function Table({ head, empty, loading, children }: { head: string[]; empty: boolean; loading: boolean; children: React.ReactNode }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
        <th className="text-left px-4 py-2">{head[0]}</th>
        <th className="text-center px-4 py-2">{head[1]}</th>
        <th className="text-right px-4 py-2">{head[2]}</th>
      </tr></thead>
      <tbody>
        {loading && <tr><td colSpan={3} className="py-8 text-center text-gray-500">Cargando…</td></tr>}
        {!loading && empty && <tr><td colSpan={3} className="py-8 text-center text-gray-500">Sin datos en el periodo.</td></tr>}
        {!loading && children}
      </tbody>
    </table>
  )
}
