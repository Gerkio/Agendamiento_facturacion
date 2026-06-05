'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import Avatar from '@/components/ui/Avatar'
import { calcularDV } from '@/lib/dian/dv'
import { cityName } from '@/lib/dian/cities'
import { fullAddress } from '@/lib/maps'
import MapEmbed from '@/components/map/MapEmbed'
import { CITY_OPTIONS, TAX_SCHEMES, FISCAL_REGIMENS, CUSTOMER_TYPES, ORIGENES, NATURALEZAS, deriveCompanyName } from '@/lib/clients'
import type { Client, ClientAddress } from '@/types/database'

const input = 'w-full border border-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

const TABS = [
  { id: 'datos', label: 'Datos' },
  { id: 'direcciones', label: 'Direcciones' },
  { id: 'servicios', label: 'Histórico de Servicios' },
  { id: 'pagos', label: 'Últimos Pagos' },
] as const

interface Props {
  client: Client
  addresses: ClientAddress[]
  /** Conteos para los badges de las pestañas (los datos viven en los nodos server). */
  servicesCount: number
  invoicesCount: number
  /** Pestañas de solo-lectura renderizadas en el servidor. */
  serviciosTab: React.ReactNode
  pagosTab: React.ReactNode
  photoUrl: string | null
}

const emptyAddr = { label: '', address: '', city_code: '11001', indicaciones: '', is_primary: false }

