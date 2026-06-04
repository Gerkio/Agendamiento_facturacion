'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP } from '@/lib/format'
import { SEGMENTS, TIPOS, segmentLabel, tipoLabel, scheduleLabel, formatDuration } from '@/lib/service-catalog'
import type { ServiceCatalog, ServiceSegment, ServiceTipo } from '@/types/database'

const input = 'w-full border border-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

const emptyForm = {
  name: '', segment: 'hogar' as ServiceSegment, tipo: 'dia_completo' as ServiceTipo,
  start_time: '08:00', duration_minutes: '450', price_cop: '', bono_cop: '0', is_active: true,
}

export default function ServiceCatalogTable({ items: initial }: { items: ServiceCatalog[] }) {
  const supabase = createClient()
  const { toast, confirm } = useUI()
  const [items, setItems] = useState(initial)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ServiceCatalog | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(s =>
      s.name.toLowerCase().includes(q) ||
      segmentLabel(s.segment).toLowerCase().includes(q) ||
      tipoLabel(s.tipo).toLowerCase().includes(q)
    )
  }, [items, search])

  const f = (k: keyof typeof form, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))

  function openNew() { setEditing(null); setForm({ ...emptyForm }); setError(null); setShowModal(true) }
  function openEdit(s: ServiceCatalog) {
    setEditing(s)
    setForm({
      name: s.name, segment: s.segment, tipo: s.tipo, start_time: s.start_time.slice(0, 5),
      duration_minutes: String(s.duration_minutes), price_cop: String(s.price_cop),
      bono_cop: String(s.bono_cop), is_active: s.is_active,
    })
    setError(null); setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('El nombre es obligatorio.'); return }
    const dur = parseInt(form.duration_minutes, 10)
    if (!dur || dur <= 0) { setError('La duración debe ser mayor a 0 minutos.'); return }
    setSaving(true); setError(null)
    const payload = {
      name: form.name.trim(), segment: form.segment, tipo: form.tipo,
      start_time: form.start_time, duration_minutes: dur,
      price_cop: parseFloat(form.price_cop) || 0, bono_cop: parseFloat(form.bono_cop) || 0,
      is_active: form.is_active,
    }
    if (editing) {
      const { data, error } = await supabase.from('service_catalog').update(payload).eq('id', editing.id).select().single()
      setSaving(false)
      if (error || !data) { setError(error?.message ?? 'No se pudo guardar'); return }
      setItems(prev => prev.map(s => s.id === editing.id ? (data as ServiceCatalog) : s))
    } else {
      const { data, error } = await supabase.from('service_catalog').insert(payload).select().single()
      setSaving(false)
      if (error || !data) { setError(error?.message ?? 'No se pudo crear'); return }
      setItems(prev => [...prev, data as ServiceCatalog])
    }
    setShowModal(false)
    toast('Servicio guardado.', 'success')
  }

  async function toggleActive(s: ServiceCatalog) {
    setWorking(s.id)
    const { error } = await supabase.from('service_catalog').update({ is_active: !s.is_active }).eq('id', s.id)
    setWorking(null)
    if (error) { toast('No se pudo actualizar: ' + error.message, 'error'); return }
    setItems(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !x.is_active } : x))
  }

  async function handleDelete(s: ServiceCatalog) {
    const ok = await confirm({ title: 'Eliminar servicio', message: `¿Eliminar "${s.name}" del catálogo? Los servicios ya agendados no se borran, solo pierden la referencia.`, confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    setWorking(s.id)
    const { error } = await supabase.from('service_catalog').delete().eq('id', s.id)
    setWorking(null)
    if (error) { toast('No se pudo eliminar: ' + error.message, 'error'); return }
    setItems(prev => prev.filter(x => x.id !== s.id))
    toast('Servicio eliminado.', 'success')
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button type="button" onClick={openNew} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition">+ Nuevo Servicio</button>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">🔍</span>
          <input type="text" aria-label="Filtrar servicios" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar por nombre, grupo o tipo…"
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <span className="text-sm text-gray-500">{filtered.length} servicio(s)</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Tabla escritorio */}
        <div className="overflow-x-auto hidden md:block"><table className="w-full text-sm min-w-[820px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Nombre</th>
              <th className="text-left px-4 py-3">Grupo</th>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-right px-4 py-3">Precio</th>
              <th className="text-left px-4 py-3">Horario</th>
              <th className="text-right px-4 py-3">Bono</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="px-4 py-3"><span className="sr-only">Acción</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="py-10 text-center text-gray-600">No hay servicios con este filtro.</td></tr>
            )}
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                <td className="px-4 py-3 text-gray-600">{segmentLabel(s.segment)}</td>
                <td className="px-4 py-3 text-gray-600">{tipoLabel(s.tipo)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">{formatCOP(Number(s.price_cop))}</td>
                <td className="px-4 py-3 text-gray-600">{scheduleLabel(s.start_time, s.duration_minutes)}<span className="text-gray-400"> · {formatDuration(s.duration_minutes)}</span></td>
                <td className="px-4 py-3 text-right text-gray-600">{Number(s.bono_cop) > 0 ? formatCOP(Number(s.bono_cop)) : '—'}</td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => toggleActive(s)} disabled={working === s.id}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.is_active ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button type="button" onClick={() => openEdit(s)} className="text-brand-600 hover:underline text-xs font-medium">✏️ Editar</button>
                  <button type="button" onClick={() => handleDelete(s)} disabled={working === s.id} className="ml-3 text-red-500 hover:underline text-xs disabled:opacity-50">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>

        {/* Tarjetas móvil */}
        <div className="md:hidden divide-y divide-gray-100">
          {filtered.length === 0 && <p className="py-10 text-center text-gray-600">No hay servicios con este filtro.</p>}
          {filtered.map(s => (
            <div key={s.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-gray-800">{s.name}</span>
                <span className="font-medium text-gray-800 whitespace-nowrap">{formatCOP(Number(s.price_cop))}</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">{segmentLabel(s.segment)} · {tipoLabel(s.tipo)}</div>
              <div className="text-xs text-gray-500 mt-0.5">{scheduleLabel(s.start_time, s.duration_minutes)} · {formatDuration(s.duration_minutes)}{Number(s.bono_cop) > 0 ? ` · bono ${formatCOP(Number(s.bono_cop))}` : ''}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => openEdit(s)} className="flex-1 min-w-[90px] py-2 rounded-lg border border-brand-300 text-brand-700 font-medium hover:bg-brand-50">✏️ Editar</button>
                <button type="button" onClick={() => toggleActive(s)} disabled={working === s.id} className="flex-1 min-w-[90px] py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">{s.is_active ? 'Desactivar' : 'Activar'}</button>
                <button type="button" onClick={() => handleDelete(s)} disabled={working === s.id} className="flex-1 min-w-[90px] py-2 rounded-lg border border-red-300 text-red-600 font-medium hover:bg-red-50 disabled:opacity-50">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Crear / editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md md:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">{editing ? 'Editar servicio' : 'Nuevo servicio'}</h2>
              <button type="button" onClick={() => setShowModal(false)} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Ej: Esporádico (8 horas)" className={input} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grupo</label>
                <select title="Grupo" value={form.segment} onChange={e => f('segment', e.target.value)} className={input}>
                  {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo (jornada)</label>
                <select title="Tipo" value={form.tipo} onChange={e => f('tipo', e.target.value)} className={input}>
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora de inicio</label>
                <input type="time" title="Hora de inicio" value={form.start_time} onChange={e => f('start_time', e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duración (minutos)</label>
                <input type="number" inputMode="numeric" min={1} value={form.duration_minutes} onChange={e => f('duration_minutes', e.target.value)} className={input} placeholder="450" />
                <p className="text-xs text-gray-500 mt-1">Horario: <strong>{scheduleLabel(form.start_time, parseInt(form.duration_minutes, 10) || 0)}</strong> ({formatDuration(parseInt(form.duration_minutes, 10) || 0)})</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio (COP)</label>
                <input type="number" inputMode="numeric" min={0} value={form.price_cop} onChange={e => f('price_cop', e.target.value)} className={input} placeholder="150000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bono (COP)</label>
                <input type="number" inputMode="numeric" min={0} value={form.bono_cop} onChange={e => f('bono_cop', e.target.value)} className={input} placeholder="0" />
              </div>
              <label className="md:col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={e => f('is_active', e.target.checked)} className="rounded" /> Activo (disponible para agendar)
              </label>
              {error && <div className="md:col-span-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
