'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP, fmtDate } from '@/lib/format'
import {
  PETICION_TYPES, peticionTypeLabel, PETICION_STATUS, peticionStatusLabel, peticionStatusCls,
} from '@/lib/peticiones'
import type { Peticion } from '@/types/database'

interface Props {
  initialPeticiones: Peticion[]
  /** Auxiliares activos (para que el admin radique a nombre de alguien). */
  cleaners: { id: string; full_name: string }[]
  isAdmin: boolean
  /** cleaner_id del usuario actual (cuando es auxiliar). */
  cleanerId: string | null
}

const nameOf = (p: Peticion) => p.cleaners?.full_name ?? '—'

/** Peticiones: bandeja interna del personal. El admin gestiona (aprobar/rechazar/
 *  resolver) todas; el auxiliar radica y consulta solo las suyas (RLS). */
export default function PeticionesView({ initialPeticiones, cleaners, isAdmin, cleanerId }: Props) {
  const [rows, setRows] = useState<Peticion[]>(initialPeticiones)
  const [status, setStatus] = useState<'all' | 'pendiente' | 'aprobada' | 'rechazada' | 'resuelta'>('all')
  const [search, setSearch] = useState('')
  const [nueva, setNueva] = useState(false)
  const [detail, setDetail] = useState<Peticion | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(p => {
      if (status !== 'all' && p.status !== status) return false
      if (q) {
        const hay = `${p.cod ?? ''} ${nameOf(p)} ${p.subject} ${peticionTypeLabel(p.type)}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, status, search])

  const upsert = (p: Peticion) => setRows(prev => {
    const without = prev.filter(x => x.id !== p.id)
    return [p, ...without].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  })

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <select title="Estado" value={status} onChange={e => setStatus(e.target.value as typeof status)} className={inputCls}>
          <option value="all">Todos los estados</option>
          {Object.entries(PETICION_STATUS).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}
        </select>
        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar código, auxiliar, asunto…" className={`${inputCls} flex-1 min-w-[160px]`} />
        <button type="button" onClick={() => setNueva(true)} className="ml-auto text-sm px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700">+ Nueva petición</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
            <th className="text-left px-4 py-3">Código</th>
            {isAdmin && <th className="text-left px-4 py-3">Auxiliar</th>}
            <th className="text-left px-4 py-3">Tipo</th>
            <th className="text-left px-4 py-3">Asunto</th>
            <th className="text-right px-4 py-3">Monto</th>
            <th className="text-left px-4 py-3">Estado</th>
            <th className="px-4 py-3"><span className="sr-only">Ver</span></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && <tr><td colSpan={isAdmin ? 7 : 6} className="py-10 text-center text-gray-500">Sin peticiones.</td></tr>}
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetail(p)}>
                <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{p.cod ?? '—'}</td>
                {isAdmin && <td className="px-4 py-3 text-gray-700">{nameOf(p)}</td>}
                <td className="px-4 py-3 text-gray-700">{peticionTypeLabel(p.type)}</td>
                <td className="px-4 py-3 text-gray-600 truncate max-w-[240px]">{p.subject}</td>
                <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{p.amount_cop ? formatCOP(Number(p.amount_cop)) : '—'}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${peticionStatusCls(p.status)}`}>{peticionStatusLabel(p.status)}</span></td>
                <td className="px-4 py-3 text-right"><button type="button" onClick={e => { e.stopPropagation(); setDetail(p) }} className="text-brand-600 hover:underline text-xs font-medium">Ver</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {nueva && (
        <NuevaModal isAdmin={isAdmin} cleaners={cleaners} cleanerId={cleanerId} onClose={() => setNueva(false)} onCreated={p => { upsert(p); setNueva(false) }} />
      )}
      {detail && (
        <DetailModal peticion={detail} isAdmin={isAdmin} onClose={() => setDetail(null)} onChanged={p => { upsert(p); setDetail(p) }} />
      )}
    </div>
  )
}

function NuevaModal({ isAdmin, cleaners, cleanerId, onClose, onCreated }: {
  isAdmin: boolean
  cleaners: { id: string; full_name: string }[]
  cleanerId: string | null
  onClose: () => void
  onCreated: (p: Peticion) => void
}) {
  const supabase = createClient()
  const { toast } = useUI()
  const [form, setForm] = useState({
    cleaner_id: isAdmin ? (cleaners[0]?.id ?? '') : (cleanerId ?? ''),
    type: PETICION_TYPES[0].value, subject: '', description: '', amount: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))
  const isAnticipo = form.type === 'anticipo'

  async function save() {
    if (!form.cleaner_id) { setError('Falta el auxiliar.'); return }
    if (!form.subject.trim()) { setError('El asunto es obligatorio.'); return }
    setSaving(true); setError(null)
    const { data, error } = await supabase.from('peticiones').insert({
      cleaner_id: form.cleaner_id,
      type: form.type,
      subject: form.subject.trim(),
      description: form.description.trim() || null,
      amount_cop: isAnticipo && form.amount ? Number(form.amount) : null,
    }).select('*, cleaners(full_name)').single()
    setSaving(false)
    if (error || !data) { setError('No se pudo crear: ' + (error?.message ?? '')); return }
    toast(`Petición radicada: ${data.cod}`, 'success')
    onCreated(data as Peticion)
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">Nueva petición</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-3">
          {isAdmin && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Auxiliar</label>
              <select title="Auxiliar" value={form.cleaner_id} onChange={e => set('cleaner_id', e.target.value)} className={input}>
                {cleaners.length === 0 && <option value="">— Sin auxiliares activos —</option>}
                {cleaners.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select title="Tipo" value={form.type} onChange={e => set('type', e.target.value)} className={input}>
              {PETICION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Asunto</label>
            <input type="text" value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Resumen" className={input} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className={input + ' resize-none'} placeholder="Detalle de la solicitud" />
          </div>
          {isAnticipo && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Monto del anticipo (COP)</label>
              <input type="number" title="Monto del anticipo" inputMode="numeric" min={0} value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" className={input} />
            </div>
          )}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Radicando…' : 'Radicar'}</button>
        </div>
      </div>
    </div>
  )
}

function DetailModal({ peticion, isAdmin, onClose, onChanged }: {
  peticion: Peticion
  isAdmin: boolean
  onClose: () => void
  onChanged: (p: Peticion) => void
}) {
  const supabase = createClient()
  const { toast } = useUI()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(peticion.resolution_note ?? '')
  const decided = peticion.status !== 'pendiente'

  async function decide(next: 'aprobada' | 'rechazada' | 'resuelta') {
    setBusy(true)
    const { data, error } = await supabase.from('peticiones').update({
      status: next, resolution_note: note.trim() || null, decided_at: new Date().toISOString(),
    }).eq('id', peticion.id).select('*, cleaners(full_name)').single()
    setBusy(false)
    if (error || !data) { toast('No se pudo actualizar: ' + (error?.message ?? ''), 'error'); return }
    onChanged(data as Peticion)
    toast('Petición actualizada.', 'success')
  }

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="font-mono text-sm text-gray-500">{peticion.cod}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${peticionStatusCls(peticion.status)}`}>{peticionStatusLabel(peticion.status)}</span>
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <p><span className="text-gray-500">Auxiliar:</span> {nameOf(peticion)}</p>
          <p><span className="text-gray-500">Tipo:</span> {peticionTypeLabel(peticion.type)}</p>
          <p><span className="text-gray-500">Asunto:</span> {peticion.subject}</p>
          {peticion.description && <p className="text-gray-600 whitespace-pre-wrap">{peticion.description}</p>}
          {peticion.amount_cop ? <p><span className="text-gray-500">Monto:</span> <strong>{formatCOP(Number(peticion.amount_cop))}</strong></p> : null}
          <p className="text-xs text-gray-400">Radicada {fmtDate(peticion.created_at)}{peticion.decided_at ? ` · decidida ${fmtDate(peticion.decided_at)}` : ''}</p>

          {isAdmin ? (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <label className="block text-xs font-medium text-gray-600">Nota de resolución</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" placeholder="Motivo o detalle de la decisión" />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => decide('aprobada')} className="text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">Aprobar</button>
                <button type="button" disabled={busy} onClick={() => decide('rechazada')} className="text-sm px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">Rechazar</button>
                <button type="button" disabled={busy} onClick={() => decide('resuelta')} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">Marcar resuelta</button>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-100 pt-3">
              {decided && peticion.resolution_note && <p className="text-gray-700"><span className="text-gray-500">Respuesta:</span> {peticion.resolution_note}</p>}
              {!decided && <p className="text-gray-500 italic">En espera de revisión por administración.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
