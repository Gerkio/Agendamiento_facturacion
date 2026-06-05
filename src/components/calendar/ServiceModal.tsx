'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import CleanerHojaDeVida from '@/components/cleaners/CleanerHojaDeVida'
import MultiDatePicker from './MultiDatePicker'
import MapEmbed from '@/components/map/MapEmbed'
import WhatsAppButton from '@/components/whatsapp/WhatsAppButton'
import { fullAddress, mapsDirLink } from '@/lib/maps'
import { buildAuxiliarAppointmentMessage } from '@/lib/whatsapp'
import { formatCOP, fmtDate } from '@/lib/format'
import {
  SEGMENTS, hhmm, scheduleLabel, addMinutesToTime, formatDuration,
  TURNOS, turnoLabel, tipoToTurno, SERVICE_CLASSES, FORMA_PAGO_OPTIONS,
} from '@/lib/service-catalog'
import type { Service, Client, Cleaner, ServiceCatalog } from '@/types/database'

interface Props {
  service: Service | null
  isNew: boolean
  /** Fecha/hora sugerida al crear (desde el clic en el calendario). */
  defaultStart: Date | null
  /** Servicios existentes, para avisar de cruces en vivo. */
  services: Service[]
  /** Listas precargadas desde el servidor (evita pedirlas en cada apertura). */
  clients: Client[]
  cleaners: Cleaner[]
  /** Catálogo de servicios para prellenar jornada/duración/precio sin reescribir. */
  catalog?: ServiceCatalog[]
  /** Auxiliar preseleccionado al crear desde una celda de la matriz. */
  defaultCleanerId?: string | null
  onClose: () => void
}

const input ='w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

