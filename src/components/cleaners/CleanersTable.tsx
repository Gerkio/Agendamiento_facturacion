'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import type { Cleaner } from '@/types/database'

const emptyForm = { full_name: '', document_id: '', phone: '', is_active: true }

export default function CleanersTable({ cleaners: initial }: { cleaners: Cleaner[] }) {
  const supabase = createClient()
  const { confirm, toast } = useUI()
  const [cleaners, setCleaners] = useState(initial)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Cleaner | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetting, setResetting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const activeCount = useMemo(() => cleaners.filter(c => c.is_active).length, [cleaners])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return cleaners
    return cleaners.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      c.document_id.includes(q) ||
      (c.phone ?? '').includes(q)
    )
  }, [cleaners, search])

  function openNew() {
    setEditing(null)
    setForm({ ...emptyForm })
    setError(null)
    setShowModal(true)
  }

  function openEdit(c: Cleaner) {
    setEditing(c)
    setForm({ full_name: c.full_name, document_id: c.document_id, phone: c.phone ?? '', is_active: c.is_active })
    setError(null)
    setShowModal(true)
  }

  async function handleSave() {
    setLoading(true)
    setError(null)
    if (editing) {
      // Editar ficha (no toca el usuario). La cédula no se cambia aquí.
      const payload = { full_name: form.full_name, phone: form.phone || null, is_active: form.is_active }
      const { data, error } = await supabase.from('cleaners').update(payload).eq('id', editing.id).select().single()
      if (error) { setError(error.message); setLoading(false); return }
      setCleaners(prev => prev.map(c => (c.id === editing.id ? data : c)))
      setShowModal(false)
      setLoading(false)
    } else {
      // Crear limpiador + usuario automático (vía API con service_role).
      const res = await fetch('/api/cleaners/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: form.full_name, document_id: form.document_id, phone: form.phone || null, is_active: form.is_active }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudo crear'); setLoading(false); return }
      setCleaners(prev => [...prev, data.cleaner])
      setShowModal(false)
      setLoading(false)
      setNotice(`Limpiador creado. Usuario: ${data.username} · contraseña inicial: ${data.username} (deberá cambiarla al ingresar).`)
    }
  }

  async function handleToggle(c: Cleaner) {
    const { data, error } = await supabase.from('cleaners').update({ is_active: !c.is_active }).eq('id', c.id).select().single()
    if (error || !data) { toast('No se pudo cambiar el estado: ' + (error?.message ?? 'desconocido'), 'error'); return }
    setCleaners(prev => prev.map(x => (x.id === c.id ? data : x)))
    toast(data.is_active ? `${c.full_name} activado.` : `${c.full_name} desactivado.`, 'success')
  }

  async function handleResetPassword(c: Cleaner) {
    const ok = await confirm({
      title: 'Resetear contraseña',
      message: `¿Resetear la contraseña de ${c.full_name} a su cédula (${c.document_id})?\nDeberá cambiarla en el próximo ingreso.`,
      confirmLabel: 'Resetear',
    })
    if (!ok) return
    setResetting(c.id)
    setNotice(null)
    const res = await fetch(`/api/cleaners/${c.id}/reset-password`, { method: 'POST' })
    const data = await res.json()
    setResetting(null)
    if (!res.ok) { setNotice('⚠️ ' + (data.error ?? 'No se pudo resetear')); return }
    setNotice(`✅ Contraseña de ${c.full_name} reseteada a: ${data.tempPassword}. Debe cambiarla al ingresar.`)
  }

  async function handleDelete(c: Cleaner) {
    const ok = await confirm({
      title: 'Eliminar limpiador',
      message: `¿Eliminar a ${c.full_name} y su usuario de acceso? Esta acción no se puede deshacer.\nSi tiene servicios en el historial, no podrá eliminarse (desactívalo en su lugar).`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    setDeleting(c.id)
    setNotice(null)
    const res = await fetch(`/api/cleaners/${c.id}`, { method: 'DELETE' })
    const data = await res.json()
    setDeleting(null)
    if (!res.ok) { setNotice('⚠️ ' + (data.error ?? 'No se pudo eliminar')); return }
    setCleaners(prev => prev.filter(x => x.id !== c.id))
    setNotice(`✅ ${c.full_name} fue eliminado junto con su usuario.`)
  }

  const f = (key: keyof typeof form, val: string | boolean) => setForm(p => ({ ...p, [key]: val }))

  return (
    <>
      {notice && (
        <div className="mb-4 flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm">
          <span>ℹ️</span>
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-blue-400 hover:text-blue-600">✕</button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">🔍</span>
              <input
                type="text"
                aria-label="Buscar limpiadores"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre, cédula o teléfono…"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <p className="text-sm text-gray-500 whitespace-nowrap">
              {search ? `${filtered.length} de ${cleaners.length}` : `${cleaners.length} limpiador(es) · ${activeCount} activo(s)`}
            </p>
          </div>
          <button type="button" onClick={openNew} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition">
            + Nuevo Limpiador
          </button>
        </div>
        <div className="overflow-x-auto hidden md:block"><table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-3">Nombre</th>
              <th className="text-left px-5 py-3">Usuario (cédula)</th>
              <th className="text-left px-5 py-3">Teléfono</th>
              <th className="text-left px-5 py-3">Estado</th>
              <th className="px-5 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cleaners.length === 0 && (
              <tr><td colSpan={5} className="py-12">
                <div className="flex flex-col items-center text-center gap-3">
                  <span className="text-4xl">🧹</span>
                  <p className="text-gray-500 text-sm">Aún no tienes limpiadores. Al crear uno, se genera su usuario automáticamente.</p>
                  <button type="button" onClick={openNew} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition">
                    + Crear mi primer limpiador
                  </button>
                </div>
              </td></tr>
            )}
            {cleaners.length > 0 && filtered.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-gray-600 text-sm">
                Ningún limpiador coincide con “{search}”.
              </td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-800">{c.full_name}</td>
                <td className="px-5 py-3 text-gray-600 font-mono text-xs">{c.document_id}</td>
                <td className="px-5 py-3 text-gray-600">{c.phone ?? '—'}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <button type="button" onClick={() => openEdit(c)} className="text-brand-600 hover:underline text-xs mr-3">Editar</button>
                  <button type="button" onClick={() => handleResetPassword(c)} disabled={resetting === c.id} className="text-amber-600 hover:underline text-xs mr-3 disabled:opacity-50">
                    {resetting === c.id ? 'Reseteando…' : 'Resetear clave'}
                  </button>
                  <button type="button" onClick={() => handleToggle(c)} className="text-gray-500 hover:underline text-xs mr-3">
                    {c.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button type="button" onClick={() => handleDelete(c)} disabled={deleting === c.id} className="text-red-500 hover:underline text-xs disabled:opacity-50">
                    {deleting === c.id ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>

        {/* Vista de tarjetas (móvil) */}
        <div className="md:hidden divide-y divide-gray-100">
          {cleaners.length === 0 && (
            <div className="flex flex-col items-center text-center gap-3 py-12 px-4">
              <span className="text-4xl">🧹</span>
              <p className="text-gray-600">Aún no tienes limpiadores. Al crear uno, se genera su usuario automáticamente.</p>
              <button type="button" onClick={openNew} className="bg-brand-600 text-white px-4 py-2.5 rounded-lg hover:bg-brand-700 transition">
                + Crear mi primer limpiador
              </button>
            </div>
          )}
          {cleaners.length > 0 && filtered.length === 0 && (
            <p className="py-10 text-center text-gray-600">Ningún limpiador coincide con “{search}”.</p>
          )}
          {filtered.map(c => (
            <div key={c.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-gray-800">{c.full_name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {c.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="mt-1 text-sm text-gray-600 space-y-0.5">
                <div>Cédula: <span className="font-mono">{c.document_id}</span></div>
                <div>Tel: {c.phone ?? '—'}</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => openEdit(c)} className="py-2 rounded-lg border border-brand-300 text-brand-700 font-medium hover:bg-brand-50">Editar</button>
                <button type="button" onClick={() => handleToggle(c)} className="py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">{c.is_active ? 'Desactivar' : 'Activar'}</button>
                <button type="button" onClick={() => handleResetPassword(c)} disabled={resetting === c.id} className="py-2 rounded-lg border border-amber-300 text-amber-700 font-medium hover:bg-amber-50 disabled:opacity-50">{resetting === c.id ? 'Reseteando…' : 'Resetear clave'}</button>
                <button type="button" onClick={() => handleDelete(c)} disabled={deleting === c.id} className="py-2 rounded-lg border border-red-300 text-red-600 font-medium hover:bg-red-50 disabled:opacity-50">{deleting === c.id ? 'Eliminando…' : 'Eliminar'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{editing ? 'Editar Limpiador' : 'Nuevo Limpiador'}</h2>
              <button type="button" onClick={() => setShowModal(false)} aria-label="Cerrar" className="text-gray-600 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input type="text" value={form.full_name} onChange={e => f('full_name', e.target.value)} placeholder="María García"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Documento / Cédula (CC/CE)</label>
                <input type="text" value={form.document_id} onChange={e => f('document_id', e.target.value)} placeholder="12345678"
                  disabled={!!editing}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100 disabled:text-gray-500" />
                {!editing && (
                  <p className="text-xs text-gray-600 mt-1">Será su <strong>usuario</strong> y su <strong>contraseña inicial</strong>. Deberá cambiarla al ingresar.</p>
                )}
                {editing && <p className="text-xs text-gray-600 mt-1">La cédula no se puede cambiar (es el usuario de acceso).</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input type="text" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="3001234567"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={e => f('is_active', e.target.checked)} className="rounded" />
                Activo
              </label>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={loading || !form.full_name || !form.document_id} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
                {loading ? 'Guardando...' : editing ? 'Guardar' : 'Crear limpiador + usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
