'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import type { Novedad, NovedadType, Cleaner } from '@/types/database'

const TYPE_LABEL: Record<string, string> = { permiso: 'Permiso', vacaciones: 'Vacaciones', incapacidad: 'Incapacidad', otro: 'Otro' }
const TYPES: NovedadType[] = ['permiso', 'vacaciones', 'incapacidad', 'otro']

const cleanerName = (n: Novedad) => (n.cleaners as { full_name?: string } | undefined)?.full_name ?? '—'
const fmtDate = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CO') : '—'

const emptyForm = { cleaner_id: '', type: 'permiso' as NovedadType, subject: '', description: '', responsible: '', start_date: new Date().toISOString().slice(0, 10), due_date: '' }

function StatusBadge({ s }: { s: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s === 'pendiente' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
      {s === 'pendiente' ? 'Pendiente' : 'Resuelta'}
    </span>
  )
}

export default function NovedadesTable({ novedades: initial, cleaners }: { novedades: Novedad[]; cleaners: Cleaner[] }) {
  const supabase = createClient()
  const router = useRouter()
  const { toast, confirm } = useUI()
  const [novedades, setNovedades] = useState(initial)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'pendiente' | 'resuelta' | 'todas'>('pendiente')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Novedad | null>(null)
  const [obs, setObs] = useState('')
  const [working, setWorking] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return novedades.filter(n => {
      if (filter !== 'todas' && n.status !== filter) return false
      if (!q) return true
      return cleanerName(n).toLowerCase().includes(q) || n.subject.toLowerCase().includes(q) || (n.cod ?? '').toLowerCase().includes(q)
    })
  }, [novedades, search, filter])

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function createNovedad() {
    if (!form.cleaner_id || !form.subject.trim()) { setError('Elige el auxiliar y escribe el asunto.'); return }
    setSaving(true); setError(null)
    const { data, error } = await supabase.from('novedades').insert({
      cleaner_id: form.cleaner_id, type: form.type, subject: form.subject.trim(),
      description: form.description || null, responsible: form.responsible || null,
      start_date: form.start_date, due_date: form.due_date || null,
    }).select('*, cleaners(full_name)').single()
    setSaving(false)
    if (error || !data) { setError(error?.message ?? 'No se pudo crear'); return }
    setNovedades(prev => [data as Novedad, ...prev])
    setShowCreate(false); setForm({ ...emptyForm })
    toast('Novedad creada.', 'success')
    router.refresh()
  }

  function openDetail(n: Novedad) { setDetail(n); setObs(n.last_observation ?? '') }

  async function saveObs() {
    if (!detail) return
    setWorking(true)
    const { data, error } = await supabase.from('novedades').update({ last_observation: obs || null }).eq('id', detail.id).select('*, cleaners(full_name)').single()
    setWorking(false)
    if (error || !data) { toast('No se pudo guardar: ' + (error?.message ?? ''), 'error'); return }
    setNovedades(prev => prev.map(n => n.id === detail.id ? data as Novedad : n))
    setDetail(data as Novedad)
    toast('Observación guardada.', 'success')
  }

  async function resolve() {
    if (!detail) return
    const ok = await confirm({ title: 'Resolver novedad', message: `¿Marcar la novedad ${detail.cod} como resuelta?`, confirmLabel: 'Resolver' })
    if (!ok) return
    setWorking(true)
    const { data, error } = await supabase.from('novedades').update({ status: 'resuelta', resolved_at: new Date().toISOString(), last_observation: obs || null }).eq('id', detail.id).select('*, cleaners(full_name)').single()
    setWorking(false)
    if (error || !data) { toast('No se pudo resolver: ' + (error?.message ?? ''), 'error'); return }
    setNovedades(prev => prev.map(n => n.id === detail.id ? data as Novedad : n))
    setDetail(null)
    toast('Novedad resuelta.', 'success')
    router.refresh()
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">🔍</span>
          <input type="text" aria-label="Buscar novedades" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por auxiliar, asunto o código…"
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <select title="Filtro" value={filter} onChange={e => setFilter(e.target.value as typeof filter)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="pendiente">Novedades pendientes</option>
          <option value="resuelta">Resueltas</option>
          <option value="todas">Todas</option>
        </select>
        <button type="button" onClick={() => { setForm({ ...emptyForm }); setError(null); setShowCreate(true) }} className="ml-auto bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition">+ Crear Novedad</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Tabla escritorio */}
        <div className="overflow-x-auto hidden md:block"><table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Fecha inicio</th>
              <th className="text-left px-4 py-3">Cód</th>
              <th className="text-left px-4 py-3">Auxiliar</th>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-left px-4 py-3">Asunto</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="text-left px-4 py-3">Responsable</th>
              <th className="text-left px-4 py-3">Fecha límite</th>
              <th className="px-4 py-3"><span className="sr-only">Ver</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="py-10 text-center text-gray-600">No hay novedades con este filtro.</td></tr>
            )}
            {filtered.map(n => (
              <tr key={n.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{fmtDate(n.start_date)}</td>
                <td className="px-4 py-3 font-mono text-xs">{n.cod}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{cleanerName(n)}</td>
                <td className="px-4 py-3 text-gray-600">{TYPE_LABEL[n.type]}</td>
                <td className="px-4 py-3 text-gray-700 max-w-[260px] truncate">{n.subject}</td>
                <td className="px-4 py-3"><StatusBadge s={n.status} /></td>
                <td className="px-4 py-3 text-gray-600">{n.responsible ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(n.due_date)}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => openDetail(n)} className="text-brand-600 hover:underline text-xs font-medium">Ver</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>

        {/* Tarjetas móvil */}
        <div className="md:hidden divide-y divide-gray-100">
          {filtered.length === 0 && <p className="py-10 text-center text-gray-600">No hay novedades con este filtro.</p>}
          {filtered.map(n => (
            <div key={n.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-gray-800">{cleanerName(n)}</span>
                <StatusBadge s={n.status} />
              </div>
              <div className="text-sm text-gray-700 mt-1">{TYPE_LABEL[n.type]} · {n.subject}</div>
              <div className="text-xs text-gray-500 mt-0.5">{n.cod} · inicio {fmtDate(n.start_date)}{n.due_date ? ` · límite ${fmtDate(n.due_date)}` : ''}</div>
              <button type="button" onClick={() => openDetail(n)} className="mt-3 w-full py-2 rounded-lg border border-brand-300 text-brand-700 font-medium hover:bg-brand-50">Ver</button>
            </div>
          ))}
        </div>
      </div>

      {/* Crear novedad */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md md:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">Crear novedad</h2>
              <button type="button" onClick={() => setShowCreate(false)} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Auxiliar</label>
                <select title="Auxiliar" value={form.cleaner_id} onChange={e => set('cleaner_id', e.target.value)} className="w-full border border-gray-400 rounded-lg px-3 py-2 text-sm">
                  <option value="">Elige un auxiliar…</option>
                  {cleaners.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select title="Tipo" value={form.type} onChange={e => set('type', e.target.value)} className="w-full border border-gray-400 rounded-lg px-3 py-2 text-sm">
                  {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                <input type="text" value={form.responsible} onChange={e => set('responsible', e.target.value)} placeholder="Quién gestiona" className="w-full border border-gray-400 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
                <input type="text" value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Ej: Solicita permiso para cita médica" className="w-full border border-gray-400 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea title="Descripción" value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="Detalle de la novedad…" className="w-full border border-gray-400 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                <input type="date" title="Fecha inicio" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="w-full border border-gray-400 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha límite</label>
                <input type="date" title="Fecha límite" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="w-full border border-gray-400 rounded-lg px-3 py-2 text-sm" />
              </div>
              {error && <div className="md:col-span-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={createNovedad} disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Creando…' : 'Crear novedad'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Ver / resolver */}
      {detail && (
        <div onClick={() => setDetail(null)} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md md:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-semibold">{detail.cod}</h2>
                <div className="text-sm text-gray-600">{cleanerName(detail)} · {TYPE_LABEL[detail.type]}</div>
              </div>
              <button type="button" onClick={() => setDetail(null)} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex items-center gap-2"><StatusBadge s={detail.status} /><span className="text-gray-500">inicio {fmtDate(detail.start_date)}{detail.due_date ? ` · límite ${fmtDate(detail.due_date)}` : ''}</span></div>
              <div><span className="text-gray-500">Asunto:</span> <span className="text-gray-800">{detail.subject}</span></div>
              {detail.description && <div><span className="text-gray-500">Descripción:</span> <span className="text-gray-800 whitespace-pre-wrap">{detail.description}</span></div>}
              <div><span className="text-gray-500">Responsable:</span> {detail.responsible ?? '—'}</div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Última observación</label>
                <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} className="w-full border border-gray-400 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Agrega una observación…" />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3 p-5 border-t">
              <button type="button" onClick={saveObs} disabled={working} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50">Guardar observación</button>
              {detail.status === 'pendiente' && (
                <button type="button" onClick={resolve} disabled={working} className="px-4 py-2 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">Marcar resuelta</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
