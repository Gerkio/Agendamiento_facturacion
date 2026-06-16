'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP } from '@/lib/format'
import { buildCsv, downloadCsv } from '@/lib/csv'
import { numeroALetras } from '@/lib/dian/number-to-words'
import { MESES, runStatusLabel, runStatusCls } from '@/lib/payroll/options'
import type { PayrollRun, PayrollItem } from '@/types/database'

const nameOf = (i: PayrollItem) => i.cleaners?.full_name ?? '—'

export default function RunDetail({ run: initialRun, items, emisorName }: { run: PayrollRun; items: PayrollItem[]; emisorName: string }) {
  const supabase = createClient()
  const router = useRouter()
  const { toast, confirm } = useUI()
  const [run, setRun] = useState(initialRun)
  const [slip, setSlip] = useState<PayrollItem | null>(null)
  const [busy, setBusy] = useState(false)

  async function setStatus(next: string, danger = false) {
    if (danger) {
      const ok = await confirm({ title: 'Anular corrida', message: 'La corrida quedará anulada. ¿Continuar?', confirmLabel: 'Anular', danger: true })
      if (!ok) return
    }
    setBusy(true)
    const { error } = await supabase.from('payroll_runs').update({ status: next }).eq('id', run.id)
    setBusy(false)
    if (error) { toast('No se pudo actualizar: ' + error.message, 'error'); return }
    setRun(r => ({ ...r, status: next }))
    toast('Estado actualizado.', 'success')
    router.refresh()
  }

  function exportCsv() {
    const headers = ['Auxiliar', 'Documento', 'Días', 'IBC', 'Devengado', 'Salud', 'Pensión', 'FSP', 'Deducciones', 'Neto', 'Salud emp', 'Pensión emp', 'ARL', 'CCF', 'ICBF', 'SENA', 'Aportes', 'Provisiones', 'Costo empresa']
    const rows = items.map(i => [
      nameOf(i), i.cleaners?.document_id ?? '', i.worked_days, Number(i.ibc), Number(i.total_devengado), Number(i.health_employee), Number(i.pension_employee), Number(i.fsp), Number(i.total_deducciones), Number(i.neto_pagar),
      Number(i.health_employer), Number(i.pension_employer), Number(i.arl), Number(i.ccf), Number(i.icbf), Number(i.sena), Number(i.health_employer) + Number(i.pension_employer) + Number(i.arl) + Number(i.ccf) + Number(i.icbf) + Number(i.sena), Number(i.total_provisiones), Number(i.costo_empleador),
    ])
    downloadCsv(`nomina-${run.cod ?? run.id}`, buildCsv(headers, rows))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/dashboard/nomina" className="text-sm text-brand-600 hover:underline">← Corridas</Link>
        <h1 className="text-xl font-semibold text-gray-800">{run.cod} · {MESES[run.month]} {run.year}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${runStatusCls(run.status)}`}>{runStatusLabel(run.status)}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={exportCsv} className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">⬇️ CSV</button>
          {run.status === 'calculada' && <button type="button" disabled={busy} onClick={() => setStatus('aprobada')} className="text-sm px-3 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">Aprobar</button>}
          {run.status === 'aprobada' && <button type="button" disabled={busy} onClick={() => setStatus('pagada')} className="text-sm px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">Marcar pagada</button>}
          {run.status !== 'anulada' && run.status !== 'pagada' && <button type="button" disabled={busy} onClick={() => setStatus('anulada', true)} className="text-sm px-3 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50">Anular</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi k="Devengado" v={formatCOP(Number(run.total_devengado))} />
        <Kpi k="Neto a pagar" v={formatCOP(Number(run.total_neto))} accent />
        <Kpi k="Aportes patronales" v={formatCOP(Number(run.total_aportes_patronales))} />
        <Kpi k="Costo empresa" v={formatCOP(Number(run.costo_total_empleador))} accent />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[760px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
            <th className="text-left px-4 py-3">Auxiliar</th>
            <th className="text-center px-4 py-3">Días</th>
            <th className="text-right px-4 py-3">Devengado</th>
            <th className="text-right px-4 py-3">Deducciones</th>
            <th className="text-right px-4 py-3">Neto</th>
            <th className="text-right px-4 py-3">Aportes</th>
            <th className="px-4 py-3"><span className="sr-only">Desprendible</span></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-gray-500">Sin desprendibles.</td></tr>}
            {items.map(i => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-800">{nameOf(i)}{i.exonerated && <span className="ml-1 text-xs text-green-600">·exon.</span>}</td>
                <td className="px-4 py-3 text-center text-gray-600">{i.worked_days}</td>
                <td className="px-4 py-3 text-right">{formatCOP(Number(i.total_devengado))}</td>
                <td className="px-4 py-3 text-right text-gray-500">{formatCOP(Number(i.total_deducciones))}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCOP(Number(i.neto_pagar))}</td>
                <td className="px-4 py-3 text-right text-gray-500">{formatCOP(Number(i.health_employer) + Number(i.pension_employer) + Number(i.arl) + Number(i.ccf) + Number(i.icbf) + Number(i.sena))}</td>
                <td className="px-4 py-3 text-right"><button type="button" onClick={() => setSlip(i)} className="text-brand-600 hover:underline text-xs font-medium">Desprendible</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {slip && <PaySlip item={slip} run={run} emisorName={emisorName} onClose={() => setSlip(null)} />}
    </div>
  )
}

const Kpi = ({ k, v, accent }: { k: string; v: string; accent?: boolean }) => (
  <div className={`rounded-xl border shadow-sm p-4 ${accent ? 'border-brand-200 bg-brand-50' : 'border-gray-200 bg-white'}`}>
    <p className="text-xs uppercase text-gray-500 font-semibold truncate">{k}</p>
    <p className={`text-lg font-bold mt-1 truncate ${accent ? 'text-brand-700' : 'text-gray-800'}`}>{v}</p>
  </div>
)

function PaySlip({ item, run, emisorName, onClose }: { item: PayrollItem; run: PayrollRun; emisorName: string; onClose: () => void }) {
  const aportes = Number(item.health_employer) + Number(item.pension_employer) + Number(item.arl) + Number(item.ccf) + Number(item.icbf) + Number(item.sena)
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/60 flex items-start justify-center z-[60] p-4 overflow-y-auto print:bg-white print:p-0 print:static print:block">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md print:max-w-none">
        <div className="flex items-center justify-end gap-2 mb-3 print:hidden">
          <button type="button" onClick={() => window.print()} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700">🖨️ Imprimir / PDF</button>
          <button type="button" onClick={onClose} className="bg-white text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-100">Cerrar</button>
        </div>
        <div className="bg-white rounded-xl shadow-xl p-6 text-gray-800 print:shadow-none print:rounded-none">
          <div className="flex items-center justify-between border-b-2 border-gray-800 pb-3">
            <div><h1 className="text-lg font-bold">{emisorName}</h1><p className="text-xs text-gray-500">Desprendible de nómina</p></div>
            <div className="text-right text-xs text-gray-500"><p>{MESES[run.month]} {run.year}</p><p className="font-mono">{run.cod}</p></div>
          </div>
          <div className="mt-3 text-sm">
            <p className="font-semibold">{item.cleaners?.full_name ?? '—'}</p>
            <p className="text-xs text-gray-500">CC {item.cleaners?.document_id ?? '—'} · {item.worked_days} día(s) · IBC {formatCOP(Number(item.ibc))}</p>
          </div>

          <Section title="Devengados">
            <Row k="Salario" v={Number(item.salary_earned)} />
            {Number(item.transport_allowance) > 0 && <Row k="Auxilio de transporte" v={Number(item.transport_allowance)} />}
            <Row k="Total devengado" v={Number(item.total_devengado)} bold />
          </Section>
          <Section title="Deducciones">
            <Row k="Salud (4%)" v={Number(item.health_employee)} />
            <Row k="Pensión (4%)" v={Number(item.pension_employee)} />
            {Number(item.fsp) > 0 && <Row k="Fondo solidaridad pensional" v={Number(item.fsp)} />}
            <Row k="Total deducciones" v={Number(item.total_deducciones)} bold />
          </Section>
          <div className="mt-3 border-t-2 border-gray-800 pt-2 flex justify-between font-bold"><span>NETO A PAGAR</span><span className="text-brand-700">{formatCOP(Number(item.neto_pagar))}</span></div>
          <p className="text-xs text-gray-600 mt-1">Son: {numeroALetras(Number(item.neto_pagar))}</p>

          <Section title="Aportes del empleador (informativo)">
            <Row k="Salud" v={Number(item.health_employer)} /><Row k="Pensión" v={Number(item.pension_employer)} /><Row k="ARL" v={Number(item.arl)} />
            <Row k="Caja / ICBF / SENA" v={Number(item.ccf) + Number(item.icbf) + Number(item.sena)} />
            <Row k="Total aportes" v={aportes} bold />
            {item.exonerated && <p className="text-xs text-green-600">Exonerado de salud patronal, ICBF y SENA (art. 114-1).</p>}
          </Section>
          <Section title="Provisión de prestaciones (informativo)">
            <Row k="Cesantías + intereses" v={Number(item.prov_cesantias) + Number(item.prov_intereses)} />
            <Row k="Prima" v={Number(item.prov_prima)} /><Row k="Vacaciones" v={Number(item.prov_vacaciones)} />
          </Section>
          <p className="text-[10px] text-gray-400 mt-4 text-center">Documento interno. La nómina electrónica DIAN requiere los artefactos oficiales (XSD, CUNE) aún no integrados.</p>
        </div>
      </div>
    </div>
  )
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-4"><p className="text-xs font-semibold uppercase text-gray-500 border-b border-gray-200 pb-1 mb-1">{title}</p><div className="text-sm space-y-0.5">{children}</div></div>
)
const Row = ({ k, v, bold }: { k: string; v: number; bold?: boolean }) => (
  <div className={`flex justify-between ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}><span>{k}</span><span>{formatCOP(v)}</span></div>
)
