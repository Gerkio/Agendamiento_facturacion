'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { calcularDV } from '@/lib/dian/dv'
import type { Client } from '@/types/database'

const CITY_OPTIONS = [
  { code: '11001', name: 'Bogotá D.C.' },
  { code: '05001', name: 'Medellín' },
  { code: '76001', name: 'Cali' },
  { code: '08001', name: 'Barranquilla' },
  { code: '13001', name: 'Cartagena' },
  { code: '17001', name: 'Manizales' },
  { code: '54001', name: 'Cúcuta' },
  { code: '41001', name: 'Neiva' },
]

const TAX_SCHEMES = [
  { value: '01', label: '01 — IVA' },
  { value: 'ZV', label: 'ZV — No responsable de IVA' },
]

const FISCAL_REGIMENS = [
  { value: 'R-99-PN', label: 'R-99-PN — No aplica' },
  { value: 'O-13', label: 'O-13 — Gran contribuyente' },
  { value: 'O-15', label: 'O-15 — Autorretenedor' },
  { value: 'O-23', label: 'O-23 — Agente de retención de IVA' },
  { value: 'O-47', label: 'O-47 — Regimen simple de tributación' },
]

const emptyForm = {
  company_name: '', nit_cedula: '', dv: '', email: '', phone: '',
  address: '', city_code: '11001', tax_scheme: '01', fiscal_regimen: 'R-99-PN',
  indicaciones: '',
}

