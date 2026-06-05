'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUI } from '@/components/ui/UIProvider'

export interface UserRow {
  id: string
  email: string
  role: 'admin' | 'cleaner'
  cleaner_id: string | null
  must_change_password: boolean
  cleaners?: { full_name?: string } | null
}

const input = 'w-full border border-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const cleanerName = (u: UserRow) => (u.cleaners as { full_name?: string } | undefined)?.full_name

export default function UsersTable({ users: initial, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter()
  const { toast, confirm } = useUI()
  const [users, setUsers] = useState(initial)
  const [working, setWorking] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createAdmin() {
    if (!form.email.trim() || form.password.trim().length < 6) { setError('Correo válido y contraseña de mínimo 6 caracteres.'); return }
    setSaving(true); setError(null)
    const res = await fetch('/api/users/create-admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'No se pudo crear'); return }
    setShowCreate(false); setForm({ email: '', password: '' })
    toast('Administrador creado. Debe cambiar su contraseña al ingresar.', 'success')
    router.refresh()
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

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button type="button" onClick={() => { setForm({ email: '', password: '' }); setError(null); setShowCreate(true) }} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition">+ Crear administrador</button>
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
                <td className="px-5 py-3 font-medium text-gray-800 break-all">{u.email}{u.id === currentUserId && <span className="ml-2 text-xs text-gray-400">(tú)</span>}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>{u.role === 'admin' ? 'Administrador' : 'Auxiliar'}</span>
                </td>
                <td className="px-5 py-3 text-gray-600">{cleanerName(u) ?? '—'}</td>
                <td className="px-5 py-3 text-gray-600">{u.must_change_password ? <span className="text-amber-600 text-xs">Debe cambiar contraseña</span> : <span className="text-gray-400 text-xs">OK</span>}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
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
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-800 break-all">{u.email}{u.id === currentUserId && <span className="ml-1 text-xs text-gray-400">(tú)</span>}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${u.role === 'admin' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>{u.role === 'admin' ? 'Admin' : 'Auxiliar'}</span>
              </div>
              {cleanerName(u) && <div className="text-sm text-gray-600 mt-0.5">Auxiliar: {cleanerName(u)}</div>}
              {u.must_change_password && <div className="text-xs text-amber-600 mt-0.5">Debe cambiar contraseña</div>}
              {u.id !== currentUserId && (
                <button type="button" onClick={() => changeRole(u)} disabled={working === u.id} className="mt-3 w-full py-2 rounded-lg border border-brand-300 text-brand-700 font-medium hover:bg-brand-50 disabled:opacity-50">
                  {working === u.id ? '…' : (u.role === 'admin' ? 'Pasar a auxiliar' : 'Hacer administrador')}
                </button>
              )}
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
    </>
  )
}
