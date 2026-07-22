'use client'

import { useMemo, useState } from 'react'
import { formatCOP, fmtDate } from '@/lib/format'
import { bogotaToday } from '@/lib/dates'
import { buildCsv, downloadCsv } from '@/lib/csv'
import { CONTRACT_TYPES, SALARY_TYPES } from '@/lib/payroll/options'
import { calcSettlement, type SettlementContract, type ContractType, type TerminationCause } from '@/lib/payroll/settlement'
import type { Cleaner, PayrollParameters } from '@/types/database'

const CAUSES: { value: TerminationCause; label: string }[] = [
  { value: 'sin_justa_causa', label: 'Despido sin justa causa' },
  { value: 'justa_causa', label: 'Despido con justa causa' },
  { value: 'renuncia', label: 'Renuncia voluntaria' },
  { value: 'vencimiento', label: 'Vencimiento del plazo / obra' },
  { value: 'mutuo_acuerdo', label: 'Mutuo acuerdo' },
]

interface Props {
  cleaners: Cleaner[]
  params: PayrollParameters[]
}

/** Inicio del semestre de prima (Ene 1 o Jul 1) que contiene la fecha dada. */
function semesterStart(iso: string): string {
  const parts = iso.slice(0, 10).split('-')
  const y = parts[0]; const m = Number(parts[1])
  return m <= 6 ? `${y}-01-01` : `${y}-07-01`
}

