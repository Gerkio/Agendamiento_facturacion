'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP } from '@/lib/format'
import type { PayrollParameters } from '@/types/database'

const pct = (f: number) => `${(Number(f) * 100).toFixed(2).replace(/\.?0+$/, '')}%`

/** Parámetros de nómina por año (SMMLV, auxilio, aportes, ARL, exoneración).
 *  Editables por el contador; un año debe quedar "verificado" antes de liquidar. */
export default function ParametersView({ initial }: { initial: PayrollParameters[] }) {
  const [rows, setRows] = useState<PayrollParameters[]>(initial)
  const [edit, setEdit] = useState<PayrollParameters | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        ⚠️ Las cifras sembradas son de referencia. <strong>Confírmalas con tu contador</strong> y marca el año como
        «verificado» antes de liquidar. El SMMLV 2026 ($1.750.905) proviene de un decreto judicialmente cuestionado; es editable.
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={() => setCreating(true)} className="text-sm px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700">+ Agregar año</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.map(p => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">{p.year}</h3>
              <div className="flex gap-1">
                {p.verified_by_accountant
                  ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Verificado</span>
                  : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Sin verificar</span>}
                {p.is_locked && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 font-medium">Bloqueado</span>}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <Dt k="SMMLV" v={formatCOP(Number(p.smmlv))} />
              <Dt k="Aux. transporte" v={formatCOP(Number(p.transport_allowance))} />
              <Dt k="Salud (emp/trab)" v={`${pct(p.health_employer)} / ${pct(p.health_employee)}`} />
              <Dt k="Pensión (emp/trab)" v={`${pct(p.pension_employer)} / ${pct(p.pension_employee)}`} />
              <Dt k="Parafiscales" v={`CCF ${pct(p.ccf_rate)} · ICBF ${pct(p.icbf_rate)} · SENA ${pct(p.sena_rate)}`} />
              <Dt k="Exoneración 114-1" v={p.exoneration_eligible ? 'Aplica' : 'No aplica'} />
            </div>
            <button type="button" onClick={() => setEdit(p)} className="mt-3 text-sm text-brand-600 hover:underline font-medium">Editar</button>
          </div>
        ))}
      </div>

      {edit && <EditModal param={edit} onClose={() => setEdit(null)} onSaved={p => { setRows(prev => prev.map(x => x.id === p.id ? p : x)); setEdit(null) }} />}
      {creating && <CreateModal years={rows.map(r => r.year)} onClose={() => setCreating(false)} onCreated={p => { setRows(prev => [p, ...prev].sort((a, b) => b.year - a.year)); setCreating(false) }} />}
    </div>
  )
}

const Dt = ({ k, v }: { k: string; v: string }) => (
  <><span className="text-gray-500">{k}</span><span className="text-gray-800 text-right font-medium">{v}</span></>
)

function EditModal({ param, onClose, onSaved }: { param: PayrollParameters; onClose: () => void; onSaved: (p: PayrollParameters) => void }) {
  const supabase = createClient()
  const { toast } = useUI()
  const [form, setForm] = useState({
    smmlv: String(param.smmlv), transport_allowance: String(param.transport_allowance),
    exoneration_eligible: param.exoneration_eligible, verified_by_accountant: param.verified_by_accountant,
    is_locked: param.is_locked, notes: param.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const { data, error } = await supabase.from('payroll_parameters').update({
      smmlv: Number(form.smmlv), transport_allowance: Number(form.transport_allowance),
      exoneration_eligible: form.exoneration_eligible, verified_by_accountant: form.verified_by_accountant,
      is_locked: form.is_locked, notes: form.notes.trim() || null,
    }).eq('id', param.id).select('*').single()
    setSaving(false)
    if (error || !data) { toast('No se pudo guardar: ' + (error?.message ?? ''), 'error'); return }
    toast('Parámetros actualizados.', 'success')
    onSaved(data as PayrollParameters)
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">Parámetros {param.year}</h2><button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button></div>
        <div className="p-5 space-y-3">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">SMMLV</label><input type="number" title="SMMLV" value={form.smmlv} onChange={e => setForm(f => ({ ...f, smmlv: e.target.value }))} className={input} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Auxilio de transporte</label><input type="number" title="Auxilio de transporte" value={form.transport_allowance} onChange={e => setForm(f => ({ ...f, transport_allowance: e.target.value }))} className={input} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.exoneration_eligible} onChange={e => setForm(f => ({ ...f, exoneration_eligible: e.target.checked }))} className="rounded" /> La empresa es beneficiaria de la exoneración art. 114-1</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.verified_by_accountant} onChange={e => setForm(f => ({ ...f, verified_by_accountant: e.target.checked }))} className="rounded" /> Verificado por el contador (habilita liquidar)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_locked} onChange={e => setForm(f => ({ ...f, is_locked: e.target.checked }))} className="rounded" /> Bloquear (no editable)</label>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Notas</label><textarea title="Notas" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={input + ' resize-none'} placeholder="Observaciones del contador" /></div>
          <p className="text-xs text-gray-500">Las tasas de aportes, ARL y FSP usan los valores legales por defecto; si necesitas ajustarlas, indícalo y las exponemos aquí.</p>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button><button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button></div>
      </div>
    </div>
  )
}

function CreateModal({ years, onClose, onCreated }: { years: number[]; onClose: () => void; onCreated: (p: PayrollParameters) => void }) {
  const supabase = createClient()
  const { toast } = useUI()
  const [form, setForm] = useState({ year: '', smmlv: '', transport_allowance: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const y = Number(form.year)
    if (!y || y < 2024) { setError('Año inválido.'); return }
    if (years.includes(y)) { setError('Ese año ya existe.'); return }
    if (!Number(form.smmlv) || !Number(form.transport_allowance)) { setError('SMMLV y auxilio son obligatorios.'); return }
    setSaving(true); setError(null)
    const { data, error } = await supabase.from('payroll_parameters').insert({ year: y, smmlv: Number(form.smmlv), transport_allowance: Number(form.transport_allowance) }).select('*').single()
    setSaving(false)
    if (error || !data) { setError('No se pudo crear: ' + (error?.message ?? '')); return }
    toast('Año agregado.', 'success')
    onCreated(data as PayrollParameters)
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">Agregar año</h2><button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button></div>
        <div className="p-5 space-y-3">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Año</label><input type="number" title="Año" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="2027" className={input} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">SMMLV</label><input type="number" title="SMMLV" value={form.smmlv} onChange={e => setForm(f => ({ ...f, smmlv: e.target.value }))} className={input} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Auxilio de transporte</label><input type="number" title="Auxilio de transporte" value={form.transport_allowance} onChange={e => setForm(f => ({ ...f, transport_allowance: e.target.value }))} className={input} /></div>
          <p className="text-xs text-gray-500">Las tasas legales (aportes, ARL, FSP) se crean con los valores por defecto; ajústalas luego con el contador.</p>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button><button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Creando…' : 'Crear'}</button></div>
      </div>
    </div>
  )
}
