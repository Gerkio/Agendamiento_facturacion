'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import Avatar from '@/components/ui/Avatar'
import { calcularDV } from '@/lib/dian/dv'
import { cityName } from '@/lib/dian/cities'
import {
  CITY_OPTIONS, TAX_SCHEMES, FISCAL_REGIMENS, NATURALEZAS,
  deriveCompanyName, nameIsValid,
} from '@/lib/clients'
import type { Client } from '@/types/database'

const emptyForm = {
  naturaleza: 'juridica', company_name: '',
  first_name: '', second_name: '', first_surname: '', second_surname: '',
  nit_cedula: '', dv: '', email: '', phone: '',
  address: '', city_code: '11001', tax_scheme: '01', fiscal_regimen: 'R-99-PN', indicaciones: '',
}
const inputCls = 'w-full border border-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

export default function ClientsTable({ clients: initial, photoUrls = {} }: { clients: Client[]; photoUrls?: Record<string, string> }) {
  const supabase = createClient()
  const router = useRouter()
  const { toast, confirm } = useUI()
  const [clients, setClients] = useState(initial)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(c =>
      c.company_name.toLowerCase().includes(q) ||
      `${c.nit_cedula}-${c.dv}`.includes(q) ||
      c.email.toLowerCase().includes(q)
    )
  }, [clients, search])

  const validName = nameIsValid(form)
  const validNit = /^\d{5,}$/.test(form.nit_cedula)
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)
  const validAddr = form.address.trim() !== ''
  const isValid = validName && validNit && validEmail && validAddr

  const f = (key: keyof typeof form, val: string) => setForm(p => ({ ...p, [key]: val }))
  const setNit = (val: string) => setForm(p => ({ ...p, nit_cedula: val, dv: calcularDV(val) }))

  function openNew() { setForm({ ...emptyForm }); setError(null); setShowModal(true) }
  const goDetail = (id: string) => router.push(`/dashboard/clients/${id}`)

  async function handleCreate() {
    if (!isValid) { setError('Revisa los campos: nombre/razón social, NIT, correo y dirección.'); return }
    setLoading(true); setError(null)
    const company_name = deriveCompanyName(form)
    const payload = {
      naturaleza: form.naturaleza, company_name,
      first_name: form.first_name || null, second_name: form.second_name || null,
      first_surname: form.first_surname || null, second_surname: form.second_surname || null,
      nit_cedula: form.nit_cedula, dv: form.dv, email: form.email, phone: form.phone || null,
      address: form.address, city_code: form.city_code, tax_scheme: form.tax_scheme,
      fiscal_regimen: form.fiscal_regimen, indicaciones: form.indicaciones || null,
    }
    const { data, error } = await supabase.from('clients').insert(payload).select().single()
    if (error) {
      const dup = error.message.toLowerCase().includes('duplicate') || error.message.includes('nit_cedula')
      setError(dup ? 'Ya existe un cliente con ese NIT/Cédula.' : error.message)
      setLoading(false); return
    }
    toast('Cliente creado. Completa la ficha.', 'success')
    router.push(`/dashboard/clients/${data.id}`)
  }

  async function handleDelete(c: Client) {
    const ok = await confirm({ title: 'Eliminar cliente', message: `¿Eliminar a "${c.company_name}"? Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    const { error } = await supabase.from('clients').delete().eq('id', c.id)
    if (error) { toast('No se pudo eliminar: ' + error.message, 'error'); return }
    setClients(prev => prev.filter(x => x.id !== c.id))
    toast('Cliente eliminado.', 'success')
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">🔍</span>
              <input type="text" aria-label="Buscar clientes" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por empresa, NIT o correo…"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <p className="text-sm text-gray-500 whitespace-nowrap">{search ? `${filtered.length} de ${clients.length}` : `${clients.length} cliente(s)`}</p>
          </div>
          <button type="button" onClick={openNew} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition">+ Nuevo Cliente</button>
        </div>

        {/* Tabla escritorio */}
        <div className="overflow-x-auto hidden md:block"><table className="w-full text-sm min-w-[680px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-3">Cliente</th>
              <th className="text-left px-5 py-3">NIT / Cédula</th>
              <th className="text-left px-5 py-3">Email</th>
              <th className="text-left px-5 py-3">Ciudad</th>
              <th className="text-left px-5 py-3">Estado</th>
              <th className="px-5 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.length === 0 && (
              <tr><td colSpan={6} className="py-12">
                <div className="flex flex-col items-center text-center gap-3">
                  <span className="text-4xl">🏢</span>
                  <p className="text-gray-500 text-sm">Aún no tienes clientes registrados.</p>
                  <button type="button" onClick={openNew} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition">+ Crear mi primer cliente</button>
                </div>
              </td></tr>
            )}
            {clients.length > 0 && filtered.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-gray-600 text-sm">Ningún cliente coincide con “{search}”.</td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => goDetail(c.id)}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.company_name} url={photoUrls[c.id]} size="sm" />
                    <span className="font-medium text-gray-800 inline-flex items-center gap-1.5">{c.company_name}{c.indicaciones && <span title="Tiene indicaciones de llegada">🧭</span>}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-600">{c.nit_cedula}-{c.dv}</td>
                <td className="px-5 py-3 text-gray-600">{c.email}</td>
                <td className="px-5 py-3 text-gray-600">{cityName(c.city_code)}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_active === false ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>{c.is_active === false ? 'Inactivo' : 'Activo'}</span>
                </td>
                <td className="px-5 py-3 flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                  <button type="button" onClick={() => goDetail(c.id)} className="text-brand-600 hover:underline text-xs font-medium">Ver/Editar</button>
                  <button type="button" onClick={() => handleDelete(c)} className="text-red-500 hover:underline text-xs">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>

        {/* Tarjetas móvil */}
        <div className="md:hidden divide-y divide-gray-100">
          {clients.length === 0 && (
            <div className="flex flex-col items-center text-center gap-3 py-12 px-4">
              <span className="text-4xl">🏢</span>
              <p className="text-gray-600">Aún no tienes clientes registrados.</p>
              <button type="button" onClick={openNew} className="bg-brand-600 text-white px-4 py-2.5 rounded-lg hover:bg-brand-700 transition">+ Crear mi primer cliente</button>
            </div>
          )}
          {clients.length > 0 && filtered.length === 0 && <p className="py-10 text-center text-gray-600">Ningún cliente coincide con “{search}”.</p>}
          {filtered.map(c => (
            <div key={c.id} className="p-4">
              <div className="flex items-center gap-3">
                <Avatar name={c.company_name} url={photoUrls[c.id]} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-800 truncate inline-flex items-center gap-1.5">{c.company_name}{c.indicaciones && <span>🧭</span>}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_active === false ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>{c.is_active === false ? 'Inactivo' : 'Activo'}</span>
                  </div>
                  <div className="text-sm text-gray-600 truncate">{c.nit_cedula}-{c.dv} · {c.email}</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => goDetail(c.id)} className="flex-1 py-2 rounded-lg border border-brand-300 text-brand-700 font-medium hover:bg-brand-50">Ver/Editar</button>
                <button type="button" onClick={() => handleDelete(c)} className="flex-1 py-2 rounded-lg border border-red-300 text-red-600 font-medium hover:bg-red-50">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal crear (mínimo) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md md:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">Nuevo Cliente</h2>
              <button type="button" onClick={() => setShowModal(false)} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Naturaleza</label>
                <select title="Naturaleza" value={form.naturaleza} onChange={e => f('naturaleza', e.target.value)} className={inputCls}>
                  {NATURALEZAS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </div>
              {form.naturaleza === 'natural' ? (
                <>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Primer nombre *</label><input title="Primer nombre" value={form.first_name} onChange={e => f('first_name', e.target.value)} className={inputCls} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Segundo nombre</label><input title="Segundo nombre" value={form.second_name} onChange={e => f('second_name', e.target.value)} className={inputCls} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Primer apellido *</label><input title="Primer apellido" value={form.first_surname} onChange={e => f('first_surname', e.target.value)} className={inputCls} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Segundo apellido</label><input title="Segundo apellido" value={form.second_surname} onChange={e => f('second_surname', e.target.value)} className={inputCls} /></div>
                </>
              ) : (
                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Razón social *</label><input title="Razón social" value={form.company_name} onChange={e => f('company_name', e.target.value)} className={inputCls} /></div>
              )}
              <div className="grid grid-cols-3 gap-3 md:col-span-2">
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">NIT / Cédula *</label><input title="NIT o Cédula" inputMode="numeric" value={form.nit_cedula} onChange={e => setNit(e.target.value)} className={inputCls} placeholder="900123456" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">DV</label><input title="DV" value={form.dv} readOnly className={inputCls + ' bg-gray-100 text-center'} /></div>
              </div>
              <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Correo *</label><input title="Correo" type="email" value={form.email} onChange={e => f('email', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label><input title="Teléfono" value={form.phone} onChange={e => f('phone', e.target.value)} className={inputCls} /></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                <select title="Ciudad" value={form.city_code} onChange={e => f('city_code', e.target.value)} className={inputCls}>
                  {CITY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Dirección *</label><input title="Dirección" value={form.address} onChange={e => f('address', e.target.value)} className={inputCls} /></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Esquema tributario</label>
                <select title="Esquema tributario" value={form.tax_scheme} onChange={e => f('tax_scheme', e.target.value)} className={inputCls}>
                  {TAX_SCHEMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Régimen fiscal</label>
                <select title="Régimen fiscal" value={form.fiscal_regimen} onChange={e => f('fiscal_regimen', e.target.value)} className={inputCls}>
                  {FISCAL_REGIMENS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <p className="md:col-span-2 text-xs text-gray-500">Al crear se abre la ficha completa para foto, direcciones y más datos.</p>
              {error && <div className="md:col-span-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t sticky bottom-0 bg-white">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={handleCreate} disabled={loading || !isValid} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{loading ? 'Creando…' : 'Crear cliente'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
