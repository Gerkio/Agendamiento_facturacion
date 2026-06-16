'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { fmtDate } from '@/lib/format'
import { buildCsv, downloadCsv } from '@/lib/csv'
import { bogotaToday } from '@/lib/dates'
import { addBusinessDays, businessDaysBetween } from '@/lib/business-days'
import {
  PQR_TIPOS, pqrTipoLabel, PQR_CANALES, PQR_ESTADOS, pqrEstadoLabel, pqrEstadoCls,
  PQR_SLA_DIAS_DEFAULT, PQR_EVENT_LABEL,
} from '@/lib/pqr'
import type { Pqr, PqrEvent } from '@/types/database'

interface Props {
  initialPqr: Pqr[]
  clients: { id: string; company_name: string }[]
  currentUserEmail: string
}

type StatusFilter = 'all' | 'radicada' | 'en_tramite' | 'respondida' | 'cerrada' | 'desistida'
const CLOSED = ['respondida', 'cerrada', 'desistida']

const nameOf = (p: Pqr) => p.clients?.company_name ?? p.petitioner_name ?? '—'

/** Semáforo de SLA: días hábiles restantes vs. vencido. Null si ya está cerrado. */
function slaInfo(p: Pqr): { text: string; cls: string } | null {
  if (CLOSED.includes(p.status) || !p.due_date) return null
  const today = bogotaToday()
  if (today > p.due_date) return { text: `Vencida (${businessDaysBetween(p.due_date, today)} d háb.)`, cls: 'bg-red-100 text-red-700' }
  const d = businessDaysBetween(today, p.due_date)
  return { text: `${d} d háb.`, cls: d <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700' }
}

export default function PqrTable({ initialPqr, clients, currentUserEmail }: Props) {
  const [rows, setRows] = useState<Pqr[]>(initialPqr)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [tipo, setTipo] = useState('')
  const [search, setSearch] = useState('')
  const [soloVencidas, setSoloVencidas] = useState(false)
  const [radicar, setRadicar] = useState(false)
  const [detail, setDetail] = useState<Pqr | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const today = bogotaToday()
    return rows.filter(p => {
      if (status !== 'all' && p.status !== status) return false
      if (tipo && p.tipo !== tipo) return false
      if (soloVencidas && !(!CLOSED.includes(p.status) && p.due_date && today > p.due_date)) return false
      if (q) {
        const hay = `${p.radicado ?? ''} ${p.subject} ${nameOf(p)} ${pqrTipoLabel(p.tipo)}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, status, tipo, search, soloVencidas])

  function upsertRow(p: Pqr) {
    setRows(prev => {
      const without = prev.filter(x => x.id !== p.id)
      return [p, ...without].sort((a, b) => (a.received_at < b.received_at ? 1 : -1))
    })
  }

  function exportCsv() {
    const headers = ['Radicado', 'Fecha', 'Tipo', 'Solicitante', 'Asunto', 'Estado', 'Vence']
    const data = filtered.map(p => [
      p.radicado ?? '', fmtDate(p.received_at), pqrTipoLabel(p.tipo), nameOf(p), p.subject, pqrEstadoLabel(p.status), p.due_date ? fmtDate(p.due_date) : '',
    ])
    downloadCsv(`pqr-${bogotaToday()}`, buildCsv(headers, data))
  }

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <select title="Estado" value={status} onChange={e => setStatus(e.target.value as StatusFilter)} className={inputCls}>
          <option value="all">Todos los estados</option>
          {Object.entries(PQR_ESTADOS).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}
        </select>
        <select title="Tipo" value={tipo} onChange={e => setTipo(e.target.value)} className={inputCls}>
          <option value="">Todos los tipos</option>
          {PQR_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar radicado, asunto, cliente…" className={`${inputCls} flex-1 min-w-[160px]`} />
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={soloVencidas} onChange={e => setSoloVencidas(e.target.checked)} className="rounded" /> Solo vencidas
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={exportCsv} disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <span aria-hidden="true">⬇️</span> CSV
          </button>
          <button type="button" onClick={() => setRadicar(true)} className="text-sm px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700">+ Radicar PQR</button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[760px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
            <th className="text-left px-4 py-3">Radicado</th>
            <th className="text-left px-4 py-3">Tipo</th>
            <th className="text-left px-4 py-3">Solicitante / Asunto</th>
            <th className="text-left px-4 py-3">Estado</th>
            <th className="text-left px-4 py-3">SLA</th>
            <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-500">Sin PQR para los filtros seleccionados.</td></tr>}
            {filtered.map(p => {
              const sla = slaInfo(p)
              return (
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetail(p)}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{p.radicado ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{pqrTipoLabel(p.tipo)}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800">{nameOf(p)}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[280px]">{p.subject}</div>
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pqrEstadoCls(p.status)}`}>{pqrEstadoLabel(p.status)}</span></td>
                  <td className="px-4 py-3">{sla ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sla.cls}`}>{sla.text}</span> : <span className="text-xs text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-right"><button type="button" onClick={e => { e.stopPropagation(); setDetail(p) }} className="text-brand-600 hover:underline text-xs font-medium">Ver</button></td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      </div>

      {radicar && (
        <RadicarModal clients={clients} currentUserEmail={currentUserEmail} onClose={() => setRadicar(false)} onCreated={p => { upsertRow(p); setRadicar(false) }} />
      )}
      {detail && (
        <DetailModal pqr={detail} currentUserEmail={currentUserEmail} onClose={() => setDetail(null)} onChanged={p => { upsertRow(p); setDetail(p) }} />
      )}
    </div>
  )
}

function RadicarModal({ clients, currentUserEmail, onClose, onCreated }: {
  clients: { id: string; company_name: string }[]
  currentUserEmail: string
  onClose: () => void
  onCreated: (p: Pqr) => void
}) {
  const supabase = createClient()
  const { toast } = useUI()
  const [form, setForm] = useState({
    tipo: PQR_TIPOS[0].value, canal: PQR_CANALES[0], client_id: '',
    petitioner_name: '', petitioner_contact: '', subject: '', description: '',
    priority: 'normal', sla: String(PQR_SLA_DIAS_DEFAULT),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.subject.trim()) { setError('El asunto es obligatorio.'); return }
    const sla = Math.max(1, Number(form.sla) || PQR_SLA_DIAS_DEFAULT)
    setSaving(true); setError(null)
    const due = addBusinessDays(bogotaToday(), sla)
    const { data, error } = await supabase.from('pqr').insert({
      tipo: form.tipo, canal: form.canal,
      client_id: form.client_id || null,
      petitioner_name: form.client_id ? null : (form.petitioner_name.trim() || null),
      petitioner_contact: form.client_id ? null : (form.petitioner_contact.trim() || null),
      subject: form.subject.trim(), description: form.description.trim() || null,
      priority: form.priority, due_date: due,
    }).select('*, clients(company_name)').single()
    if (error || !data) { setSaving(false); setError('No se pudo radicar: ' + (error?.message ?? '')); return }
    const { data: ev } = await supabase.from('pqr_events').insert({ pqr_id: data.id, action: 'radicada', actor_email: currentUserEmail }).select().single()
    setSaving(false)
    toast(`PQR radicada: ${data.radicado}`, 'success')
    onCreated({ ...(data as Pqr), pqr_events: ev ? [ev as PqrEvent] : [] })
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">Radicar PQR</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select title="Tipo" value={form.tipo} onChange={e => set('tipo', e.target.value)} className={input}>
              {PQR_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Canal</label>
            <select title="Canal" value={form.canal} onChange={e => set('canal', e.target.value)} className={input}>
              {PQR_CANALES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
            <select title="Cliente" value={form.client_id} onChange={e => set('client_id', e.target.value)} className={input}>
              <option value="">— No es cliente / anónimo —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
          {!form.client_id && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del solicitante</label>
                <input type="text" title="Nombre del solicitante" value={form.petitioner_name} onChange={e => set('petitioner_name', e.target.value)} placeholder="Quién radica" className={input} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contacto (tel./correo)</label>
                <input type="text" title="Contacto del solicitante" value={form.petitioner_contact} onChange={e => set('petitioner_contact', e.target.value)} placeholder="Teléfono o correo" className={input} />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Asunto</label>
            <input type="text" value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Resumen del caso" className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className={input + ' resize-none'} placeholder="Detalle de la petición/queja/reclamo" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Prioridad</label>
            <select title="Prioridad" value={form.priority} onChange={e => set('priority', e.target.value)} className={input}>
              <option value="normal">Normal</option>
              <option value="prioritaria">Prioritaria</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Días hábiles para responder</label>
            <input type="number" title="Días hábiles para responder" inputMode="numeric" min={1} value={form.sla} onChange={e => set('sla', e.target.value)} className={input} />
          </div>
          {error && <div className="sm:col-span-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Radicando…' : 'Radicar'}</button>
        </div>
      </div>
    </div>
  )
}

function DetailModal({ pqr, currentUserEmail, onClose, onChanged }: {
  pqr: Pqr
  currentUserEmail: string
  onClose: () => void
  onChanged: (p: Pqr) => void
}) {
  const supabase = createClient()
  const { toast } = useUI()
  const [busy, setBusy] = useState(false)
  const [responsible, setResponsible] = useState(pqr.responsible ?? '')
  const [respMode, setRespMode] = useState(false)
  const [respText, setRespText] = useState('')
  const [note, setNote] = useState('')

  const sla = slaInfo(pqr)
  const events = [...(pqr.pqr_events ?? [])].sort((a, b) => (a.created_at < b.created_at ? -1 : 1))

  async function apply(updates: Partial<Pqr>, action: string, noteText?: string) {
    setBusy(true)
    // Una nota no cambia campos de la PQR: solo registra un evento (sin update vacío).
    let base: Pqr = pqr
    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabase.from('pqr').update(updates).eq('id', pqr.id).select('*, clients(company_name)').single()
      if (error || !data) { setBusy(false); toast('No se pudo actualizar: ' + (error?.message ?? ''), 'error'); return }
      base = data as Pqr
    }
    const { data: ev } = await supabase.from('pqr_events').insert({ pqr_id: pqr.id, action, note: noteText ?? null, actor_email: currentUserEmail }).select().single()
    setBusy(false)
    const updated: Pqr = { ...base, pqr_events: [...(pqr.pqr_events ?? []), ...(ev ? [ev as PqrEvent] : [])] }
    onChanged(updated)
    toast('PQR actualizada.', 'success')
  }

  const nowIso = () => new Date().toISOString()

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="font-mono text-sm text-gray-500">{pqr.radicado}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pqrEstadoCls(pqr.status)}`}>{pqrEstadoLabel(pqr.status)}</span>
              {sla && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sla.cls}`}>{sla.text}</span>}
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">{pqrTipoLabel(pqr.tipo)} · {nameOf(pqr)}{pqr.canal ? ` · ${pqr.canal}` : ''}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">{pqr.subject}</p>
            {pqr.description && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{pqr.description}</p>}
            <p className="text-xs text-gray-500 mt-1">Radicada {fmtDate(pqr.received_at)}{pqr.due_date ? ` · vence ${fmtDate(pqr.due_date)}` : ''}</p>
            {pqr.petitioner_contact && <p className="text-xs text-gray-500">Contacto: {pqr.petitioner_contact}</p>}
          </div>

          {/* Responsable */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Responsable</label>
              <input type="text" value={responsible} onChange={e => setResponsible(e.target.value)} placeholder="Quién gestiona" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <button type="button" disabled={busy || !responsible.trim()} onClick={() => apply({ responsible: responsible.trim() }, 'asignada', responsible.trim())}
              className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">Asignar</button>
          </div>

          {/* Respuesta existente */}
          {pqr.response_text && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-green-700">Respuesta ({pqr.responded_at ? fmtDate(pqr.responded_at) : '—'})</p>
              <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{pqr.response_text}</p>
            </div>
          )}

          {/* Acciones */}
          {!CLOSED.includes(pqr.status) && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {pqr.status === 'radicada' && (
                  <button type="button" disabled={busy} onClick={() => apply({ status: 'en_tramite' }, 'en_tramite')} className="text-sm px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">Iniciar trámite</button>
                )}
                <button type="button" disabled={busy} onClick={() => setRespMode(v => !v)} className="text-sm px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">Responder</button>
                <button type="button" disabled={busy} onClick={() => apply({ status: 'cerrada', closed_at: nowIso() }, 'cerrada')} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cerrar</button>
                <button type="button" disabled={busy} onClick={() => apply({ status: 'desistida', closed_at: nowIso() }, 'desistida')} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">Desistir</button>
              </div>
              {respMode && (
                <div className="space-y-2">
                  <textarea value={respText} onChange={e => setRespText(e.target.value)} rows={3} placeholder="Texto de la respuesta al solicitante" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
                  <button type="button" disabled={busy || !respText.trim()} onClick={() => apply({ status: 'respondida', response_text: respText.trim(), responded_at: nowIso() }, 'respondida', respText.trim())}
                    className="text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">Enviar respuesta</button>
                </div>
              )}
            </div>
          )}

          {/* Nota libre */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Agregar nota</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Observación interna" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <button type="button" disabled={busy || !note.trim()} onClick={() => { apply({}, 'nota', note.trim()); setNote('') }}
              className="px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">Agregar</button>
          </div>

          {/* Bitácora */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">Bitácora</p>
            <ul className="space-y-1.5">
              {events.length === 0 && <li className="text-sm text-gray-400">Sin actuaciones.</li>}
              {events.map(ev => (
                <li key={ev.id} className="text-sm flex gap-2">
                  <span className="text-gray-400 text-xs whitespace-nowrap mt-0.5">{new Date(ev.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span className="text-gray-700"><strong>{PQR_EVENT_LABEL[ev.action] ?? ev.action}</strong>{ev.note ? `: ${ev.note}` : ''}{ev.actor_email ? ` · ${ev.actor_email}` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
