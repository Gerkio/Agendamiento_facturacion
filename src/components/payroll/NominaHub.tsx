'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP } from '@/lib/format'
import { MESES, runStatusLabel, runStatusCls } from '@/lib/payroll/options'
import { calcDesprendible, fromParamsRow } from '@/lib/payroll/calc'
import type { PayrollRun, PayrollParameters, Cleaner } from '@/types/database'

interface Props {
  initialRuns: PayrollRun[]
  params: PayrollParameters[]
  cleaners: Cleaner[]
}

const contractOf = (c: Cleaner) => ({
  baseSalary: Number(c.base_salary), salaryType: (c.salary_type === 'integral' ? 'integral' : 'ordinario') as 'ordinario' | 'integral',
  arlRisk: c.arl_risk_level ?? 'III', hasTransport: c.has_transport_allowance ?? true,
})

export default function NominaHub({ initialRuns, params, cleaners }: Props) {
  const [runs] = useState<PayrollRun[]>(initialRuns)
  const [wizard, setWizard] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/nomina/parameters" className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">⚙️ Parámetros</Link>
        <Link href="/dashboard/nomina/contracts" className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">📄 Contratos</Link>
        <button type="button" onClick={() => setWizard(true)} className="ml-auto text-sm px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700">+ Nueva corrida</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[680px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
            <th className="text-left px-4 py-3">Corrida</th>
            <th className="text-left px-4 py-3">Periodo</th>
            <th className="text-left px-4 py-3">Estado</th>
            <th className="text-right px-4 py-3">Neto</th>
            <th className="text-right px-4 py-3">Costo empresa</th>
            <th className="px-4 py-3"><span className="sr-only">Ver</span></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {runs.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-500">Sin corridas. Crea la primera.</td></tr>}
            {runs.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{r.cod ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700">{MESES[r.month]} {r.year}{r.period_kind !== 'mensual' ? ` · ${r.period_kind === 'quincena_1' ? '1.ª quincena' : '2.ª quincena'}` : ''}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${runStatusCls(r.status)}`}>{runStatusLabel(r.status)}</span></td>
                <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatCOP(Number(r.total_neto))}</td>
                <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{formatCOP(Number(r.costo_total_empleador))}</td>
                <td className="px-4 py-3 text-right"><Link href={`/dashboard/nomina/runs/${r.id}`} className="text-brand-600 hover:underline text-xs font-medium">Ver</Link></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {wizard && <RunWizard params={params} cleaners={cleaners} onClose={() => setWizard(false)} />}
    </div>
  )
}

function RunWizard({ params, cleaners, onClose }: { params: PayrollParameters[]; cleaners: Cleaner[]; onClose: () => void }) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useUI()
  const verifiedParams = params.filter(p => p.verified_by_accountant)
  const [year, setYear] = useState(verifiedParams[0]?.year ?? 0)
  const [month, setMonth] = useState(1)
  const [periodKind, setPeriodKind] = useState('mensual')
  const [days, setDays] = useState<Record<string, number>>(() => Object.fromEntries(cleaners.map(c => [c.id, 30])))
  const [saving, setSaving] = useState(false)

  const param = verifiedParams.find(p => p.year === year)
  const P = param ? fromParamsRow(param as unknown as Record<string, unknown>) : null

  const computed = P
    ? cleaners.map(c => ({ cleaner: c, workedDays: days[c.id] ?? 30, d: calcDesprendible(contractOf(c), P, { workedDays: days[c.id] ?? 30 }) }))
    : []

  const totals = computed.reduce((t, x) => ({
    neto: t.neto + x.d.netoPagar, devengado: t.devengado + x.d.totalDevengado, aportes: t.aportes + x.d.totalAportes,
    provisiones: t.provisiones + x.d.totalProvisiones, deducciones: t.deducciones + x.d.totalDeducciones, costo: t.costo + x.d.costoEmpleador,
  }), { neto: 0, devengado: 0, aportes: 0, provisiones: 0, deducciones: 0, costo: 0 })

  async function generar() {
    if (!param || !P) { toast('Elige un año con parámetros verificados.', 'error'); return }
    if (!cleaners.length) { toast('No hay auxiliares con salario base definido.', 'error'); return }
    setSaving(true)
    const { data: run, error } = await supabase.from('payroll_runs').insert({
      year, month, period_kind: periodKind, param_id: param.id, status: 'calculada',
      total_devengado: totals.devengado, total_deducciones: totals.deducciones, total_neto: totals.neto,
      total_aportes_patronales: totals.aportes, total_provisiones: totals.provisiones, costo_total_empleador: totals.costo,
    }).select('id').single()
    if (error || !run) {
      setSaving(false)
      toast(error?.message?.includes('duplicate') ? 'Ya existe una corrida para ese periodo.' : 'No se pudo crear: ' + (error?.message ?? ''), 'error')
      return
    }
    const itemRows = computed.map(({ cleaner: c, workedDays, d }) => ({
      run_id: run.id, cleaner_id: c.id, base_salary: Number(c.base_salary), salary_type: c.salary_type ?? 'ordinario', arl_risk_level: c.arl_risk_level ?? 'III',
      ibc: d.ibc, worked_days: workedDays, salary_earned: d.salaryEarned, transport_allowance: d.transport, total_devengado: d.totalDevengado,
      health_employee: d.healthEmployee, pension_employee: d.pensionEmployee, fsp: d.fsp, total_deducciones: d.totalDeducciones, neto_pagar: d.netoPagar,
      health_employer: d.healthEmployer, pension_employer: d.pensionEmployer, arl: d.arl, ccf: d.ccf, icbf: d.icbf, sena: d.sena, exonerated: d.exonerated,
      prov_cesantias: d.provCesantias, prov_intereses: d.provIntereses, prov_prima: d.provPrima, prov_vacaciones: d.provVacaciones, total_provisiones: d.totalProvisiones, costo_empleador: d.costoEmpleador,
    }))
    const { error: itemsErr } = await supabase.from('payroll_items').insert(itemRows)
    if (itemsErr) {
      await supabase.from('payroll_runs').delete().eq('id', run.id)
      setSaving(false); toast('No se pudieron generar los desprendibles; se canceló la corrida.', 'error'); return
    }
    toast('Corrida generada.', 'success')
    router.push(`/dashboard/nomina/runs/${run.id}`)
  }

  const input = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10"><h2 className="text-lg font-semibold">Nueva corrida de nómina</h2><button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button></div>
        <div className="p-5 space-y-4">
          {verifiedParams.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">No hay un año con parámetros <strong>verificados por el contador</strong>. Ve a Parámetros, confirma las cifras y marca el año como verificado.</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                <select title="Año" value={year} onChange={e => setYear(Number(e.target.value))} className={input}>{verifiedParams.map(p => <option key={p.year} value={p.year}>{p.year}</option>)}</select>
                <select title="Mes" value={month} onChange={e => setMonth(Number(e.target.value))} className={input}>{MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}</select>
                <select title="Periodo" value={periodKind} onChange={e => setPeriodKind(e.target.value)} className={input}>
                  <option value="mensual">Mensual</option><option value="quincena_1">1.ª quincena</option><option value="quincena_2">2.ª quincena</option>
                </select>
              </div>

              {cleaners.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No hay auxiliares con salario base definido. Captúralo en Contratos.</p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
                      <th className="text-left px-3 py-2">Auxiliar</th><th className="text-center px-3 py-2">Días</th>
                      <th className="text-right px-3 py-2">Devengado</th><th className="text-right px-3 py-2">Deducc.</th><th className="text-right px-3 py-2">Neto</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {computed.map(({ cleaner: c, d }) => (
                        <tr key={c.id}>
                          <td className="px-3 py-2 text-gray-700">{c.full_name}{d.exonerated && <span className="ml-1 text-xs text-green-600" title="Exonerado art. 114-1">·exon.</span>}</td>
                          <td className="px-3 py-2 text-center"><input type="number" title="Días" min={0} max={30} value={days[c.id] ?? 30} onChange={e => setDays(prev => ({ ...prev, [c.id]: Math.max(0, Math.min(30, Number(e.target.value) || 0)) }))} className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center" /></td>
                          <td className="px-3 py-2 text-right">{formatCOP(d.totalDevengado)}</td>
                          <td className="px-3 py-2 text-right text-gray-500">{formatCOP(d.totalDeducciones)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCOP(d.netoPagar)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <Tot k="Neto a pagar" v={formatCOP(totals.neto)} strong />
                <Tot k="Aportes patronales" v={formatCOP(totals.aportes)} />
                <Tot k="Provisiones" v={formatCOP(totals.provisiones)} />
                <Tot k="Costo empresa" v={formatCOP(totals.costo)} strong />
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={generar} disabled={saving || !param || cleaners.length === 0} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Generando…' : 'Generar corrida'}</button>
        </div>
      </div>
    </div>
  )
}

const Tot = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
  <div className={`rounded-lg border p-2 ${strong ? 'border-brand-200 bg-brand-50' : 'border-gray-200 bg-white'}`}>
    <p className="text-xs text-gray-500">{k}</p>
    <p className={`${strong ? 'font-bold text-brand-700' : 'font-medium text-gray-800'}`}>{v}</p>
  </div>
)
