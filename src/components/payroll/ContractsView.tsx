'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP } from '@/lib/format'
import { CONTRACT_TYPES, SALARY_TYPES, ARL_LEVELS, PERIODICITIES, ACCOUNT_TYPES, salaryTypeLabel } from '@/lib/payroll/options'
import type { Cleaner } from '@/types/database'

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
)

/** Contrato laboral del auxiliar (datos que la nómina necesita): salario, tipo,
 *  riesgo ARL, banco, EPS/AFP/CCF, fechas. Solo admin. */
export default function ContractsView({ initial }: { initial: Cleaner[] }) {
  const [rows, setRows] = useState<Cleaner[]>(initial)
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<Cleaner | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(c => !q || c.full_name.toLowerCase().includes(q) || (c.document_id ?? '').includes(q))
  }, [rows, search])

  return (
    <div className="space-y-4">
      <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar auxiliar…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[680px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
            <th className="text-left px-4 py-3">Auxiliar</th>
            <th className="text-right px-4 py-3">Salario base</th>
            <th className="text-left px-4 py-3">Tipo</th>
            <th className="text-left px-4 py-3">Riesgo ARL</th>
            <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-gray-500">Sin auxiliares.</td></tr>}
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-800">{c.full_name}<div className="text-xs text-gray-500 font-mono">{c.document_id}</div></td>
                <td className="px-4 py-3 text-right font-medium">{c.base_salary ? formatCOP(Number(c.base_salary)) : <span className="text-amber-600 text-xs">Sin definir</span>}</td>
                <td className="px-4 py-3 text-gray-600">{c.base_salary ? salaryTypeLabel(c.salary_type) : '—'}</td>
                <td className="px-4 py-3 text-gray-600">{c.arl_risk_level ?? '—'}</td>
                <td className="px-4 py-3 text-right"><button type="button" onClick={() => setEdit(c)} className="text-brand-600 hover:underline text-xs font-medium">Editar contrato</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {edit && <ContractModal cleaner={edit} onClose={() => setEdit(null)} onSaved={c => { setRows(prev => prev.map(x => x.id === c.id ? c : x)); setEdit(null) }} />}
    </div>
  )
}

function ContractModal({ cleaner, onClose, onSaved }: { cleaner: Cleaner; onClose: () => void; onSaved: (c: Cleaner) => void }) {
  const supabase = createClient()
  const { toast } = useUI()
  const [form, setForm] = useState({
    base_salary: cleaner.base_salary != null ? String(cleaner.base_salary) : '',
    salary_type: cleaner.salary_type ?? 'ordinario',
    contract_type: cleaner.contract_type ?? 'indefinido',
    arl_risk_level: cleaner.arl_risk_level ?? 'III',
    has_transport_allowance: cleaner.has_transport_allowance ?? true,
    payment_periodicity: cleaner.payment_periodicity ?? 'mensual',
    eps: cleaner.eps ?? '', afp_code: cleaner.afp_code ?? '', ccf_code: cleaner.ccf_code ?? '',
    bank_name: cleaner.bank_name ?? '', bank_account_type: cleaner.bank_account_type ?? 'ahorros', bank_account_number: cleaner.bank_account_number ?? '',
    contract_start: cleaner.contract_start ?? '', contract_end: cleaner.contract_end ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof form, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!Number(form.base_salary)) { toast('El salario base es obligatorio.', 'error'); return }
    setSaving(true)
    const { data, error } = await supabase.from('cleaners').update({
      base_salary: Number(form.base_salary), salary_type: form.salary_type, contract_type: form.contract_type,
      arl_risk_level: form.arl_risk_level, has_transport_allowance: form.has_transport_allowance, payment_periodicity: form.payment_periodicity,
      eps: form.eps.trim() || null, afp_code: form.afp_code.trim() || null, ccf_code: form.ccf_code.trim() || null,
      bank_name: form.bank_name.trim() || null, bank_account_type: form.bank_account_type, bank_account_number: form.bank_account_number.trim() || null,
      contract_start: form.contract_start || null, contract_end: form.contract_end || null,
    }).eq('id', cleaner.id).select('*').single()
    setSaving(false)
    if (error || !data) { toast('No se pudo guardar: ' + (error?.message ?? ''), 'error'); return }
    toast('Contrato actualizado.', 'success')
    onSaved(data as Cleaner)
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white"><h2 className="text-lg font-semibold">Contrato · {cleaner.full_name}</h2><button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button></div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Salario base (COP)"><input type="number" title="Salario base" value={form.base_salary} onChange={e => set('base_salary', e.target.value)} className={input} /></Field>
          <Field label="Tipo de salario"><select title="Tipo de salario" value={form.salary_type} onChange={e => set('salary_type', e.target.value)} className={input}>{SALARY_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
          <Field label="Tipo de contrato"><select title="Tipo de contrato" value={form.contract_type} onChange={e => set('contract_type', e.target.value)} className={input}>{CONTRACT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
          <Field label="Nivel de riesgo ARL"><select title="Riesgo ARL" value={form.arl_risk_level} onChange={e => set('arl_risk_level', e.target.value)} className={input}>{ARL_LEVELS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
          <Field label="Periodicidad de pago"><select title="Periodicidad" value={form.payment_periodicity} onChange={e => set('payment_periodicity', e.target.value)} className={input}>{PERIODICITIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
          <div className="flex items-end"><label className="inline-flex items-center gap-2 text-sm border border-gray-300 rounded-lg px-3 py-2.5 w-full"><input type="checkbox" checked={form.has_transport_allowance} onChange={e => set('has_transport_allowance', e.target.checked)} className="rounded" /> Tiene auxilio de transporte</label></div>
          <Field label="EPS"><input type="text" title="EPS" value={form.eps} onChange={e => set('eps', e.target.value)} className={input} /></Field>
          <Field label="Fondo de pensión (AFP)"><input type="text" title="AFP" value={form.afp_code} onChange={e => set('afp_code', e.target.value)} className={input} /></Field>
          <Field label="Caja de compensación"><input type="text" title="Caja de compensación" value={form.ccf_code} onChange={e => set('ccf_code', e.target.value)} className={input} /></Field>
          <Field label="Banco"><input type="text" title="Banco" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className={input} /></Field>
          <Field label="Tipo de cuenta"><select title="Tipo de cuenta" value={form.bank_account_type} onChange={e => set('bank_account_type', e.target.value)} className={input}>{ACCOUNT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
          <Field label="N° de cuenta"><input type="text" title="Número de cuenta" value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} className={input} /></Field>
          <Field label="Inicio de contrato"><input type="date" title="Inicio de contrato" value={form.contract_start} onChange={e => set('contract_start', e.target.value)} className={input} /></Field>
          <Field label="Fin de contrato (si aplica)"><input type="date" title="Fin de contrato" value={form.contract_end} onChange={e => set('contract_end', e.target.value)} className={input} /></Field>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button><button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar contrato'}</button></div>
      </div>
    </div>
  )
}
