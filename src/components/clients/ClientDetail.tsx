'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import Avatar from '@/components/ui/Avatar'
import { calcularDV } from '@/lib/dian/dv'
import { formatCOP } from '@/lib/format'
import { cityName } from '@/lib/dian/cities'
import { CITY_OPTIONS, TAX_SCHEMES, FISCAL_REGIMENS, CUSTOMER_TYPES, ORIGENES, NATURALEZAS, deriveCompanyName } from '@/lib/clients'
import type { Client, ClientAddress, Service, Invoice } from '@/types/database'

const SERVICE_STATUS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Agendado', cls: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completado', cls: 'bg-green-100 text-green-700' },
  canceled: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
}
const PAY_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'bg-gray-100 text-gray-600' },
  processing: { label: 'Procesando', cls: 'bg-amber-100 text-amber-700' },
  signed: { label: 'Firmada', cls: 'bg-blue-100 text-blue-700' },
  sent_dian: { label: 'Enviada DIAN', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rechazada', cls: 'bg-red-100 text-red-700' },
}
const input = 'w-full border border-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-CO') : '—'

const TABS = [
  { id: 'datos', label: 'Datos' },
  { id: 'direcciones', label: 'Direcciones' },
  { id: 'servicios', label: 'Histórico de Servicios' },
  { id: 'pagos', label: 'Últimos Pagos' },
] as const

interface Props {
  client: Client
  addresses: ClientAddress[]
  services: Service[]
  invoices: Invoice[]
  photoUrl: string | null
}

const emptyAddr = { label: '', address: '', city_code: '11001', indicaciones: '', is_primary: false }

export default function ClientDetail({ client, addresses: initialAddr, services, invoices, photoUrl }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const { toast, confirm } = useUI()
  const [tab, setTab] = useState<typeof TABS[number]['id']>('datos')
  const [photo, setPhoto] = useState<string | null>(photoUrl)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [addresses, setAddresses] = useState(initialAddr)

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
            {t.label}{t.id === 'servicios' ? ` (${services.length})` : t.id === 'pagos' ? ` (${invoices.length})` : t.id === 'direcciones' ? ` (${addresses.length})` : ''}
          </button>
        ))}
      </div>

      {/* ── DATOS ── */}
      {tab === 'datos' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-4 mb-4">
            <Avatar name={displayName} url={photoFile ? URL.createObjectURL(photoFile) : photo} size="lg" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto</label>
              <input type="file" title="Foto del cliente" accept="image/png,image/jpeg,image/webp" onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} className="text-sm" />
              <p className="text-xs text-gray-500 mt-0.5">JPG, PNG o WEBP (máx 2 MB). Se sube al guardar.</p>
            </div>
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

      {/* ── HISTÓRICO DE SERVICIOS ── */}
      {tab === 'servicios' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
              <th className="text-left px-4 py-3">Fecha</th><th className="text-left px-4 py-3">Auxiliar</th>
              <th className="text-left px-4 py-3">Estado</th><th className="text-right px-4 py-3">Precio</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {services.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-gray-500">Sin servicios.</td></tr>}
              {services.map(s => (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-gray-600">{new Date(s.start_time).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="px-4 py-3 text-gray-700">{(s.cleaners as { full_name?: string } | undefined)?.full_name ?? '—'}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SERVICE_STATUS[s.status]?.cls ?? ''}`}>{SERVICE_STATUS[s.status]?.label ?? s.status}</span></td>
                  <td className="px-4 py-3 text-right font-medium">{formatCOP(Number(s.price_cop))}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* ── ÚLTIMOS PAGOS ── */}
      {tab === 'pagos' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
              <th className="text-left px-4 py-3">N° Factura</th><th className="text-left px-4 py-3">Fecha</th>
              <th className="text-right px-4 py-3">Total</th><th className="text-left px-4 py-3">Estado</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-gray-500">Sin facturas.</td></tr>}
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number ?? 'BORRADOR'}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(inv.issue_date)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCOP(Number(inv.total_amount))}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAY_STATUS[inv.billing_status]?.cls ?? ''}`}>{PAY_STATUS[inv.billing_status]?.label ?? inv.billing_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

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
