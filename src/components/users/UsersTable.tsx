'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUI } from '@/components/ui/UIProvider'
import Avatar from '@/components/ui/Avatar'

export interface UserRow {
  id: string
  email: string
  role: 'admin' | 'cleaner'
  cleaner_id: string | null
  must_change_password: boolean
  full_name?: string | null
  photo_url?: string | null
  cleaners?: { full_name?: string } | null
}

const input = 'w-full border border-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const cleanerName = (u: UserRow) => (u.cleaners as { full_name?: string } | undefined)?.full_name
/** Nombre a mostrar: el del perfil (admin), el del auxiliar vinculado, o el correo. */
const displayName = (u: UserRow) => u.full_name || cleanerName(u) || u.email

export default function UsersTable({ users: initial, currentUserId, photoUrls = {} }: {
  users: UserRow[]; currentUserId: string; photoUrls?: Record<string, string>
}) {
  const router = useRouter()
  const { toast, confirm } = useUI()
  const [users, setUsers] = useState(initial)
  const [photos, setPhotos] = useState(photoUrls)
  const [working, setWorking] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Cambio de contraseña por usuario.
  const [pwUser, setPwUser] = useState<UserRow | null>(null)
  const [pwValue, setPwValue] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  // Edición de perfil de administrador (nombre + foto).
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  async function createAdmin() {
    if (!form.full_name.trim()) { setError('El nombre es obligatorio.'); return }
    if (!form.email.trim() || form.password.trim().length < 6) { setError('Correo válido y contraseña de mínimo 6 caracteres.'); return }
    setSaving(true); setError(null)
    const res = await fetch('/api/users/create-admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'No se pudo crear'); return }
    setShowCreate(false); setForm({ full_name: '', email: '', password: '' })
    toast('Administrador creado. Debe cambiar su contraseña al ingresar.', 'success')
    router.refresh()
  }

  function openEdit(u: UserRow) {
    setEditUser(u); setEditName(u.full_name ?? ''); setEditFile(null); setEditError(null)
  }

  async function saveProfile() {
    if (!editUser) return
    if (!editName.trim()) { setEditError('El nombre es obligatorio.'); return }
    setEditSaving(true); setEditError(null)
    // 1) Nombre.
    const res = await fetch(`/api/users/${editUser.id}/profile`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: editName.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setEditSaving(false); setEditError(data.error ?? 'No se pudo guardar'); return }
    // 2) Foto (si se eligió una nueva).
    let newPhoto: string | null = null
    if (editFile) {
      const fd = new FormData(); fd.append('photo', editFile)
      const pRes = await fetch(`/api/users/${editUser.id}/photo`, { method: 'POST', body: fd })
      const pData = await pRes.json()
      if (!pRes.ok) { setEditSaving(false); setEditError('Nombre guardado, pero la foto no se subió: ' + (pData.error ?? '')); return }
      newPhoto = pData.signedUrl ?? null
    }
    setUsers(prev => prev.map(x => x.id === editUser.id ? { ...x, full_name: editName.trim() } : x))
    if (newPhoto) setPhotos(prev => ({ ...prev, [editUser.id]: newPhoto }))
    setEditSaving(false)
    setEditUser(null)
    toast('Perfil actualizado.', 'success')
  }

  async function changeRole(u: UserRow) {
    const next = u.role === 'admin' ? 'cleaner' : 'admin'
    const label = next === 'admin' ? 'promover a administrador' : 'pasar a auxiliar'
    const ok = await confirm({ title: 'Cambiar rol', message: `¿Seguro que deseas ${label} a ${u.email}?`, confirmLabel: 'Cambiar rol' })
    if (!ok) return
    setWorking(u.id)
    const res = await fetch(`/api/users/${u.id}/role`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: next }),
    })
    const data = await res.json()
    setWorking(null)
    if (!res.ok) { toast('No se pudo cambiar el rol: ' + (data.error ?? ''), 'error'); return }
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: next } : x))
    toast('Rol actualizado.', 'success')
  }

  function openPw(u: UserRow) { setPwUser(u); setPwValue(''); setPwError(null) }

  async function changePassword() {
    if (!pwUser) return
    if (pwValue.trim().length < 6) { setPwError('Mínimo 6 caracteres.'); return }
    setPwSaving(true); setPwError(null)
    const res = await fetch(`/api/users/${pwUser.id}/password`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwValue.trim() }),
    })
    const data = await res.json()
    setPwSaving(false)
    if (!res.ok) { setPwError(data.error ?? 'No se pudo cambiar'); return }
    const self = pwUser.id === currentUserId
    setUsers(prev => prev.map(x => x.id === pwUser.id ? { ...x, must_change_password: !self } : x))
    setPwUser(null)
    toast(self ? 'Tu contraseña fue cambiada.' : `Contraseña de ${pwUser.email} cambiada. Deberá redefinirla al ingresar.`, 'success')
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button type="button" onClick={() => { setForm({ full_name: '', email: '', password: '' }); setError(null); setShowCreate(true) }} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition">+ Crear administrador</button>
        <span className="text-sm text-gray-500">{users.length} usuario(s)</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto hidden md:block"><table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-3">Usuario</th>
              <th className="text-left px-5 py-3">Rol</th>
              <th className="text-left px-5 py-3">Vinculado a</th>
              <th className="text-left px-5 py-3">Estado</th>
              <th className="px-5 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={displayName(u)} url={photos[u.id]} size="sm" />
                    <div className="min-w-0">
                      <div className="font-medium text-gray-800 truncate">{displayName(u)}{u.id === currentUserId && <span className="ml-2 text-xs text-gray-400">(tú)</span>}</div>
                      <div className="text-xs text-gray-500 break-all">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>{u.role === 'admin' ? 'Administrador' : 'Auxiliar'}</span>
                </td>
                <td className="px-5 py-3 text-gray-600">{cleanerName(u) ?? '—'}</td>
                <td className="px-5 py-3 text-gray-600">{u.must_change_password ? <span className="text-amber-600 text-xs">Debe cambiar contraseña</span> : <span className="text-gray-400 text-xs">OK</span>}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  {u.role === 'admin' && (
                    <button type="button" onClick={() => openEdit(u)} className="text-brand-600 hover:underline text-xs font-medium mr-3">Editar perfil</button>
                  )}
                  <button type="button" onClick={() => openPw(u)} className="text-amber-600 hover:underline text-xs font-medium mr-3">Contraseña</button>
                  {u.id === currentUserId
                    ? <span className="text-xs text-gray-400">—</span>
                    : <button type="button" onClick={() => changeRole(u)} disabled={working === u.id} className="text-brand-600 hover:underline text-xs font-medium disabled:opacity-50">
                        {working === u.id ? '…' : (u.role === 'admin' ? 'Pasar a auxiliar' : 'Hacer administrador')}
                      </button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>

        {/* Tarjetas móvil */}
        <div className="md:hidden divide-y divide-gray-100">
          {users.map(u => (
            <div key={u.id} className="p-4">
              <div className="flex items-center gap-3">
                <Avatar name={displayName(u)} url={photos[u.id]} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-800 truncate">{displayName(u)}{u.id === currentUserId && <span className="ml-1 text-xs text-gray-400">(tú)</span>}</div>
                  <div className="text-xs text-gray-500 break-all">{u.email}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${u.role === 'admin' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>{u.role === 'admin' ? 'Admin' : 'Auxiliar'}</span>
              </div>
              {cleanerName(u) && <div className="text-sm text-gray-600 mt-1">Auxiliar: {cleanerName(u)}</div>}
              {u.must_change_password && <div className="text-xs text-amber-600 mt-0.5">Debe cambiar contraseña</div>}
              <div className="mt-3 flex flex-wrap gap-2">
                {u.role === 'admin' && (
                  <button type="button" onClick={() => openEdit(u)} className="flex-1 min-w-[120px] py-2 rounded-lg border border-brand-300 text-brand-700 font-medium hover:bg-brand-50">Editar perfil</button>
                )}
                <button type="button" onClick={() => openPw(u)} className="flex-1 min-w-[120px] py-2 rounded-lg border border-amber-300 text-amber-700 font-medium hover:bg-amber-50">Cambiar contraseña</button>
                {u.id !== currentUserId && (
                  <button type="button" onClick={() => changeRole(u)} disabled={working === u.id} className="flex-1 min-w-[120px] py-2 rounded-lg border border-brand-300 text-brand-700 font-medium hover:bg-brand-50 disabled:opacity-50">
                    {working === u.id ? '…' : (u.role === 'admin' ? 'Pasar a auxiliar' : 'Hacer administrador')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Crear administrador</h2>
              <button type="button" onClick={() => setShowCreate(false)} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input type="text" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Ej: María Pérez" className={input} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="nombre@empresa.com" className={input} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña temporal</label>
                <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 6 caracteres" className={input} />
                <p className="text-xs text-gray-500 mt-1">La cambiará obligatoriamente en su primer ingreso.</p>
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={createAdmin} disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Creando…' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Editar perfil de administrador (nombre + foto) */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Editar perfil</h2>
              <button type="button" onClick={() => setEditUser(null)} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-4">
                <label htmlFor="admin-photo" className="relative group cursor-pointer shrink-0" title="Subir o cambiar foto">
                  <Avatar name={editName || editUser.email} url={editFile ? URL.createObjectURL(editFile) : photos[editUser.id]} size="lg" />
                  <span className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition" />
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm border-2 border-white shadow">📷</span>
                </label>
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">Foto de perfil</span>
                  <label htmlFor="admin-photo" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-brand-300 text-brand-700 text-sm font-medium hover:bg-brand-50 cursor-pointer transition">
                    📤 {(editFile || photos[editUser.id]) ? 'Cambiar foto' : 'Subir foto'}
                  </label>
                  {editFile && <p className="text-xs text-green-600 mt-1 truncate max-w-[200px]">✓ {editFile.name}</p>}
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG o WEBP (máx 2 MB). Se sube al guardar.</p>
                </div>
                <input id="admin-photo" type="file" title="Foto del administrador" accept="image/png,image/jpeg,image/webp" onChange={e => setEditFile(e.target.files?.[0] ?? null)} className="sr-only" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Ej: María Pérez" className={input} />
              </div>
              <p className="text-sm text-gray-500 break-all">Correo: {editUser.email}</p>
              {editError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{editError}</div>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button type="button" onClick={() => setEditUser(null)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={saveProfile} disabled={editSaving} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{editSaving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Cambiar contraseña */}
      {pwUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
              <button type="button" onClick={() => setPwUser(null)} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600 break-all">{pwUser.email}{pwUser.id === currentUserId && <span className="text-gray-400"> (tú)</span>}</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <input type="text" value={pwValue} onChange={e => setPwValue(e.target.value)} placeholder="Mínimo 6 caracteres" className={input} />
              </div>
              <p className="text-xs text-gray-500">
                {pwUser.id === currentUserId
                  ? 'Quedará como tu contraseña definitiva.'
                  : 'Será temporal: el usuario deberá redefinirla en su próximo ingreso.'}
              </p>
              {pwError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{pwError}</div>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button type="button" onClick={() => setPwUser(null)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={changePassword} disabled={pwSaving} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{pwSaving ? 'Guardando…' : 'Cambiar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