export default function ClientDetail({ client, addresses: initialAddr, servicesCount, invoicesCount, serviciosTab, pagosTab, photoUrl }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const { toast, confirm } = useUI()
  const [tab, setTab] = useState<typeof TABS[number]['id']>('datos')
  const [photo, setPhoto] = useState<string | null>(photoUrl)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [addresses, setAddresses] = useState(initialAddr)
  const [mapQuery, setMapQuery] = useState('')

  const [form, setForm] = useState({
    naturaleza: client.naturaleza ?? 'juridica',
    company_name: client.company_name ?? '',
    first_name: client.first_name ?? '', second_name: client.second_name ?? '',
    first_surname: client.first_surname ?? '', second_surname: client.second_surname ?? '',
    nit_cedula: client.nit_cedula ?? '', dv: client.dv ?? '',
    email: client.email ?? '', phone: client.phone ?? '', phone2: client.phone2 ?? '',
    address: client.address ?? '', city_code: client.city_code ?? '11001',
    tax_scheme: client.tax_scheme ?? '01', fiscal_regimen: client.fiscal_regimen ?? 'R-99-PN',
    indicaciones: client.indicaciones ?? '', forma_pago: client.forma_pago ?? '',
    observaciones: client.observaciones ?? '', sucursal: client.sucursal ?? '05001',
    customer_type: client.customer_type ?? 'Hogar', origen: client.origen ?? 'Referido',
    is_active: client.is_active ?? true,
  })
  const set = (k: keyof typeof form, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))
  const setNit = (v: string) => setForm(p => ({ ...p, nit_cedula: v, dv: calcularDV(v) }))
  const displayName = deriveCompanyName(form) || client.company_name

  async function uploadPhoto() {
    if (!photoFile) return true
    const fd = new FormData(); fd.append('photo', photoFile)
    const res = await fetch(`/api/clients/${client.id}/photo`, { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok && data.signedUrl) { setPhoto(data.signedUrl); setPhotoFile(null); return true }
    toast('La foto no se subió: ' + (data.error ?? ''), 'error'); return false
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setSaving(false); toast('No se pudo guardar: ' + (data.error ?? ''), 'error'); return }
    await uploadPhoto()
    setSaving(false)
    toast('Cliente actualizado.', 'success')
    router.refresh()
  }

  async function handleDelete() {
    const ok = await confirm({ title: 'Eliminar cliente', message: `¿Eliminar a "${displayName}"? Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    const { error } = await supabase.from('clients').delete().eq('id', client.id)
    if (error) { toast('No se pudo eliminar: ' + error.message, 'error'); return }
    toast('Cliente eliminado.', 'success')
    router.push('/dashboard/clients')
  }

  // ── Direcciones ──
  const [addrModal, setAddrModal] = useState(false)
  const [addrEditing, setAddrEditing] = useState<ClientAddress | null>(null)
  const [addrForm, setAddrForm] = useState({ ...emptyAddr })
  const af = (k: keyof typeof addrForm, v: string | boolean) => setAddrForm(p => ({ ...p, [k]: v }))

  function openAddr(a?: ClientAddress) {
    setAddrEditing(a ?? null)
    setAddrForm(a ? { label: a.label ?? '', address: a.address, city_code: a.city_code, indicaciones: a.indicaciones ?? '', is_primary: a.is_primary } : { ...emptyAddr })
    setAddrModal(true)
  }

  async function saveAddr() {
    const payload = { client_id: client.id, label: addrForm.label || null, address: addrForm.address, city_code: addrForm.city_code, indicaciones: addrForm.indicaciones || null, is_primary: addrForm.is_primary }
    if (!payload.address.trim()) { toast('La dirección es obligatoria.', 'error'); return }
    // Si se marca primaria, desmarcar las demás antes (índice único parcial).
    if (addrForm.is_primary) await supabase.from('client_addresses').update({ is_primary: false }).eq('client_id', client.id).neq('id', addrEditing?.id ?? '00000000-0000-0000-0000-000000000000')
    if (addrEditing) {
      const { data, error } = await supabase.from('client_addresses').update(payload).eq('id', addrEditing.id).select().single()
      if (error) { toast('Error: ' + error.message, 'error'); return }
      setAddresses(prev => prev.map(a => a.id === addrEditing.id ? data : a).map(a => addrForm.is_primary && a.id !== addrEditing.id ? { ...a, is_primary: false } : a))
    } else {
      const { data, error } = await supabase.from('client_addresses').insert(payload).select().single()
      if (error) { toast('Error: ' + error.message, 'error'); return }
      setAddresses(prev => [...prev.map(a => addrForm.is_primary ? { ...a, is_primary: false } : a), data])
    }
    setAddrModal(false)
    toast('Dirección guardada.', 'success')
  }

  async function deleteAddr(a: ClientAddress) {
    const ok = await confirm({ title: 'Eliminar dirección', message: '¿Eliminar esta dirección?', confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    const { error } = await supabase.from('client_addresses').delete().eq('id', a.id)
    if (error) { toast('No se pudo eliminar: ' + error.message, 'error'); return }
    setAddresses(prev => prev.filter(x => x.id !== a.id))
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Avatar name={displayName} url={photo} />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-800 truncate">{displayName}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${form.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{form.is_active ? 'Activo' : 'Inactivo'}</span>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => router.push('/dashboard/clients')} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">← Regresar</button>
          <button type="button" onClick={handleDelete} className="px-4 py-2 rounded-lg text-sm border border-red-300 text-red-600 hover:bg-red-50">🗑️ Eliminar</button>
          <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Guardando…' : '🔄 Actualizar Cliente'}</button>
        </div>
      </div>

      {/* Pestañas */}
      <div className="border-b border-gray-200 mb-4 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === t.id ? 'border-brand-600 text-brand-700 font-semibold' : 'border-transparent text-gray-600 hover:text-gray-800'}`}>
            {t.label}{t.id === 'servicios' ? ` (${servicesCount})` : t.id === 'pagos' ? ` (${invoicesCount})` : t.id === 'direcciones' ? ` (${addresses.length})` : ''}
          </button>
        ))}
      </div>

      {/* ── DATOS ── */}
      {tab === 'datos' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-4 mb-4">
            <label htmlFor="client-photo" className="relative group cursor-pointer shrink-0" title="Subir o cambiar foto">
              <Avatar name={displayName} url={photoFile ? URL.createObjectURL(photoFile) : photo} size="lg" />
              <span className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition" />
              <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm border-2 border-white shadow">📷</span>
            </label>
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1">Foto</span>
              <label htmlFor="client-photo" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-brand-300 text-brand-700 text-sm font-medium hover:bg-brand-50 cursor-pointer transition">
                📤 {(photoFile || photo) ? 'Cambiar foto' : 'Subir foto'}
              </label>
              {photoFile && <p className="text-xs text-green-600 mt-1 truncate max-w-[220px]">✓ {photoFile.name}</p>}
              <p className="text-xs text-gray-500 mt-1">JPG, PNG o WEBP (máx 2 MB). Se sube al guardar.</p>
            </div>
            <input id="client-photo" type="file" title="Foto del cliente" accept="image/png,image/jpeg,image/webp" onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} className="sr-only" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Sucursal">
              <select title="Sucursal" value={form.sucursal} onChange={e => set('sucursal', e.target.value)} className={input}>
                {CITY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Naturaleza">
              <select title="Naturaleza" value={form.naturaleza} onChange={e => set('naturaleza', e.target.value)} className={input}>
                {NATURALEZAS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </Field>

            {form.naturaleza === 'natural' ? (
              <>
                <Field label="Primer nombre *"><input title="Primer nombre" value={form.first_name} onChange={e => set('first_name', e.target.value)} className={input} /></Field>
                <Field label="Segundo nombre"><input title="Segundo nombre" value={form.second_name} onChange={e => set('second_name', e.target.value)} className={input} /></Field>
                <Field label="Primer apellido *"><input title="Primer apellido" value={form.first_surname} onChange={e => set('first_surname', e.target.value)} className={input} /></Field>
                <Field label="Segundo apellido"><input title="Segundo apellido" value={form.second_surname} onChange={e => set('second_surname', e.target.value)} className={input} /></Field>
              </>
            ) : (
              <Field label="Razón social *" full><input title="Razón social" value={form.company_name} onChange={e => set('company_name', e.target.value)} className={input} /></Field>
            )}

            <div className="grid grid-cols-3 gap-3 md:col-span-2">
              <div className="col-span-2">
                <Field label="NIT / Cédula *"><input title="NIT o Cédula" inputMode="numeric" value={form.nit_cedula} onChange={e => setNit(e.target.value)} className={input} placeholder="900123456" /></Field>
              </div>
              <Field label="DV"><input title="DV" value={form.dv} readOnly className={input + ' bg-gray-100 text-center'} /></Field>
            </div>

            <Field label="Dirección *" full><input title="Dirección" value={form.address} onChange={e => set('address', e.target.value)} className={input} /></Field>
            <Field label="Ciudad (DIAN)">
              <select title="Ciudad" value={form.city_code} onChange={e => set('city_code', e.target.value)} className={input}>
                {CITY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
              </select>
            </Field>
            <Field label="Estado">
              <select title="Estado" value={form.is_active ? '1' : '0'} onChange={e => set('is_active', e.target.value === '1')} className={input}>
                <option value="1">Activo</option><option value="0">Inactivo</option>
              </select>
            </Field>

            <div className="md:col-span-2">
              <button type="button" disabled={!form.address.trim()} onClick={() => setMapQuery(fullAddress(form.address, form.city_code))}
                className="text-sm px-3 py-2 rounded-lg border border-brand-300 text-brand-700 hover:bg-brand-50 disabled:opacity-50">
                🔍 Ver dirección en el mapa
              </button>
              {mapQuery && <div className="mt-2"><MapEmbed mode="place" q={mapQuery} title="Ubicación del cliente" /></div>}
            </div>

            <Field label="Teléfono 1"><input title="Teléfono 1" value={form.phone} onChange={e => set('phone', e.target.value)} className={input} /></Field>
            <Field label="Teléfono 2"><input title="Teléfono 2" value={form.phone2} onChange={e => set('phone2', e.target.value)} className={input} /></Field>
            <Field label="E-mail *" full><input title="E-mail" type="email" value={form.email} onChange={e => set('email', e.target.value)} className={input} /></Field>

            <Field label="Tipo">
              <select title="Tipo" value={form.customer_type} onChange={e => set('customer_type', e.target.value)} className={input}>
                {CUSTOMER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Origen">
              <select title="Origen" value={form.origen} onChange={e => set('origen', e.target.value)} className={input}>
                {ORIGENES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Forma de pago"><input title="Forma de pago" value={form.forma_pago} onChange={e => set('forma_pago', e.target.value)} className={input} placeholder="Ej: Crédito 30 días" /></Field>
            <Field label="Esquema tributario">
              <select title="Esquema tributario" value={form.tax_scheme} onChange={e => set('tax_scheme', e.target.value)} className={input}>
                {TAX_SCHEMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Régimen fiscal" full>
              <select title="Régimen fiscal" value={form.fiscal_regimen} onChange={e => set('fiscal_regimen', e.target.value)} className={input}>
                {FISCAL_REGIMENS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>

            <Field label="🧭 Indicaciones de llegada (para el aseador)" full>
              <textarea title="Indicaciones" value={form.indicaciones} onChange={e => set('indicaciones', e.target.value)} rows={2} className={input + ' resize-none'} placeholder="Portería, timbre, parqueadero…" />
            </Field>
            <Field label="Observaciones" full>
              <textarea title="Observaciones" value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2} className={input + ' resize-none'} placeholder="Notas internas del cliente" />
            </Field>
          </div>
        </div>
      )}

      {/* ── DIRECCIONES ── */}
      {tab === 'direcciones' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-gray-500">{addresses.length} dirección(es) adicional(es)</p>
            <button type="button" onClick={() => openAddr()} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700">+ Agregar dirección</button>
          </div>
          {addresses.length === 0 ? (
            <p className="text-sm text-gray-500 italic py-6 text-center">Sin direcciones adicionales. La dirección principal de facturación está en la pestaña Datos.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {addresses.map(a => (
                <div key={a.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-800 flex items-center gap-2">
                      {a.label || 'Dirección'}
                      {a.is_primary && <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 font-medium">Principal</span>}
                    </div>
                    <div className="text-sm text-gray-600">{a.address} · {cityName(a.city_code)}</div>
                    {a.indicaciones && <div className="text-xs text-brand-600 mt-0.5">🧭 {a.indicaciones}</div>}
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button type="button" onClick={() => openAddr(a)} className="text-brand-600 hover:underline text-xs">Editar</button>
                    <button type="button" onClick={() => deleteAddr(a)} className="text-red-500 hover:underline text-xs">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── HISTÓRICO DE SERVICIOS (server) ── */}
      {tab === 'servicios' && serviciosTab}

      {/* ── ÚLTIMOS PAGOS (server) ── */}
      {tab === 'pagos' && pagosTab}

      {/* Modal dirección */}
      {addrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{addrEditing ? 'Editar dirección' : 'Nueva dirección'}</h2>
              <button type="button" onClick={() => setAddrModal(false)} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="Etiqueta"><input title="Etiqueta" value={addrForm.label} onChange={e => af('label', e.target.value)} className={input} placeholder="Ej: Casa, Oficina" /></Field>
              <Field label="Dirección *"><input title="Dirección" value={addrForm.address} onChange={e => af('address', e.target.value)} className={input} /></Field>
              <Field label="Ciudad">
                <select title="Ciudad" value={addrForm.city_code} onChange={e => af('city_code', e.target.value)} className={input}>
                  {CITY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Indicaciones"><textarea title="Indicaciones" value={addrForm.indicaciones} onChange={e => af('indicaciones', e.target.value)} rows={2} className={input + ' resize-none'} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={addrForm.is_primary} onChange={e => af('is_primary', e.target.checked)} className="rounded" /> Marcar como principal</label>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button type="button" onClick={() => setAddrModal(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={saveAddr} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
