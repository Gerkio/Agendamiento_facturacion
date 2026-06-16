'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP, fmtDate } from '@/lib/format'
import { buildCsv, downloadCsv } from '@/lib/csv'
import { bogotaDayStartISO, bogotaDayEndISO, bogotaToday } from '@/lib/dates'
import { warrantyReasonLabel } from '@/lib/service-catalog'
import type { Service } from '@/types/database'

interface Props {
  initialRange: { from: string; to: string }
  initialWarranties: Service[]
  initialCompleted: number
}

const companyOf = (s: Service) => (s.clients as { company_name?: string } | undefined)?.company_name ?? '—'
const cleanerOf = (s: Service) => (s.cleaners as { full_name?: string } | undefined)?.full_name ?? '—'
const hoursOf = (s: Service) => Math.max(0, (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3_600_000)

/** Reporte de garantías (re-aseo por reclamo): tasa de garantía sobre servicios
 *  completados, horas invertidas y desglose por auxiliar y causa. Solo admin. */
export default function WarrantiesReport({ initialRange, initialWarranties, initialCompleted }: Props) {
  const supabase = createClient()
  const { toast } = useUI()
  const [range, setRange] = useState(initialRange)
  const [warranties, setWarranties] = useState<Service[]>(initialWarranties)
  const [completed, setCompleted] = useState(initialCompleted)
  const [loading, setLoading] = useState(false)

  async function load(from: string, to: string) {
    if (!from || !to) return
    setLoading(true)
    const fromISO = bogotaDayStartISO(from), toISO = bogotaDayEndISO(to)
    const [{ data: w, error: e1 }, { count, error: e2 }] = await Promise.all([
      supabase.from('services').select('id, start_time, end_time, price_cop, warranty_reason, original_service_id, clients(company_name), cleaners(full_name)').eq('service_class', 'Garantía').gte('start_time', fromISO).lte('start_time', toISO).order('start_time', { ascending: false }).returns<Service[]>(),
      supabase.from('services').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('start_time', fromISO).lte('start_time', toISO),
    ])
    if (e1 || e2) toast('Error cargando garantías: ' + (e1?.message ?? e2?.message ?? ''), 'error')
    setWarranties(w ?? [])
    setCompleted(count ?? 0)
    setLoading(false)
  }

  const horas = warranties.reduce((s, w) => s + hoursOf(w), 0)
  const tasa = completed > 0 ? (warranties.length / completed) * 100 : 0

  const porAuxiliar = useMemo(() => {
    const m = new Map<string, number>()
    warranties.forEach(w => { const k = cleanerOf(w); m.set(k, (m.get(k) ?? 0) + 1) })
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  }, [warranties])

  const porCausa = useMemo(() => {
    const m = new Map<string, number>()
    warranties.forEach(w => { const k = warrantyReasonLabel(w.warranty_reason); m.set(k, (m.get(k) ?? 0) + 1) })
    return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
  }, [warranties])

  const topAux = porAuxiliar[0]

  function exportCsv() {
    const headers = ['Fecha', 'Cliente', 'Auxiliar', 'Causa', 'Horas']
    const rows = warranties.map(w => [fmtDate(w.start_time), companyOf(w), cleanerOf(w), warrantyReasonLabel(w.warranty_reason), hoursOf(w).toFixed(1)])
    downloadCsv(`garantias-${bogotaToday()}`, buildCsv(headers, rows))
  }

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-4">
      {/* Periodo */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
          <input type="date" title="Desde" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
          <input type="date" title="Hasta" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} className={inputCls} />
        </div>
        <button type="button" onClick={() => load(range.from, range.to)} disabled={loading}
          className="text-sm px-4 py-2 rounded-lg bg-gray-700 text-white font-medium hover:bg-gray-800 disabled:opacity-50">
          {loading ? 'Cargando…' : 'Generar'}
        </button>
        <button type="button" onClick={exportCsv} disabled={warranties.length === 0}
          className="ml-auto inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50">
          <span aria-hidden="true">⬇️</span> Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi title="Garantías" value={String(warranties.length)} sub={`de ${completed} servicio(s) completados`} accent="amber" />
        <Kpi title="Tasa de garantía" value={`${tasa.toFixed(1)}%`} sub="sobre completados del periodo" accent={tasa > 5 ? 'red' : 'brand'} />
        <Kpi title="Horas invertidas" value={horas.toFixed(1)} sub="trabajo no facturable" accent="gray" />
        <Kpi title="Más garantías" value={topAux ? topAux.name : '—'} sub={topAux ? `${topAux.count} re-aseo(s)` : 'sin datos'} accent="gray" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Por auxiliar">
          {porAuxiliar.length === 0 ? <Empty /> : porAuxiliar.map(a => (
            <Row key={a.name} label={a.name} value={String(a.count)} />
          ))}
        </Panel>
        <Panel title="Por causa">
          {porCausa.length === 0 ? <Empty /> : porCausa.map(c => (
            <Row key={c.label} label={c.label} value={String(c.count)} />
          ))}
        </Panel>
      </div>

      {/* Detalle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700">Detalle de garantías</h3></div>
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
            <th className="text-left px-4 py-3">Fecha</th>
            <th className="text-left px-4 py-3">Cliente</th>
            <th className="text-left px-4 py-3">Auxiliar</th>
            <th className="text-left px-4 py-3">Causa</th>
            <th className="text-right px-4 py-3">Horas</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {warranties.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-gray-500">Sin garantías en el periodo.</td></tr>}
            {warranties.map(w => (
              <tr key={w.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(w.start_time)}</td>
                <td className="px-4 py-3 text-gray-700">{companyOf(w)}</td>
                <td className="px-4 py-3 text-gray-700">{cleanerOf(w)}</td>
                <td className="px-4 py-3 text-gray-600">{warrantyReasonLabel(w.warranty_reason)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{hoursOf(w).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  )
}

function Kpi({ title, value, sub, accent }: { title: string; value: string; sub: string; accent: 'amber' | 'brand' | 'gray' | 'red' }) {
  const cls: Record<string, string> = {
    amber: 'border-amber-200 bg-amber-50', brand: 'border-brand-200 bg-brand-50',
    gray: 'border-gray-200 bg-white', red: 'border-red-200 bg-red-50',
  }
  return (
    <div className={`rounded-xl border shadow-sm p-4 ${cls[accent]}`}>
      <p className="text-xs uppercase text-gray-500 font-semibold truncate">{title}</p>
      <p className="text-lg font-bold text-gray-800 mt-1 truncate" title={value}>{value}</p>
      <p className="text-xs text-gray-600 mt-0.5 truncate">{sub}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700">{title}</h3></div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  )
}
const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="px-4 py-2.5 flex items-center justify-between text-sm">
    <span className="text-gray-700">{label}</span>
    <span className="font-medium text-gray-800">{value}</span>
  </div>
)
const Empty = () => <p className="px-4 py-6 text-center text-gray-500 text-sm">Sin datos.</p>
