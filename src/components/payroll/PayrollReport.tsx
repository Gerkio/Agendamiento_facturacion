'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP, fmtDate } from '@/lib/format'
import { buildCsv, downloadCsv } from '@/lib/csv'
import { bogotaDayStartISO, bogotaDayEndISO, bogotaToday } from '@/lib/dates'

export interface SvcRow {
  cleaner_id: string
  turno: string | null
  recargo_dominical: boolean | null
  cleaners?: { full_name?: string } | null
}
/** Juego de tarifas vigente desde una fecha (fila de payroll_shift_rates). */
export interface ShiftRates {
  effective_from: string
  manana: number
  tarde: number
  dia_completo: number
  recargo_dominical: number
}
interface Rates { manana: number; tarde: number; dia_completo: number; recargo_dominical: number }

interface Props {
  /** Semilla del servidor (mes en curso): pinta sin spinner ni round-trip. */
  initialRange: { from: string; to: string }
  initialServices: SvcRow[]
  /** Tarifas vigentes al inicio del periodo (null si aún no se definió ninguna). */
  initialRate: ShiftRates | null
}

const ZERO: Rates = { manana: 0, tarde: 0, dia_completo: 0, recargo_dominical: 0 }
const toRates = (r: ShiftRates | null): Rates =>
  r ? { manana: Number(r.manana), tarde: Number(r.tarde), dia_completo: Number(r.dia_completo), recargo_dominical: Number(r.recargo_dominical) } : { ...ZERO }

/** P2 · Liquidación por turno: el admin fija las tarifas (mañana/tarde/día completo
 *  + recargo dominical) en una tabla COMPARTIDA con vigencia por fecha, y el sistema
 *  cuenta los servicios completados por auxiliar y turno en el periodo para calcular
 *  el pago con el juego vigente a esa fecha. Conecta Auxiliares + Servicios. */
export default function PayrollReport({ initialRange, initialServices, initialRate }: Props) {
  const supabase = createClient()
  const { toast } = useUI()
  const [range, setRange] = useState(initialRange)
  const [rows, setRows] = useState<SvcRow[]>(initialServices)
  const [loading, setLoading] = useState(false)
  const [rates, setRates] = useState<Rates>(toRates(initialRate))
  // Vigencia del juego aplicado en pantalla; y la fecha desde la cual se guardaría uno nuevo.
  const [vigenteDesde, setVigenteDesde] = useState<string | null>(initialRate?.effective_from ?? null)
  const [effectiveFrom, setEffectiveFrom] = useState<string>(bogotaToday())
  const [saving, setSaving] = useState(false)

  function setRate(k: keyof Rates, v: string) {
    setRates(r => ({ ...r, [k]: Number(v) || 0 }))
  }

  // Guarda el juego de tarifas actual como vigente desde `effectiveFrom` (upsert por
  // fecha). Compartido entre admins; no altera periodos anteriores.
  async function saveRates() {
    if (!effectiveFrom) { toast('Indica desde qué fecha rigen estas tarifas.', 'error'); return }
    setSaving(true)
    const { error } = await supabase
      .from('payroll_shift_rates')
      .upsert({
        effective_from: effectiveFrom,
        manana: rates.manana, tarde: rates.tarde,
        dia_completo: rates.dia_completo, recargo_dominical: rates.recargo_dominical,
      }, { onConflict: 'effective_from' })
    setSaving(false)
    if (error) { toast('No se pudieron guardar las tarifas: ' + error.message, 'error'); return }
    setVigenteDesde(effectiveFrom)
    toast('Tarifas guardadas (vigentes desde ' + fmtDate(effectiveFrom) + ').', 'success')
  }

  async function load(from: string, to: string) {
    if (!from || !to) return
    setLoading(true)
    // Servicios del periodo + tarifas vigentes al INICIO del periodo (para que
    // recalcular un mes pasado use su tarifa histórica, no la actual).
    const [{ data, error }, { data: rate }] = await Promise.all([
      supabase
        .from('services')
        .select('cleaner_id, turno, recargo_dominical, cleaners(full_name)')
        .eq('status', 'completed')
        .gte('start_time', bogotaDayStartISO(from))
        .lte('start_time', bogotaDayEndISO(to)),
      supabase
        .from('payroll_shift_rates')
        .select('effective_from, manana, tarde, dia_completo, recargo_dominical')
        .lte('effective_from', from)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (error) toast('Error cargando servicios: ' + error.message, 'error')
    setRows((data as SvcRow[]) ?? [])
    setRates(toRates((rate as ShiftRates | null) ?? null))
    setVigenteDesde((rate as ShiftRates | null)?.effective_from ?? null)
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
      .map(a => ({ ...a, pago: a.manana * rates.manana + a.tarde * rates.tarde + a.dia * rates.dia_completo + a.dominical * rates.recargo_dominical }))
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
      {/* Tarifas por turno (tabla compartida, con vigencia) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Tarifas por turno</h2>
          <span className="text-xs text-gray-500">
            {vigenteDesde ? `Vigentes desde ${fmtDate(vigenteDesde)}` : 'Sin tarifas definidas aún'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <RateInput label="Mañana" value={rates.manana} onChange={v => setRate('manana', v)} cls={inputCls} />
          <RateInput label="Tarde" value={rates.tarde} onChange={v => setRate('tarde', v)} cls={inputCls} />
          <RateInput label="Día completo" value={rates.dia_completo} onChange={v => setRate('dia_completo', v)} cls={inputCls} />
          <RateInput label="Recargo dominical" value={rates.recargo_dominical} onChange={v => setRate('recargo_dominical', v)} cls={inputCls} />
        </div>
        <div className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-gray-100">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rigen desde</label>
            <input type="date" title="Fecha desde la que rigen estas tarifas" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className={inputCls} />
          </div>
          <button type="button" onClick={saveRates} disabled={saving}
            className="text-sm px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar tarifas'}
          </button>
          <p className="text-xs text-gray-500 flex-1 min-w-[220px]">Se comparten entre todos los administradores. Recalcular un periodo pasado usa las tarifas que regían entonces.</p>
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
