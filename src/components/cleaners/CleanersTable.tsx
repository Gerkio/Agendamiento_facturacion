'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import CleanerHojaDeVida from '@/components/cleaners/CleanerHojaDeVida'
import Avatar from '@/components/ui/Avatar'
import MapEmbed from '@/components/map/MapEmbed'
import { fullAddress } from '@/lib/maps'
import type { Cleaner } from '@/types/database'

const emptyForm = {
  full_name: '', document_id: '', phone: '', is_active: true,
  emergency_phone: '', emergency_contact_name: '', birth_date: '', address: '', eps: '', arl: '', hire_date: '',
}
const inputCls = 'w-full border border-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

export default function CleanersTable({ cleaners: initial, photoUrls = {} }: { cleaners: Cleaner[]; photoUrls?: Record<string, string> }) {
  const supabase = createClient()
  const { confirm, toast } = useUI()
  const [cleaners, setCleaners] = useState(initial)
  const [photoMap, setPhotoMap] = useState<Record<string, string>>(photoUrls)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Cleaner | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetting, setResetting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [view, setView] = useState<'resumida' | 'detallada'>('resumida')
  const [hoja, setHoja] = useState<Cleaner | null>(null)
  const [mapQuery, setMapQuery] = useState('')

  const total = cleaners.length
  const activos = useMemo(() => cleaners.filter(c => c.is_active).length, [cleaners])
  const inactivos = total - activos
  const pct = (n: number) => total ? ((n / total) * 100).toFixed(2) : '0.00'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cleaners.filter(c => {
      if (!showInactive && !c.is_active) return false
      if (!q) return true
      return c.full_name.toLowerCase().includes(q) || c.document_id.includes(q) || (c.phone ?? '').includes(q)
    })
  }, [cleaners, search, showInactive])

  function openNew() { setEditing(null); setForm({ ...emptyForm }); setPhotoFile(null); setError(null); setMapQuery(''); setShowModal(true) }
  function openEdit(c: Cleaner) {
    setEditing(c)
    setMapQuery('')
    setForm({
      full_name: c.full_name, document_id: c.document_id, phone: c.phone ?? '', is_active: c.is_active,
      emergency_phone: c.emergency_phone ?? '', emergency_contact_name: c.emergency_contact_name ?? '',
      birth_date: c.birth_date ?? '', address: c.address ?? '', eps: c.eps ?? '', arl: c.arl ?? '', hire_date: c.hire_date ?? '',
    })
    setPhotoFile(null); setError(null); setShowModal(true)
  }

  const hojaFields = () => ({
    emergency_phone: form.emergency_phone || null, emergency_contact_name: form.emergency_contact_name || null,
    birth_date: form.birth_date || null, address: form.address || null,
    eps: form.eps || null, arl: form.arl || null, hire_date: form.hire_date || null,
  })

  async function uploadPhoto(id: string) {
    if (!photoFile) return
    const fd = new FormData(); fd.append('photo', photoFile)
    const res = await fetch(`/api/cleaners/${id}/photo`, { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok && data.signedUrl) {
      setPhotoMap(prev => ({ ...prev, [id]: data.signedUrl }))
      setCleaners(prev => prev.map(c => c.id === id ? { ...c, photo_url: data.path } : c))
    } else {
      toast('La foto no se subió: ' + (data.error ?? 'error'), 'error')
    }
  }

  async function handleSave() {
    setLoading(true); setError(null)
    if (editing) {
      const payload = { full_name: form.full_name, phone: form.phone || null, is_active: form.is_active, ...hojaFields() }
      const { data, error } = await supabase.from('cleaners').update(payload).eq('id', editing.id).select().single()
      if (error) { setError(error.message); setLoading(false); return }
      await uploadPhoto(editing.id)
      setCleaners(prev => prev.map(c => (c.id === editing.id ? { ...data } : c)))
      setShowModal(false); setLoading(false)
    } else {
      const res = await fetch('/api/cleaners/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: form.full_name, document_id: form.document_id, phone: form.phone || null, is_active: form.is_active }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudo crear'); setLoading(false); return }
      const extra = hojaFields()
      await supabase.from('cleaners').update(extra).eq('id', data.cleaner.id)
      await uploadPhoto(data.cleaner.id)
      setCleaners(prev => [...prev, { ...data.cleaner, ...extra }])
      setShowModal(false); setLoading(false)
      setNotice(`Auxiliar creado. Usuario: ${data.username} · contraseña temporal: ${data.tempPassword} (entrégasela; deberá cambiarla al ingresar).`)
    }
  }

  async function handleToggle(c: Cleaner) {
    const next = !c.is_active
    // Vía ruta server: además de la ficha, bloquea/restablece su acceso (auth).
    const res = await fetch(`/api/cleaners/${c.id}/active`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: next }),
    })
    const data = await res.json()
    if (!res.ok) { toast('No se pudo cambiar el estado: ' + (data.error ?? 'desconocido'), 'error'); return }
    setCleaners(prev => prev.map(x => (x.id === c.id ? { ...x, is_active: next } : x)))
    toast(next ? `${c.full_name} activado.` : `${c.full_name} desactivado (acceso bloqueado).`, 'success')
  }

  async function handleResetPassword(c: Cleaner) {
    const ok = await confirm({ title: 'Resetear contraseña', message: `¿Generar una contraseña temporal nueva para ${c.full_name}? Se mostrará una sola vez y deberá cambiarla en el próximo ingreso.`, confirmLabel: 'Resetear' })
    if (!ok) return
    setResetting(c.id); setNotice(null)
    const res = await fetch(`/api/cleaners/${c.id}/reset-password`, { method: 'POST' })
    const data = await res.json()
    setResetting(null)
    if (!res.ok) { setNotice('⚠️ ' + (data.error ?? 'No se pudo resetear')); return }
    setNotice(`✅ Contraseña de ${c.full_name} reseteada a: ${data.tempPassword}. Debe cambiarla al ingresar.`)
  }

  async function handleDelete(c: Cleaner) {
    const ok = await confirm({ title: 'Eliminar auxiliar', message: `¿Eliminar a ${c.full_name} y su usuario de acceso? Esta acción no se puede deshacer.\nSi tiene servicios en el historial, no podrá eliminarse (desactívalo en su lugar).`, confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    setDeleting(c.id); setNotice(null)
    const res = await fetch(`/api/cleaners/${c.id}`, { method: 'DELETE' })
    const data = await res.json()
    setDeleting(null)
    if (!res.ok) { setNotice('⚠️ ' + (data.error ?? 'No se pudo eliminar')); return }
    setCleaners(prev => prev.filter(x => x.id !== c.id))
    setNotice(`✅ ${c.full_name} fue eliminado junto con su usuario.`)
  }

  const f = (key: keyof typeof form, val: string | boolean) => setForm(p => ({ ...p, [key]: val }))
  const detallada = view === 'detallada'

  return (
    <>
      {notice && (
        <div className="mb-4 flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm">
          <span>ℹ️</span><span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-blue-400 hover:text-blue-600">✕</button>
        </div>
      )}

      {/* Stats + acciones */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Activos: <strong>{activos}</strong> ({pct(activos)}%)</span>
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Inactivos: <strong>{inactivos}</strong> ({pct(inactivos)}%)</span>
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">Total: <strong>{total}</strong></span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            <button type="button" onClick={() => setView('resumida')} className={`px-3 py-1.5 ${!detallada ? 'bg-brand-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>Resumida</button>
            <button type="button" onClick={() => setView('detallada')} className={`px-3 py-1.5 ${detallada ? 'bg-brand-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>Detallada</button>
          </div>
          <button type="button" onClick={openNew} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition">+ Nuevo Auxiliar</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">🔍</span>
              <input type="text" aria-label="Buscar auxiliares" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, cédula o teléfono…"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <p className="text-sm text-gray-500 whitespace-nowrap">{filtered.length} mostrado(s)</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" /> Ver inactivos
          </label>
        </div>

        {/* Tabla (escritorio) */}
        <div className="overflow-x-auto hidden md:block"><table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-3">Auxiliar</th>
              <th className="text-left px-5 py-3">Cédula</th>
              <th className="text-left px-5 py-3">Tel.</th>
              {detallada && <th className="text-left px-5 py-3">Tel. Emergencia</th>}
              {detallada && <th className="text-left px-5 py-3">EPS / ARL</th>}
              {detallada && <th className="text-left px-5 py-3">Ingreso</th>}
              <th className="text-left px-5 py-3">Estado</th>
              <th className="px-5 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={detallada ? 8 : 5} className="py-10 text-center text-gray-600 text-sm">
                {cleaners.length === 0 ? 'Aún no tienes auxiliares.' : 'Ningún auxiliar coincide.'}
              </td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.full_name} url={photoMap[c.id]} size="sm" />
                    <span className="font-medium text-gray-800">{c.full_name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-600 font-mono text-xs">{c.document_id}</td>
                <td className="px-5 py-3 text-gray-600">{c.phone ?? '—'}</td>
                {detallada && <td className="px-5 py-3 text-gray-600">{c.emergency_phone ?? '—'}</td>}
                {detallada && <td className="px-5 py-3 text-gray-600">{c.eps || '—'} / {c.arl || '—'}</td>}
                {detallada && <td className="px-5 py-3 text-gray-600">{c.hire_date ? new Date(c.hire_date + 'T00:00:00').toLocaleDateString('es-CO') : '—'}</td>}
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.is_active ? 'Activo' : 'Inactivo'}</span>
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <button type="button" onClick={() => setHoja(c)} className="text-gray-700 hover:underline text-xs mr-3">Consultar</button>
                  <button type="button" onClick={() => openEdit(c)} className="text-brand-600 hover:underline text-xs mr-3">Editar</button>
                  <button type="button" onClick={() => handleResetPassword(c)} disabled={resetting === c.id} className="text-amber-600 hover:underline text-xs mr-3 disabled:opacity-50">{resetting === c.id ? '…' : 'Clave'}</button>
                  <button type="button" onClick={() => handleToggle(c)} className="text-gray-500 hover:underline text-xs mr-3">{c.is_active ? 'Desactivar' : 'Activar'}</button>
                  <button type="button" onClick={() => handleDelete(c)} disabled={deleting === c.id} className="text-red-500 hover:underline text-xs disabled:opacity-50">{deleting === c.id ? '…' : 'Eliminar'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>

        {/* Tarjetas (móvil) */}
        <div className="md:hidden divide-y divide-gray-100">
          {filtered.length === 0 && (
            <p className="py-10 text-center text-gray-600">{cleaners.length === 0 ? 'Aún no tienes auxiliares.' : 'Ningún auxiliar coincide.'}</p>
          )}
          {filtered.map(c => (
            <div key={c.id} className="p-4">
              <div className="flex items-center gap-3">
                <Avatar name={c.full_name} url={photoMap[c.id]} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-800 truncate">{c.full_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.is_active ? 'Activo' : 'Inactivo'}</span>
                  </div>
                  <div className="text-sm text-gray-600">Cédula: <span className="font-mono">{c.document_id}</span> · Tel: {c.phone ?? '—'}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setHoja(c)} className="py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">Hoja de vida</button>
                <button type="button" onClick={() => openEdit(c)} className="py-2 rounded-lg border border-brand-300 text-brand-700 font-medium hover:bg-brand-50">Editar</button>
                <button type="button" onClick={() => handleToggle(c)} className="py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">{c.is_active ? 'Desactivar' : 'Activar'}</button>
                <button type="button" onClick={() => handleResetPassword(c)} disabled={resetting === c.id} className="py-2 rounded-lg border border-amber-300 text-amber-700 font-medium hover:bg-amber-50 disabled:opacity-50">{resetting === c.id ? '…' : 'Resetear clave'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md md:max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">{editing ? 'Editar auxiliar' : 'Nuevo auxiliar'}</h2>
              <button type="button" onClick={() => setShowModal(false)} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 flex items-center gap-4">
                {/* Avatar clickeable con insignia de cámara */}
                <label htmlFor="cleaner-photo" className="relative group cursor-pointer shrink-0" title="Subir o cambiar foto">
                  <Avatar name={form.full_name || '?'} url={photoFile ? URL.createObjectURL(photoFile) : (editing ? photoMap[editing.id] : null)} size="lg" />
                  <span className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition" />
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm border-2 border-white shadow">📷</span>
                </label>
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">Foto</span>
                  <label htmlFor="cleaner-photo" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-brand-300 text-brand-700 text-sm font-medium hover:bg-brand-50 cursor-pointer transition">
                    📤 {(photoFile || (editing && photoMap[editing.id])) ? 'Cambiar foto' : 'Subir foto'}
                  </label>
                  {photoFile && <p className="text-xs text-green-600 mt-1 truncate max-w-[220px]">✓ {photoFile.name}</p>}
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG o WEBP (máx 2 MB).</p>
                </div>
                <input id="cleaner-photo" type="file" title="Foto del auxiliar" accept="image/png,image/jpeg,image/webp" onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} className="sr-only" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input type="text" value={form.full_name} onChange={e => f('full_name', e.target.value)} placeholder="María García" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Documento / Cédula (CC/CE)</label>
                <input type="text" value={form.document_id} onChange={e => f('document_id', e.target.value)} placeholder="12345678" disabled={!!editing}
                  className={inputCls + ' disabled:bg-gray-100 disabled:text-gray-500'} />
                {!editing && <p className="text-xs text-gray-600 mt-1">Será su <strong>usuario</strong> y su <strong>contraseña inicial</strong>.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input type="text" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="3001234567" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tel. emergencia</label>
                <input type="text" value={form.emergency_phone} onChange={e => f('emergency_phone', e.target.value)} placeholder="3007654321" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contacto de emergencia</label>
                <input type="text" value={form.emergency_contact_name} onChange={e => f('emergency_contact_name', e.target.value)} placeholder="Nombre del contacto" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
                <input type="date" title="Fecha de nacimiento" value={form.birth_date} onChange={e => f('birth_date', e.target.value)} className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input type="text" value={form.address} onChange={e => f('address', e.target.value)} placeholder="Cra 50 # 10-20" className={inputCls} />
                <div className="mt-2">
                  <button type="button" disabled={!form.address.trim()} onClick={() => setMapQuery(fullAddress(form.address))}
                    className="text-sm px-3 py-1.5 rounded-lg border border-brand-300 text-brand-700 hover:bg-brand-50 disabled:opacity-50">
                    🔍 Ver dirección en el mapa
                  </button>
                  {mapQuery && <div className="mt-2"><MapEmbed mode="place" q={mapQuery} title="Ubicación del auxiliar" /></div>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">EPS</label>
                <input type="text" title="EPS" value={form.eps} onChange={e => f('eps', e.target.value)} placeholder="EPS" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ARL</label>
                <input type="text" title="ARL" value={form.arl} onChange={e => f('arl', e.target.value)} placeholder="ARL" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de ingreso</label>
                <input type="date" title="Fecha de ingreso" value={form.hire_date} onChange={e => f('hire_date', e.target.value)} className={inputCls} />
              </div>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" checked={form.is_active} onChange={e => f('is_active', e.target.checked)} className="rounded" /> Activo
              </label>
              {error && <div className="md:col-span-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t sticky bottom-0 bg-white">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={loading || !form.full_name || !form.document_id} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
                {loading ? 'Guardando…' : editing ? 'Guardar' : 'Crear auxiliar + usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hoja de vida */}
      {hoja && <CleanerHojaDeVida cleaner={hoja} photoUrl={photoMap[hoja.id]} onClose={() => setHoja(null)} />}
    </>
  )
}