const pad = (n: number) => String(n).padStart(2, '0')
const dateOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export default function ServiceModal({ service, isNew, defaultStart, services, clients, cleaners, catalog = [], defaultCleanerId, onClose }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const { toast, confirm } = useUI()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const base = useMemo(() => defaultStart ?? new Date(), [defaultStart])
  const startD = service ? new Date(service.start_time) : base
  const endD = service ? new Date(service.end_time) : new Date(base.getTime() + 4 * 3600_000)

  const [form, setForm] = useState({
    client_id: service?.client_id ?? '',
    cleaner_id: service?.cleaner_id ?? defaultCleanerId ?? '',
    date: dateOf(startD),
    entrada: timeOf(startD),
    salida: timeOf(endD),
    turno: service?.turno ?? '',
    price_cop: service?.price_cop?.toString() ?? '',
    status: service?.status ?? 'scheduled',
    service_type: service?.service_type ?? '',
    service_class: service?.service_class ?? 'Normal',
    recargo_dominical: service?.recargo_dominical ?? false,
    forma_pago: service?.forma_pago ?? clients.find(c => c.id === service?.client_id)?.forma_pago ?? '',
    obs_auxiliar: service?.obs_auxiliar ?? '',
    obs_internas: service?.obs_internas ?? '',
    catalog_id: service?.catalog_id ?? '',
  })

  const [showHoja, setShowHoja] = useState(false)
  const [showClientInfo, setShowClientInfo] = useState(false)
  const [showResumen, setShowResumen] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showRoute, setShowRoute] = useState(false)
  const [updatingReq, setUpdatingReq] = useState(false)
  // Días adicionales (además de la Fecha base) para agendar el mismo servicio.
  const [extraDates, setExtraDates] = useState<string[]>([])

  const selectedClient = clients.find(c => c.id === form.client_id)
  const selectedCleaner = cleaners.find(c => c.id === form.cleaner_id)
  // Todos los días a agendar: la fecha base + los adicionales (sin duplicar).
  const allDates = useMemo(
    () => Array.from(new Set([form.date, ...extraDates])).sort(),
    [form.date, extraDates],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k: keyof typeof form, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  // Catálogo activo, agrupado por grupo (Hogar/Empresa) para el selector.
  const catalogGroups = useMemo(() => {
    const active = catalog.filter(c => c.is_active)
    return SEGMENTS.map(seg => ({ seg, items: active.filter(c => c.segment === seg.value) })).filter(g => g.items.length)
  }, [catalog])

  // Elegir un servicio del catálogo: prellena turno, horario, precio y tipo.
  function applyCatalog(id: string) {
    const c = catalog.find(x => x.id === id)
    setForm(f => {
      if (!c) return { ...f, catalog_id: '' }
      return {
        ...f,
        catalog_id: id,
        turno: tipoToTurno(c.tipo),
        entrada: hhmm(c.start_time),
        salida: addMinutesToTime(c.start_time, c.duration_minutes),
        price_cop: String(c.price_cop),
        service_type: c.name,
      }
    })
  }

  // Turno: aplica el horario por defecto (Entrada/Salida) del turno elegido.
  function onTurnoChange(v: string) {
    const t = TURNOS.find(x => x.value === v)
    setForm(f => (t ? { ...f, turno: v, entrada: t.entrada, salida: t.salida } : { ...f, turno: v }))
  }

  // Cliente: si aún no hay forma de pago, hereda la del cliente.
  function onClientChange(id: string) {
    const c = clients.find(x => x.id === id)
    setForm(f => ({ ...f, client_id: id, forma_pago: f.forma_pago || c?.forma_pago || '' }))
  }

  const durationMins = useMemo(() => {
    const a = new Date(`${form.date}T${form.entrada}`).getTime()
    const b = new Date(`${form.date}T${form.salida}`).getTime()
    if (isNaN(a) || isNaN(b) || b <= a) return 0
    return Math.round((b - a) / 60000)
  }, [form.date, form.entrada, form.salida])

  const endBeforeStart = !!form.entrada && !!form.salida && durationMins <= 0

  const conflict = useMemo(() => {
    if (!form.cleaner_id || !form.entrada || !form.salida) return null
    const s = new Date(`${form.date}T${form.entrada}`).getTime()
    const e = new Date(`${form.date}T${form.salida}`).getTime()
    if (isNaN(s) || isNaN(e) || e <= s) return null
    for (const sv of services) {
      if (sv.id === service?.id) continue
      if (sv.cleaner_id !== form.cleaner_id) continue
      if (sv.status === 'canceled') continue
      const a = new Date(sv.start_time).getTime()
      const b = new Date(sv.end_time).getTime()
      if (s < b && a < e) return sv
    }
    return null
  }, [form.cleaner_id, form.date, form.entrada, form.salida, services, service?.id])

  function commonFields() {
    return {
      service_type: form.service_type || null,
      service_class: form.service_class,
      turno: form.turno || null,
      recargo_dominical: form.recargo_dominical,
      forma_pago: form.forma_pago || selectedClient?.forma_pago || null,
      catalog_id: form.catalog_id || null,
      obs_auxiliar: form.obs_auxiliar || null,
      obs_internas: form.obs_internas || null,
    }
  }

  async function handleSave() {
    if (endBeforeStart) { setError('La hora de salida debe ser posterior a la de entrada.'); return }
    setLoading(true)
    setError(null)
    try {
      const startISO = new Date(`${form.date}T${form.entrada}`).toISOString()
      const endISO = new Date(`${form.date}T${form.salida}`).toISOString()
      const price = parseFloat(form.price_cop) || 0
      const extra = commonFields()

      if (isNew) {
        // Un servicio por cada día seleccionado (fecha base + adicionales).
        const multi = allDates.length > 1
        const groupId = multi ? crypto.randomUUID() : null
        const rows = allDates.map(d => {
          const s = new Date(`${d}T${form.entrada}`)
          const e = new Date(`${d}T${form.salida}`)
          return {
            client_id: form.client_id,
            cleaner_id: form.cleaner_id,
            start_time: s.toISOString(),
            end_time: e.toISOString(),
            price_cop: price,
            status: 'scheduled',
            is_recurring: multi,
            recurrence_group_id: groupId,
            ...extra,
          }
        })
        const { error } = await supabase.from('services').insert(rows)
        if (error) throw error
      } else if (service) {
        const { error } = await supabase.from('services').update({
          client_id: form.client_id,
          cleaner_id: form.cleaner_id,
          start_time: startISO,
          end_time: endISO,
          price_cop: price,
          status: form.status as Service['status'],
          ...extra,
        }).eq('id', service.id)
        if (error) throw error
      }
      toast(isNew ? 'Servicio agendado.' : 'Servicio actualizado.', 'success')
      onClose()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
      setLoading(false)
    }
  }

  async function handleFinalize() {
    if (!service) return
    const ok = await confirm({ title: 'Finalizar servicio', message: '¿Marcar este servicio como completado (listo para facturar)?', confirmLabel: 'Finalizar' })
    if (!ok) return
    setLoading(true)
    const { error } = await supabase.from('services').update({ status: 'completed' }).eq('id', service.id)
    setLoading(false)
    if (error) { toast('No se pudo finalizar: ' + error.message, 'error'); return }
    toast('Servicio finalizado.', 'success')
    onClose()
    router.refresh()
  }

  async function handleCancelService() {
    if (!service) return
    const ok = await confirm({ title: 'Cancelar servicio', message: '¿Marcar este servicio como cancelado?', confirmLabel: 'Sí, cancelar', danger: true })
    if (!ok) return
    setLoading(true)
    await supabase.from('services').update({ status: 'canceled' }).eq('id', service.id)
    toast('Servicio cancelado.', 'success')
    onClose()
    router.refresh()
  }

  // Actualiza solo las observaciones de un servicio existente.
  async function handleUpdateRequisitos() {
    if (!service) return
    setUpdatingReq(true)
    const { error } = await supabase.from('services').update({
      obs_auxiliar: form.obs_auxiliar || null,
      obs_internas: form.obs_internas || null,
    }).eq('id', service.id)
    setUpdatingReq(false)
    if (error) { toast('No se pudo actualizar: ' + error.message, 'error'); return }
    toast('Requisitos actualizados.', 'success')
  }

  const noClients = clients.length === 0
  const noCleaners = cleaners.length === 0
  const canSave = !!form.client_id && !!form.cleaner_id && !endBeforeStart && !loading
  const durationLabel = durationMins > 0 ? formatDuration(durationMins) : null

  return (
    <>
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md md:max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">{isNew ? '🗓️ Nuevo servicio' : 'Servicio agendado'}</h2>
            {selectedCleaner && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-gray-600 truncate">{selectedCleaner.full_name}</span>
                <button type="button" onClick={() => setShowHoja(true)} className="text-xs px-2 py-0.5 rounded border border-brand-300 text-brand-700 hover:bg-brand-50 whitespace-nowrap">📇 Hoja de vida</button>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {(noClients || noCleaners) && (
            <div className="md:col-span-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
              {noClients && <p>Primero crea al menos un <strong>cliente</strong> (menú Clientes).</p>}
              {noCleaners && <p>Primero crea al menos un <strong>auxiliar</strong> (menú Auxiliares).</p>}
            </div>
          )}

          {/* Cliente */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Cliente</label>
              {selectedClient && (
                <button type="button" onClick={() => setShowClientInfo(true)} className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">ℹ️ Info</button>
              )}
            </div>
            <select title="Cliente" value={form.client_id} onChange={e => onClientChange(e.target.value)} className={input}>
              <option value="">Elige un cliente…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>

          {/* Auxiliar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">¿Quién lo realiza?</label>
            <select title="Auxiliar" value={form.cleaner_id} onChange={e => set('cleaner_id', e.target.value)} className={input}>
              <option value="">Elige un auxiliar…</option>
              {cleaners.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>

          {/* Tipo Servicio (catálogo) */}
          {catalogGroups.length > 0 && (
            <div className="md:col-span-2 bg-brand-50 border border-brand-200 rounded-lg p-3">
              <label className="block text-sm font-medium text-brand-800 mb-1">🧰 Tipo de servicio (catálogo)</label>
              <select title="Tipo de servicio" value={form.catalog_id} onChange={e => applyCatalog(e.target.value)} className={input}>
                <option value="">— Personalizado / Otro valor —</option>
                {catalogGroups.map(g => (
                  <optgroup key={g.seg.value} label={g.seg.label}>
                    {g.items.map(c => (
                      <option key={c.id} value={c.id}>{c.name} — {formatCOP(Number(c.price_cop))} · {scheduleLabel(c.start_time, c.duration_minutes)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="text-xs text-gray-600 mt-1">Prellena turno, horario, valor y tipo. Elige «Personalizado» para fijar otro valor manualmente.</p>
            </div>
          )}

          {/* Turno */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Turno</label>
            <select title="Turno" value={form.turno} onChange={e => onTurnoChange(e.target.value)} className={input}>
              <option value="">— Sin turno —</option>
              {TURNOS.map(t => <option key={t.value} value={t.value}>{t.label} ({t.entrada}–{t.salida})</option>)}
            </select>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📅 Fecha</label>
            <input title="Fecha" type="date" value={form.date} onChange={e => set('date', e.target.value)} className={input} />
          </div>

          {/* Horario */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">🕐 Horario</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-16">Entrada</span>
                <input title="Hora de entrada" type="time" value={form.entrada} onChange={e => setForm(f => ({ ...f, entrada: e.target.value, turno: '' }))} className={input} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-12">Salida</span>
                <input title="Hora de salida" type="time" value={form.salida} onChange={e => setForm(f => ({ ...f, salida: e.target.value, turno: '' }))} className={input} />
              </div>
            </div>
            {endBeforeStart
              ? <p className="text-xs text-red-600 mt-1">La salida debe ser posterior a la entrada.</p>
              : durationLabel && <p className="text-xs text-gray-500 mt-1">Duración: <strong>{durationLabel}</strong></p>}
          </div>

          {/* Tipo (clasificación) */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {SERVICE_CLASSES.map(c => (
                <label key={c} className="inline-flex items-center gap-1.5 text-sm">
                  <input type="radio" name="service_class" checked={form.service_class === c} onChange={() => set('service_class', c)} /> {c}
                </label>
              ))}
            </div>
          </div>

          {/* Recargo + Forma de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pago</label>
            <select title="Forma de pago" value={form.forma_pago} onChange={e => set('forma_pago', e.target.value)} className={input}>
              <option value="">— Sin definir —</option>
              {FORMA_PAGO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              {form.forma_pago && !FORMA_PAGO_OPTIONS.includes(form.forma_pago) && <option value={form.forma_pago}>{form.forma_pago}</option>}
            </select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm border border-gray-300 rounded-lg px-3 py-2.5 w-full">
              <input type="checkbox" checked={form.recargo_dominical} onChange={e => set('recargo_dominical', e.target.checked)} className="rounded" />
              Recargo dominical o festivo
            </label>
          </div>

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor del servicio (COP)</label>
            <input type="number" inputMode="numeric" value={form.price_cop} onChange={e => set('price_cop', e.target.value)} className={input} placeholder="Ej: 150000" />
            {form.service_type && <p className="text-xs text-gray-500 mt-1">{form.service_type}</p>}
          </div>

          {/* Periodicidad: calendario para repetir en varios días (opcional) */}
          {isNew ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Periodicidad (opcional)</label>
              <button type="button" onClick={() => setShowDatePicker(true)} className={input + ' text-left flex items-center justify-between hover:bg-gray-50'}>
                <span className={extraDates.length ? 'text-gray-800' : 'text-gray-500'}>
                  {extraDates.length ? `${allDates.length} días seleccionados` : 'Solo la fecha indicada'}
                </span>
                <span>📅</span>
              </button>
              {extraDates.length > 0 && (
                <>
                  <p className="text-xs text-gray-500 mt-1">
                    + {extraDates.length} día(s) adicional(es).{' '}
                    <button type="button" onClick={() => setExtraDates([])} className="text-red-500 hover:underline">Quitar</button>
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">⚠️ El aviso de cruce solo cubre la fecha base; revisa los días adicionales.</p>
                </>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Periodicidad</label>
              <input title="Periodicidad" type="text" readOnly value={service?.is_recurring ? 'Recurrente (servicio fijo)' : 'Una sola vez'} className={input + ' bg-gray-100 text-gray-600'} />
            </div>
          )}

          {/* Dirección + indicaciones del cliente (solo lectura) + ruta */}
          {selectedClient && (
            <div className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
              <div><span className="text-gray-500">📍 Dirección:</span> <span className="text-gray-800">{selectedClient.address || '—'}</span></div>
              {selectedClient.indicaciones && <div className="mt-1 text-brand-700">🧭 {selectedClient.indicaciones}</div>}
              {selectedClient.address && (
                <div className="mt-2">
                  <button type="button" onClick={() => setShowRoute(v => !v)} className="text-xs px-2 py-1 rounded border border-brand-300 text-brand-700 hover:bg-brand-50">
                    {showRoute ? 'Ocultar ruta' : '🚌 Ver ruta (transporte público)'}
                  </button>
                  {showRoute && (
                    <div className="mt-2">
                      <MapEmbed
                        mode="directions"
                        origin={fullAddress(selectedCleaner?.address)}
                        destination={fullAddress(selectedClient.address, selectedClient.city_code)}
                        title="Ruta auxiliar → cliente"
                      />
                      {!selectedCleaner?.address && <p className="text-xs text-amber-600 mt-1">El auxiliar no tiene dirección registrada: se muestra solo la ubicación del cliente.</p>}
                    </div>
                  )}
                </div>
              )}
              {selectedCleaner?.phone ? (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <WhatsAppButton
                    phone={selectedCleaner.phone}
                    message={buildAuxiliarAppointmentMessage({
                      clientName: selectedClient.company_name,
                      fecha: fmtDate(form.date),
                      entrada: form.entrada,
                      salida: form.salida,
                      turnoLabel: form.turno ? turnoLabel(form.turno) : '',
                      serviceType: form.service_type,
                      addressFull: fullAddress(selectedClient.address, selectedClient.city_code),
                      indicaciones: selectedClient.indicaciones ?? undefined,
                      routeLink: mapsDirLink(fullAddress(selectedCleaner.address), fullAddress(selectedClient.address, selectedClient.city_code)),
                    })}
                    label="Enviar agendamiento al auxiliar (WhatsApp)"
                  />
                  <p className="text-xs text-gray-500 mt-1">Abre WhatsApp Web con el mensaje listo; solo presiona Enter para enviarlo.</p>
                </div>
              ) : selectedCleaner && (
                <p className="text-xs text-amber-600 mt-3">El auxiliar no tiene teléfono registrado para WhatsApp.</p>
              )}
            </div>
          )}

          {/* Requisitos */}
          <div className="md:col-span-2 border border-gray-200 rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold text-gray-700">📋 Requisitos del servicio</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones para el auxiliar (las verá el aseador)</label>
              <textarea value={form.obs_auxiliar} onChange={e => set('obs_auxiliar', e.target.value)} rows={2} className={input + ' resize-none'} placeholder="Ej: Traer escalera; usar el portón lateral." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones internas (solo administración)</label>
              <textarea value={form.obs_internas} onChange={e => set('obs_internas', e.target.value)} rows={2} className={input + ' resize-none'} placeholder="Notas internas; el aseador NO las ve." />
            </div>
            {!isNew && (
              <button type="button" onClick={handleUpdateRequisitos} disabled={updatingReq}
                className="w-full text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {updatingReq ? 'Actualizando…' : '🔄 Actualizar Requisitos'}
              </button>
            )}
          </div>

          {conflict && (
            <div className="md:col-span-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm flex items-start gap-2">
              <span>⚠️</span>
              <span>Este auxiliar ya tiene un servicio que se cruza: <strong>{(conflict.clients as { company_name?: string } | undefined)?.company_name ?? 'otro cliente'}</strong> el {new Date(conflict.start_time).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}. Puedes guardar igual, pero quedará marcado en rojo.</span>
            </div>
          )}

          {/* Finalizar (servicio existente aún agendado) */}
          {!isNew && form.status === 'scheduled' && (
            <button type="button" onClick={handleFinalize} disabled={loading}
              className="md:col-span-2 px-4 py-2.5 rounded-lg text-sm bg-brand-600 text-white font-medium hover:bg-brand-700 transition disabled:opacity-50">
              ✅ Finalizar servicio (listo para facturar)
            </button>
          )}

          {(form.client_id && form.cleaner_id) && (
            <button type="button" onClick={() => setShowResumen(true)} className="md:col-span-2 text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
              👁️ Mostrar resumen del servicio
            </button>
          )}

          {error && <div className="md:col-span-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
        </div>

        <div className="flex items-center justify-between p-5 border-t gap-3 sticky bottom-0 bg-white">
          {!isNew ? (
            <button type="button" onClick={handleCancelService} disabled={loading} className="px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition disabled:opacity-50">
              Cancelar servicio
            </button>
          ) : <span />}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 transition">Cerrar</button>
            <button type="button" onClick={handleSave} disabled={!canSave} className="px-5 py-2.5 rounded-lg text-sm bg-brand-600 text-white font-medium hover:bg-brand-700 transition disabled:opacity-50">
              {loading ? 'Guardando…' : isNew ? (allDates.length > 1 ? `Agendar ${allDates.length} días` : 'Agendar') : 'Modificar servicio'}
            </button>
          </div>
        </div>
      </div>
    </div>

    {showHoja && selectedCleaner && (
      <CleanerHojaDeVida cleaner={selectedCleaner} onClose={() => setShowHoja(false)} />
    )}

    {showDatePicker && (
      <MultiDatePicker
        selected={extraDates}
        baseDate={form.date}
        onChange={setExtraDates}
        onClose={() => setShowDatePicker(false)}
      />
    )}

    {showClientInfo && selectedClient && (
      <div onClick={() => setShowClientInfo(false)} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
        <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b">
            <h2 className="text-lg font-semibold">{selectedClient.company_name}</h2>
            <button type="button" onClick={() => setShowClientInfo(false)} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
          </div>
          <div className="p-5 space-y-2 text-sm">
            <p><span className="text-gray-500">NIT/CC:</span> {selectedClient.nit_cedula}-{selectedClient.dv}</p>
            <p><span className="text-gray-500">Dirección:</span> {selectedClient.address}</p>
            <p><span className="text-gray-500">Teléfono:</span> {selectedClient.phone ?? '—'}</p>
            <p><span className="text-gray-500">Correo:</span> {selectedClient.email}</p>
            <p><span className="text-gray-500">Forma de pago:</span> {selectedClient.forma_pago || '—'}</p>
            {selectedClient.indicaciones && (
              <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 mt-2">
                <div className="text-xs font-semibold text-brand-700 mb-1">🧭 Indicaciones de llegada</div>
                <p className="text-gray-800 whitespace-pre-wrap">{selectedClient.indicaciones}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {showResumen && (
      <div onClick={() => setShowResumen(false)} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
        <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b">
            <h2 className="text-lg font-semibold">Resumen del servicio</h2>
            <button type="button" onClick={() => setShowResumen(false)} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
          </div>
          <div className="p-5 space-y-2 text-sm">
            <ResumenRow k="Cliente" v={selectedClient?.company_name ?? '—'} />
            <ResumenRow k="Auxiliar" v={selectedCleaner?.full_name ?? '—'} />
            <ResumenRow k="Fecha" v={new Date(`${form.date}T00:00:00`).toLocaleDateString('es-CO', { dateStyle: 'full' })} />
            <ResumenRow k="Turno" v={form.turno ? turnoLabel(form.turno) : '—'} />
            <ResumenRow k="Entrada / Salida" v={`${form.entrada} – ${form.salida}`} />
            <ResumenRow k="Duración" v={durationLabel ?? '—'} />
            <ResumenRow k="Tipo de servicio" v={form.service_type || '—'} />
            <ResumenRow k="Tipo" v={form.service_class} />
            {form.recargo_dominical && <ResumenRow k="Recargo" v="Dominical o festivo" />}
            <ResumenRow k="Periodicidad" v={isNew ? (allDates.length > 1 ? `${allDates.length} días` : 'Una sola vez') : (service?.is_recurring ? 'Recurrente (fijo)' : 'Una sola vez')} />
            <ResumenRow k="Forma de pago" v={form.forma_pago || selectedClient?.forma_pago || '—'} />
            <ResumenRow k="Valor" v={form.price_cop ? formatCOP(Number(form.price_cop)) : '—'} />
            <ResumenRow k="Dirección" v={selectedClient?.address ?? '—'} />
            {form.obs_auxiliar && <ResumenRow k="Obs. auxiliar" v={form.obs_auxiliar} />}
          </div>
        </div>
      </div>
    )}
    </>
  )
}

function ResumenRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-gray-500 min-w-[120px]">{k}:</span>
      <span className="text-gray-800 flex-1">{v}</span>
    </div>
  )
}