export default function SettlementView({ cleaners, params }: Props) {
  const [cleanerId, setCleanerId] = useState('')
  const [termination, setTermination] = useState<string>(bogotaToday())
  const [cause, setCause] = useState<TerminationCause>('sin_justa_causa')
  // Contrato (prellenado del auxiliar, editable).
  const [baseSalary, setBaseSalary] = useState('')
  const [salaryType, setSalaryType] = useState<'ordinario' | 'integral'>('ordinario')
  const [contractType, setContractType] = useState<ContractType>('indefinido')
  const [hasTransport, setHasTransport] = useState(true)
  const [contractEnd, setContractEnd] = useState('')
  // Bases de cada concepto (fecha "desde"), editables para descontar lo ya pagado.
  const [cesantiasFrom, setCesantiasFrom] = useState('')
  const [primaFrom, setPrimaFrom] = useState('')
  const [vacacionesFrom, setVacacionesFrom] = useState('')
  const [printing, setPrinting] = useState(false)

  const selected = cleaners.find(c => c.id === cleanerId) ?? null

  function selectCleaner(id: string) {
    setCleanerId(id)
    const c = cleaners.find(x => x.id === id)
    if (!c) return
    const start = c.contract_start ?? ''
    setBaseSalary(c.base_salary != null ? String(c.base_salary) : '')
    setSalaryType(c.salary_type === 'integral' ? 'integral' : 'ordinario')
    setContractType((c.contract_type as ContractType) || 'indefinido')
    setHasTransport(c.has_transport_allowance ?? true)
    setContractEnd(c.contract_end ?? '')
    setCesantiasFrom(start)
    setVacacionesFrom(start)
    setPrimaFrom(semesterStart(termination))
  }

  // Parámetros del año de terminación (o el más reciente disponible).
  const termYear = Number(termination.slice(0, 4))
  const param = useMemo(() => params.find(p => p.year === termYear) ?? params[0] ?? null, [params, termYear])
  const paramRow = param as unknown as Record<string, unknown> | null
  const smmlv = paramRow ? Number(paramRow.smmlv) : 0
  const transportAllowance = paramRow ? Number(paramRow.transport_allowance) : 0
  const interesesRate = paramRow ? Number(paramRow.intereses_cesantias_rate) : 0.12

  const salaryNum = Number(baseSalary) || 0
  // Auxilio de transporte a la base de prestaciones: solo si lo recibe y gana ≤ 2 SMMLV.
  const transportForBase = hasTransport && salaryType === 'ordinario' && smmlv > 0 && salaryNum <= 2 * smmlv ? transportAllowance : 0

  const settlement = useMemo(() => {
    if (!(salaryNum > 0) || !termination || !cesantiasFrom || !primaFrom || !vacacionesFrom) return null
    const contract: SettlementContract = {
      baseSalary: salaryNum, salaryType, contractType,
      transportAllowance: transportForBase, smmlv, interesesCesantiasRate: interesesRate,
    }
    return calcSettlement(contract, {
      cesantiasFrom, primaFrom, vacacionesFrom, terminationDate: termination,
      contractEnd: contractEnd || null, cause,
    })
  }, [salaryNum, salaryType, contractType, transportForBase, smmlv, interesesRate, cesantiasFrom, primaFrom, vacacionesFrom, termination, contractEnd, cause])

  function exportCsv() {
    if (!settlement || !selected) return
    const s = settlement
    const rows: (string | number)[][] = [
      ['Cesantías', s.diasCesantias, s.cesantias],
      ['Intereses a las cesantías', '', s.intereses],
      ['Prima de servicios', s.diasPrima, s.prima],
      ['Vacaciones', s.diasVacaciones, s.vacaciones],
      ['Indemnización art. 64', '', s.indemnizacion],
      ['TOTAL', '', s.total],
    ]
    downloadCsv(`liquidacion-${(selected.full_name ?? 'auxiliar').replace(/\s+/g, '_')}-${termination}`, buildCsv(['Concepto', 'Días', 'Valor (COP)'], rows))
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
  const needsEnd = contractType === 'fijo' || contractType === 'obra_labor'

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        ⚠️ <strong>Cifras de referencia.</strong> Usan convención de 360 días y no descuentan pagos previos (cesantías consignadas, primas pagadas, vacaciones disfrutadas) salvo que ajustes las fechas «desde». Valida con el contador antes de pagar.
      </div>

      {/* Selección */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Auxiliar</label>
          <select title="Auxiliar" value={cleanerId} onChange={e => selectCleaner(e.target.value)} className={input}>
            <option value="">Seleccionar…</option>
            {cleaners.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de terminación</label>
          <input type="date" title="Fecha de terminación" value={termination} onChange={e => setTermination(e.target.value)} className={input} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Causa</label>
          <select title="Causa de terminación" value={cause} onChange={e => setCause(e.target.value as TerminationCause)} className={input}>
            {CAUSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {cleanerId && (
        <>
          {/* Contrato */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Contrato {param && !param.verified_by_accountant && <span className="ml-1 text-xs text-amber-600">· parámetros {param.year} sin verificar</span>}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Salario base (COP)</label>
                <input type="number" inputMode="numeric" min={0} value={baseSalary} onChange={e => setBaseSalary(e.target.value)} className={input} placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de salario</label>
                <select title="Tipo de salario" value={salaryType} onChange={e => setSalaryType(e.target.value as 'ordinario' | 'integral')} className={input}>
                  {SALARY_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de contrato</label>
                <select title="Tipo de contrato" value={contractType} onChange={e => setContractType(e.target.value as ContractType)} className={input}>
                  {CONTRACT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 mt-5">
                <input type="checkbox" checked={hasTransport} onChange={e => setHasTransport(e.target.checked)} className="rounded" /> Recibe auxilio de transporte
              </label>
              {needsEnd && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fin pactado {contractType === 'obra_labor' ? '(fin de obra)' : '(del contrato)'}</label>
                  <input type="date" title="Fin del contrato" value={contractEnd} onChange={e => setContractEnd(e.target.value)} className={input} />
                </div>
              )}
            </div>
          </div>

          {/* Bases (fechas desde) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Acumulado desde</h2>
            <p className="text-xs text-gray-500 mb-3">Mueve la fecha si ya se pagó/consignó parte: el cálculo cuenta desde ahí hasta la terminación.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cesantías e intereses</label>
                <input type="date" title="Cesantías desde" value={cesantiasFrom} onChange={e => setCesantiasFrom(e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prima (semestre)</label>
                <input type="date" title="Prima desde" value={primaFrom} onChange={e => setPrimaFrom(e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vacaciones</label>
                <input type="date" title="Vacaciones desde" value={vacacionesFrom} onChange={e => setVacacionesFrom(e.target.value)} className={input} />
              </div>
            </div>
          </div>

          {/* Resultado */}
          {settlement ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto"><table className="w-full text-sm min-w-[520px]">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
                  <th className="text-left px-4 py-3">Concepto</th>
                  <th className="text-center px-4 py-3">Días</th>
                  <th className="text-right px-4 py-3">Valor</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  <Row k="Cesantías" d={settlement.diasCesantias} v={settlement.cesantias} />
                  <Row k="Intereses a las cesantías" v={settlement.intereses} />
                  <Row k="Prima de servicios" d={settlement.diasPrima} v={settlement.prima} />
                  <Row k="Vacaciones" d={settlement.diasVacaciones} v={settlement.vacaciones} />
                  <Row k="Indemnización (art. 64)" v={settlement.indemnizacion} />
                </tbody>
                <tfoot>
                  <tr className="bg-brand-50 font-bold text-brand-700"><td className="px-4 py-3">TOTAL A PAGAR</td><td /><td className="px-4 py-3 text-right">{formatCOP(settlement.total)}</td></tr>
                </tfoot>
              </table></div>
              <div className="p-4 border-t border-gray-100 flex flex-wrap items-center gap-3">
                <p className="text-xs text-gray-500 flex-1 min-w-[220px]">{settlement.indemnizacionDetalle}</p>
                <button type="button" onClick={exportCsv} className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">⬇️ CSV</button>
                <button type="button" onClick={() => setPrinting(true)} className="text-sm px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700">Ver / Imprimir</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Captura el salario base y las fechas para ver la liquidación.</p>
          )}
        </>
      )}

      {printing && settlement && selected && (
        <SettlementPrint name={selected.full_name ?? 'Auxiliar'} termination={termination}
          cause={CAUSES.find(c => c.value === cause)?.label ?? ''} s={settlement} onClose={() => setPrinting(false)} />
      )}
    </div>
  )
}

function Row({ k, d, v }: { k: string; d?: number; v: number }) {
  return (
    <tr>
      <td className="px-4 py-3 text-gray-700">{k}</td>
      <td className="px-4 py-3 text-center text-gray-500">{d ?? ''}</td>
      <td className="px-4 py-3 text-right font-medium">{formatCOP(v)}</td>
    </tr>
  )
}

function SettlementPrint({ name, termination, cause, s, onClose }: {
  name: string; termination: string; cause: string
  s: ReturnType<typeof calcSettlement>; onClose: () => void
}) {
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/60 flex items-start justify-center z-[60] p-4 overflow-y-auto print:bg-white print:p-0 print:static print:block">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md print:max-w-none">
        <div className="flex items-center justify-end gap-2 mb-3 print:hidden">
          <button type="button" onClick={() => window.print()} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700">🖨️ Imprimir / PDF</button>
          <button type="button" onClick={onClose} className="bg-white text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-100">Cerrar</button>
        </div>
        <div className="bg-white rounded-xl shadow-xl p-6 text-gray-800 print:shadow-none print:rounded-none">
          <h1 className="text-lg font-bold border-b-2 border-gray-800 pb-2">Liquidación definitiva de contrato</h1>
          <div className="mt-3 text-sm space-y-1">
            <p><span className="text-gray-500">Auxiliar:</span> <strong>{name}</strong></p>
            <p><span className="text-gray-500">Terminación:</span> {fmtDate(termination)}</p>
            <p><span className="text-gray-500">Causa:</span> {cause}</p>
          </div>
          <table className="w-full text-sm mt-4 border-collapse">
            <tbody>
              <PrintRow k="Cesantías" v={s.cesantias} />
              <PrintRow k="Intereses a las cesantías" v={s.intereses} />
              <PrintRow k="Prima de servicios" v={s.prima} />
              <PrintRow k="Vacaciones" v={s.vacaciones} />
              <PrintRow k="Indemnización (art. 64)" v={s.indemnizacion} />
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-800 font-bold"><td className="py-2">TOTAL A PAGAR</td><td className="py-2 text-right text-brand-700">{formatCOP(s.total)}</td></tr>
            </tfoot>
          </table>
          <p className="text-[11px] text-gray-500 mt-3">{s.indemnizacionDetalle}</p>
          <div className="mt-10 grid grid-cols-2 gap-6 text-center text-xs text-gray-500">
            <div className="border-t border-gray-400 pt-1">Empleador</div>
            <div className="border-t border-gray-400 pt-1">Recibí conforme (trabajador)</div>
          </div>
          <p className="text-[10px] text-gray-400 mt-4 text-center">Documento de control interno. Cifras de referencia sujetas a validación contable.</p>
        </div>
      </div>
    </div>
  )
}

function PrintRow({ k, v }: { k: string; v: number }) {
  return <tr className="border-b border-gray-100"><td className="py-1">{k}</td><td className="py-1 text-right">{formatCOP(v)}</td></tr>
}