export default function ClientsTable({ clients: initial }: { clients: Client[] }) {
  const supabase = createClient()
  const { toast, confirm } = useUI()
  const [clients, setClients] = useState(initial)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [search, setSearch] = useState('')

  // Filtro en vivo por empresa, NIT o correo.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(c =>
      c.company_name.toLowerCase().includes(q) ||
      `${c.nit_cedula}-${c.dv}`.includes(q) ||
      c.email.toLowerCase().includes(q)
    )
  }, [clients, search])

  // Validación viva: mensaje por campo (vacío = ok).
  const fieldErrors = useMemo(() => ({
    company_name: form.company_name.trim() ? '' : 'Ingresa la razón social.',
    nit_cedula: /^\d{5,}$/.test(form.nit_cedula) ? '' : 'Solo números, mínimo 5 dígitos.',
    email: !form.email.trim() ? 'Ingresa el correo.' : (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) ? '' : 'Correo inválido.'),
    address: form.address.trim() ? '' : 'Ingresa la dirección.',
  }), [form.company_name, form.nit_cedula, form.email, form.address])
  const isValid = !Object.values(fieldErrors).some(Boolean)
  // Mostrar error solo si ya intentó guardar o si el campo tiene contenido inválido.
  const showErr = (field: keyof typeof fieldErrors, val: string) => (attempted || val.trim() !== '') ? fieldErrors[field] : ''

  function openNew() {
    setEditing(null)
    setForm({ ...emptyForm })
    setError(null)
    setAttempted(false)
    setShowModal(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({
      company_name: c.company_name, nit_cedula: c.nit_cedula, dv: c.dv,
      email: c.email, phone: c.phone ?? '', address: c.address,
      city_code: c.city_code, tax_scheme: c.tax_scheme, fiscal_regimen: c.fiscal_regimen,
      indicaciones: c.indicaciones ?? '',
    })
    setError(null)
    setAttempted(false)
    setShowModal(true)
  }

  async function handleSave() {
    if (!isValid) { setAttempted(true); setError('Revisa los campos marcados en rojo.'); return }
    setLoading(true)
    setError(null)
    const payload = { ...form, phone: form.phone || null, indicaciones: form.indicaciones || null }
    let result
    if (editing) {
      result = await supabase.from('clients').update(payload).eq('id', editing.id).select().single()
    } else {
      result = await supabase.from('clients').insert(payload).select().single()
    }
    if (result.error) { setError(result.error.message); setLoading(false); return }
    setClients(prev =>
      editing ? prev.map(c => c.id === editing.id ? result.data : c) : [...prev, result.data]
    )
    setShowModal(false)
    setLoading(false)
    toast(editing ? 'Cliente actualizado.' : 'Cliente creado.', 'success')
  }

  async function handleDelete(id: string) {
    const c = clients.find(x => x.id === id)
    const ok = await confirm({ title: 'Eliminar cliente', message: `¿Eliminar a "${c?.company_name ?? 'este cliente'}"? Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) { toast('No se pudo eliminar: ' + error.message, 'error'); return }
    setClients(prev => prev.filter(c => c.id !== id))
    toast('Cliente eliminado.', 'success')
  }

  const f = (key: keyof typeof form, val: string) => setForm(p => ({ ...p, [key]: val }))
  // El NIT recalcula el DV automáticamente (mod-11 DIAN).
  const setNit = (val: string) => setForm(p => ({ ...p, nit_cedula: val, dv: calcularDV(val) }))

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">🔍</span>
              <input
                type="text"
                aria-label="Buscar clientes"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por empresa, NIT o correo…"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <p className="text-sm text-gray-500 whitespace-nowrap">
              {search ? `${filtered.length} de ${clients.length}` : `${clients.length} cliente(s)`}
            </p>
          </div>
          <button type="button" onClick={openNew} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition">
            + Nuevo Cliente
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-3">Empresa</th>
              <th className="text-left px-5 py-3">NIT / Cédula</th>
              <th className="text-left px-5 py-3">Email</th>
              <th className="text-left px-5 py-3">Ciudad</th>
              <th className="text-left px-5 py-3">Régimen</th>
              <th className="px-5 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.length === 0 && (
              <tr><td colSpan={6} className="py-12">
                <div className="flex flex-col items-center text-center gap-3">
                  <span className="text-4xl">🏢</span>
                  <p className="text-gray-500 text-sm">Aún no tienes clientes registrados.</p>
                  <button type="button" onClick={openNew} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition">
                    + Crear mi primer cliente
                  </button>
                </div>
              </td></tr>
            )}
            {clients.length > 0 && filtered.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-gray-600 text-sm">
                Ningún cliente coincide con “{search}”.
              </td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-800">
                  <span className="inline-flex items-center gap-1.5">
                    {c.company_name}
                    {c.indicaciones && <span title="Tiene indicaciones de llegada">🧭</span>}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-600">{c.nit_cedula}-{c.dv}</td>
                <td className="px-5 py-3 text-gray-600">{c.email}</td>
                <td className="px-5 py-3 text-gray-600">{CITY_OPTIONS.find(x => x.code === c.city_code)?.name ?? c.city_code}</td>
                <td className="px-5 py-3 text-gray-600">{c.fiscal_regimen}</td>
                <td className="px-5 py-3 flex gap-2 justify-end">
                  <button type="button" onClick={() => openEdit(c)} className="text-brand-600 hover:underline text-xs">Editar</button>
                  <button type="button" onClick={() => handleDelete(c.id)} className="text-red-500 hover:underline text-xs">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button type="button" onClick={() => setShowModal(false)} aria-label="Cerrar" className="text-gray-600 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Nombre empresa / Razón social *" error={showErr('company_name', form.company_name)}>
                <input title="Nombre empresa / Razón social" type="text" value={form.company_name} onChange={e => f('company_name', e.target.value)} className={inputCls} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field label="NIT o Cédula (sin DV) *" error={showErr('nit_cedula', form.nit_cedula)}>
                    <input type="text" inputMode="numeric" value={form.nit_cedula} onChange={e => setNit(e.target.value)} className={inputCls} placeholder="900123456" />
                  </Field>
                </div>
                <Field label="DV (auto)">
                  <input type="text" value={form.dv} readOnly title="Dígito de verificación calculado" className={inputCls + ' bg-gray-100 text-gray-600 text-center'} placeholder="—" />
                </Field>
              </div>
              <Field label="Correo electrónico *" error={showErr('email', form.email)}>
                <input title="Correo electrónico" type="email" value={form.email} onChange={e => f('email', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Teléfono">
                <input title="Teléfono" type="text" value={form.phone} onChange={e => f('phone', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Dirección *" error={showErr('address', form.address)}>
                <input title="Dirección" type="text" value={form.address} onChange={e => f('address', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Ciudad (código DIAN)">
                <select title="Ciudad" value={form.city_code} onChange={e => f('city_code', e.target.value)} className={inputCls}>
                  {CITY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
                </select>
              </Field>
              <Field label="Esquema tributario">
                <select title="Esquema tributario" value={form.tax_scheme} onChange={e => f('tax_scheme', e.target.value)} className={inputCls}>
                  {TAX_SCHEMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Régimen fiscal">
                <select title="Régimen fiscal" value={form.fiscal_regimen} onChange={e => f('fiscal_regimen', e.target.value)} className={inputCls}>
                  {FISCAL_REGIMENS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
              <Field label="🧭 Indicaciones de llegada (para el aseador)">
                <textarea
                  title="Indicaciones de llegada"
                  value={form.indicaciones}
                  onChange={e => f('indicaciones', e.target.value)}
                  rows={3}
                  placeholder="Ej: Edificio Torre 2, apto 504. Portería pide cédula. Timbre 504B. Parqueadero de visitantes a la derecha."
                  className={inputCls + ' resize-none'}
                />
                <p className="text-xs text-gray-600 mt-1">Cómo llegar a la casa: puntos de referencia, portería, timbre, parqueadero, etc.</p>
              </Field>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={loading || !isValid} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const inputCls = 'w-full border border-gray-400 rounded-lg px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500'

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-base font-semibold text-gray-800 mb-1">{label}</label>
      {children}
      {error && <p className="text-sm text-red-700 mt-1">{error}</p>}
    </div>
  )
}
