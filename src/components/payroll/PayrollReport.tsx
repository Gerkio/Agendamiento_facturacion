'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP } from '@/lib/format'
import { buildCsv, downloadCsv } from '@/lib/csv'
import { bogotaDayStartISO, bogotaDayEndISO } from '@/lib/dates'

export interface SvcRow {
  cleaner_id: string
  turno: string | null
  recargo_dominical: boolean | null
  cleaners?: { full_name?: string } | null
}
interface Rates { manana: number; tarde: number; dia_completo: number; recargo: number }

interface Props {
  /** Semilla del servidor (mes en curso): pinta sin spinner ni round-trip. */
  initialRange: { from: string; to: string }
  initialServices: SvcRow[]
}

const RATES_KEY = 'amaru.payroll.rates'
const ZERO: Rates = { manana: 0, tarde: 0, dia_completo: 0, recargo: 0 }

/** P2 · Liquidación por turno: el admin fija las tarifas (mañana/tarde/día completo
 *  + recargo dominical), persistidas en el navegador, y el sistema cuenta los
 *  servicios completados por auxiliar y turno en el periodo para calcular el pago.
 *  Conecta Auxiliares + Servicios. Sin tarifas inventadas ni cambios de esquema. */
export default function PayrollReport({ initialRange, initialServices }: Props) {
  const supabase = createClient()
  const { toast } = useUI()
  const [range, setRange] = useState(initialRange)
  const [rows, setRows] = useState<SvcRow[]>(initialServices)
  const [loading, setLoading] = useState(false)
  const [rates, setRates] = useState<Rates>(ZERO)

  // Cargar tarifas guardadas (solo cliente).
  useEffect(() => {
    try { const s = localStorage.getItem(RATES_KEY); if (s) setRates({ ...ZERO, ...JSON.parse(s) }) } catch { /* noop */ }
  }, [])

  function setRate(k: keyof Rates, v: string) {
    setRates(r => {
      const next = { ...r, [k]: Number(v) || 0 }
      try { localStorage.setItem(RATES_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }

  async function load(from: string, to: string) {
    if (!from || !to) return
    setLoading(true)
    const { data, error } = await supabase
      .from('services')
      .select('cleaner_id, turno, recargo_dominical, cleaners(full_name)')
      .eq('status', 'completed')
      .gte('start_time', bogotaDayStartISO(from))
      .lte('start_time', bogotaDayEndISO(to))
    if (error) toast('Error cargando servicios: ' + error.message, 'error')
    setRows((data as SvcRow[]) ?? [])
    setLoading(false)
  }

  const porAuxiliar = useMemo(() => {
    const map = new Map<string, { name: string; manana: number; tarde: number; dia: number; sinTurno: number; dominical: number }>()
    rows.forEach(r => {
      const acc = map.get(r.cleaner_id) ?? { name: r.cleaners?.full_name ?? '—', manana: 0, tarde: 0, dia: 0, sinTurno: 0, dominical: 0 }
      if (r.turno === 'manana') acc.manana++
      else if (r.turno === 'tarde') acc.tarde++
      else if (r.turno === 'dia_completo') acc.dia++
      else acc.sinTurno++
      if (r.recargo_dominical) acc.dominical++
      map.set(r.cleaner_id, acc)
    })
    return [...map.values()]
      .map(a => ({ ...a, pago: a.manana * rates.manana + a.tarde * rates.tarde + a.dia * rates.dia_completo + a.dominical * rates.recargo }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows, rates])

  const totalPago = porAuxiliar.reduce((s, a) => s + a.pago, 0)
  const haySinTurno = porAuxiliar.some(a => a.sinTurno > 0)

  function exportCsv() {
    const headers = ['Auxiliar', 'Mañana', 'Tarde', 'Día completo', 'Sin turno', 'Dominical', 'Total a pagar (COP)']
    const data = porAuxiliar.map(a => [a.name, a.manana, a.tarde, a.dia, a.sinTurno, a.dominical, a.pago])
    data.push(['TOTAL', '', '', '', '', '', totalPago])
    downloadCsv(`liquidacion-${range.from}_a_${range.to}`, buildCsv(headers, data))
  }

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-4">
      {/* Tarifas por turno (configurables) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Tarifas por turno (se guardan en este navegador)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <RateInput label="Mañana" value={rates.manana} onChange={v => setRate('manana', v)} cls={inputCls} />
          <RateInput label="Tarde" value={rates.tarde} onChange={v => setRate('tarde', v)} cls={inputCls} />
          <RateInput label="Día completo" value={rates.dia_completo} onChange={v => setRate('dia_completo', v)} cls={inputCls} />
          <RateInput label="Recargo dominical" value={rates.recargo} onChange={v => setRate('recargo', v)} cls={inputCls} />
        </div>
      </div>

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
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-600">Total a pagar: <strong className="text-brand-700">{formatCOP(totalPago)}</strong></span>
          <button type="button" onClick={exportCsv} disabled={porAuxiliar.length === 0}
            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50">
            <span aria-hidden="true">⬇️</span> Exportar CSV
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
            <th className="text-left px-4 py-3">Auxiliar</th>
            <th className="text-center px-4 py-3">Mañana</th>
            <th className="text-center px-4 py-3">Tarde</th>
            <th className="text-center px-4 py-3">Día completo</th>
            <th className="text-center px-4 py-3">Sin turno</th>
            <th className="text-center px-4 py-3">Dominical</th>
            <th className="text-right px-4 py-3">Total a pagar</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={7} className="py-10 text-center text-gray-500">Cargando…</td></tr>}
            {!loading && porAuxiliar.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-gray-500">Sin servicios completados en el periodo.</td></tr>}
            {!loading && porAuxiliar.map(a => (
              <tr key={a.name} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-700">{a.name}</td>
                <td className="px-4 py-3 text-center text-gray-600">{a.manana}</td>
                <td className="px-4 py-3 text-center text-gray-600">{a.tarde}</td>
                <td className="px-4 py-3 text-center text-gray-600">{a.dia}</td>
                <td className={`px-4 py-3 text-center ${a.sinTurno > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>{a.sinTurno}</td>
                <td className="px-4 py-3 text-center text-gray-600">{a.dominical}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCOP(a.pago)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {haySinTurno && (
        <p className="text-xs text-amber-600">⚠️ Los servicios «Sin turno» no se valoran automáticamente (no tienen turno asignado): revísalos y ajústalos en la agenda si deben pagarse.</p>
      )}
    </div>
  )
}

function RateInput({ label, value, onChange, cls }: { label: string; value: number; onChange: (v: string) => void; cls: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type="number" inputMode="numeric" min={0} value={value || ''} onChange={e => onChange(e.target.value)} placeholder="0" className={cls} />
    </div>
  )
}
