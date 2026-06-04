'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import CleanerHojaDeVida from '@/components/cleaners/CleanerHojaDeVida'
import { formatCOP } from '@/lib/format'
import { SEGMENTS, hhmm, scheduleLabel } from '@/lib/service-catalog'
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

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Una sola vez' },
  { value: 'daily', label: 'Cada día (8 veces)' },
  { value: 'weekly', label: 'Cada semana (8 veces)' },
  { value: 'biweekly', label: 'Cada 15 días (8 veces)' },
]

/** Date -> "YYYY-MM-DDTHH:mm" en hora LOCAL (lo que espera datetime-local). */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "YYYY-MM-DDTHH:mm" (local) -> ISO UTC para guardar en la BD. */
function toISO(localValue: string): string {
  return new Date(localValue).toISOString()
}

const input = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

// Franjas de hora cada 30 min (05:00–21:00) para el selector de inicio.
const TIME_SLOTS: string[] = (() => {
  const out: string[] = []
  for (let h = 5; h <= 21; h++) for (const m of ['00', '30']) out.push(`${String(h).padStart(2, '0')}:${m}`)
  return out
})()

// Turnos de un servicio de aseo (en minutos).
const DURATIONS: { mins: number; label: string }[] = [
  { mins: 120, label: 'Turno de prueba (2 horas)' },
  { mins: 240, label: 'Media jornada (4 horas)' },
  { mins: 450, label: 'Jornada completa (7 h 30 min)' },
]

const datePart = (local: string) => local.slice(0, 10)   // "YYYY-MM-DD"
const timePart = (local: string) => local.slice(11, 16)  // "HH:mm"

function addMinutesLocal(local: string, mins: number): string {
  const d = new Date(local)
  if (isNaN(d.getTime())) return local
  d.setMinutes(d.getMinutes() + mins)
  return toLocalInput(d)
}
function diffMinutes(startLocal: string, endLocal: string): number {
  const a = new Date(startLocal).getTime(), b = new Date(endLocal).getTime()
  if (isNaN(a) || isNaN(b)) return 0
  return Math.round((b - a) / 60000)
}
function formatDur(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60
  return `${h ? `${h} h ` : ''}${m ? `${m} min` : ''}`.trim() || '0 min'
}

export default function ServiceModal({ service, isNew, defaultStart, services, clients, cleaners, catalog = [], defaultCleanerId, onClose }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const { toast, confirm } = useUI()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const base = useMemo(() => defaultStart ?? new Date(), [defaultStart])

  const [form, setForm] = useState({
    client_id: service?.client_id ?? '',
    cleaner_id: service?.cleaner_id ?? defaultCleanerId ?? '',
    start_time: service ? toLocalInput(new Date(service.start_time)) : toLocalInput(base),
    end_time: service ? toLocalInput(new Date(service.end_time)) : toLocalInput(new Date(base.getTime() + 2 * 3600_000)),
    price_cop: service?.price_cop?.toString() ?? '',
    status: service?.status ?? 'scheduled',
    recurrence: 'none',
    service_type: service?.service_type ?? 'Normal',
    obs_auxiliar: service?.obs_auxiliar ?? '',
    obs_internas: service?.obs_internas ?? '',
    catalog_id: service?.catalog_id ?? '',
  })

  const [showHoja, setShowHoja] = useState(false)
  const [showClientInfo, setShowClientInfo] = useState(false)
  const [showResumen, setShowResumen] = useState(false)
  const [updatingReq, setUpdatingReq] = useState(false)

  const selectedClient = clients.find(c => c.id === form.client_id)
  const selectedCleaner = cleaners.find(c => c.id === form.cleaner_id)
  const periodicidad = RECURRENCE_OPTIONS.find(o => o.value === form.recurrence)?.label ?? 'Una sola vez'

  // Cierre con Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Duración actual (min) entre inicio y fin.
  const durMins = diffMinutes(form.start_time, form.end_time)

  // Cambiar la fecha: conserva hora de inicio y duración.
  function onDateChange(date: string) {
    setForm(f => {
      const start = `${date}T${timePart(f.start_time)}`
      return { ...f, start_time: start, end_time: addMinutesLocal(start, diffMinutes(f.start_time, f.end_time) || 120) }
    })
  }
  // Cambiar la hora de inicio: conserva fecha y duración, recalcula el fin.
  function onStartTimeChange(time: string) {
    setForm(f => {
      const start = `${datePart(f.start_time)}T${time}`
      return { ...f, start_time: start, end_time: addMinutesLocal(start, diffMinutes(f.start_time, f.end_time) || 120) }
    })
  }
  // Cambiar la duración: recalcula el fin desde el inicio.
  function onDurationChange(mins: number) {
    setForm(f => ({ ...f, end_time: addMinutesLocal(f.start_time, mins) }))
  }

  // Catálogo de servicios (activos), agrupado por grupo para el selector.
  const catalogGroups = useMemo(() => {
    const active = catalog.filter(c => c.is_active)
    return SEGMENTS.map(seg => ({ seg, items: active.filter(c => c.segment === seg.value) })).filter(g => g.items.length)
  }, [catalog])

  // Elegir un servicio del catálogo: prellena hora de inicio (sobre la fecha
  // actual), duración (→ fin), precio y tipo. El admin puede ajustar luego.
  function applyCatalog(id: string) {
    const c = catalog.find(x => x.id === id)
    setForm(f => {
      if (!c) return { ...f, catalog_id: '' }
      const start = `${datePart(f.start_time)}T${hhmm(c.start_time)}`
      return {
        ...f,
        catalog_id: id,
        start_time: start,
        end_time: addMinutesLocal(start, c.duration_minutes),
        price_cop: String(c.price_cop),
        service_type: c.name,
      }
    })
  }

  // Duración legible
  const duration = useMemo(() => {
    const a = new Date(form.start_time).getTime()
    const b = new Date(form.end_time).getTime()
    if (isNaN(a) || isNaN(b) || b <= a) return null
    const mins = Math.round((b - a) / 60000)
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h ? `${h} h ` : ''}${m ? `${m} min` : ''}`.trim()
  }, [form.start_time, form.end_time])

  // Detección de cruce en vivo (mismo limpiador, horario solapado)
  const conflict = useMemo(() => {
    if (!form.cleaner_id || !form.start_time || !form.end_time) return null
    const s = new Date(form.start_time).getTime()
    const e = new Date(form.end_time).getTime()
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
  }, [form.cleaner_id, form.start_time, form.end_time, services, service?.id])

  const endBeforeStart = useMemo(() => {
    const a = new Date(form.start_time).getTime()
    const b = new Date(form.end_time).getTime()
    return !isNaN(a) && !isNaN(b) && b <= a
  }, [form.start_time, form.end_time])

  async function handleSave() {
    if (endBeforeStart) { setError('La hora de fin debe ser posterior a la de inicio.'); return }
    setLoading(true)
    setError(null)
    try {
      const startISO = toISO(form.start_time)
      const endISO = toISO(form.end_time)
      const price = parseFloat(form.price_cop) || 0

      if (isNew) {
        const intervals: Record<string, number> = { daily: 1, weekly: 7, biweekly: 14 }
        const days = intervals[form.recurrence] ?? 0
        const count = days > 0 ? 8 : 1
        const groupId = days > 0 ? crypto.randomUUID() : null
        const startMs = new Date(startISO).getTime()
        const durationMs = new Date(endISO).getTime() - startMs
        const rows = Array.from({ length: count }, (_, i) => {
          const s = new Date(startMs + i * days * 86400_000)
          const e = new Date(s.getTime() + durationMs)
          return {
            client_id: form.client_id,
            cleaner_id: form.cleaner_id,
            start_time: s.toISOString(),
            end_time: e.toISOString(),
            price_cop: price,
            status: 'scheduled',
            is_recurring: days > 0,
            recurrence_group_id: groupId,
            service_type: form.service_type || null,
            obs_auxiliar: form.obs_auxiliar || null,
            obs_internas: form.obs_internas || null,
            catalog_id: form.catalog_id || null,
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
          service_type: form.service_type || null,
          obs_auxiliar: form.obs_auxiliar || null,
          obs_internas: form.obs_internas || null,
          catalog_id: form.catalog_id || null,
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

  // Actualiza solo tipo + observaciones de un servicio existente.
  async function handleUpdateRequisitos() {
    if (!service) return
    setUpdatingReq(true)
    const { error } = await supabase.from('services').update({
      service_type: form.service_type || null,
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

  return (
    <>
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md md:max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">{isNew ? '🗓️ Agendar servicio' : 'Servicio agendado'}</h2>
            {!isNew && selectedCleaner && (
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
              {noCleaners && <p>Primero crea al menos un <strong>limpiador</strong> (menú Limpiadores).</p>}
            </div>
          )}

          {catalogGroups.length > 0 && (
            <div className="md:col-span-2 bg-brand-50 border border-brand-200 rounded-lg p-3">
              <label className="block text-sm font-medium text-brand-800 mb-1">🧰 Servicio del catálogo</label>
              <select title="Servicio del catálogo" value={form.catalog_id} onChange={e => applyCatalog(e.target.value)} className={input}>
                <option value="">— Personalizado (sin catálogo) —</option>
                {catalogGroups.map(g => (
                  <optgroup key={g.seg.value} label={g.seg.label}>
                    {g.items.map(c => (
                      <option key={c.id} value={c.id}>{c.name} — {formatCOP(Number(c.price_cop))} · {scheduleLabel(c.start_time, c.duration_minutes)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="text-xs text-gray-600 mt-1">Elige uno para prellenar jornada, duración, precio y tipo. Puedes ajustarlos después.</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">¿Para qué cliente?</label>
              {selectedClient && (
                <button type="button" onClick={() => setShowClientInfo(true)} className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">ℹ️ Info</button>
              )}
            </div>
            <select title="Cliente" value={form.client_id} onChange={e => set('client_id', e.target.value)} className={input}>
              <option value="">Elige un cliente…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">¿Quién lo realiza?</label>
            <select title="Limpiador" value={form.cleaner_id} onChange={e => set('cleaner_id', e.target.value)} className={input}>
              <option value="">Elige un limpiador…</option>
              {cleaners.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📅 Fecha</label>
            <input title="Fecha" type="date" value={datePart(form.start_time)} onChange={e => onDateChange(e.target.value)} className={input} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🕐 Hora de inicio</label>
            <select title="Hora de inicio" value={timePart(form.start_time)} onChange={e => onStartTimeChange(e.target.value)} className={input}>
              {!TIME_SLOTS.includes(timePart(form.start_time)) && <option value={timePart(form.start_time)}>{timePart(form.start_time)}</option>}
              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">⏱️ Turno</label>
            <select title="Turno" value={String(durMins)} onChange={e => onDurationChange(Number(e.target.value))} className={input}>
              {durMins > 0 && !DURATIONS.some(d => d.mins === durMins) && (
                <option value={String(durMins)}>{formatDur(durMins)} (personalizada)</option>
              )}
              {DURATIONS.map(d => <option key={d.mins} value={String(d.mins)}>{d.label}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">Termina a las <strong>{timePart(form.end_time)}</strong>{duration ? ` · dura ${duration}` : ''}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de servicio</label>
            <input title="Tipo" type="text" value={form.service_type} onChange={e => set('service_type', e.target.value)} className={input} placeholder="Ej: Normal, Profundo…" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pago</label>
            <input title="Forma de pago" type="text" readOnly value={selectedClient?.forma_pago || 'No definida en el cliente'} className={input + ' bg-gray-100 text-gray-600'} />
          </div>

          {!isNew && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Periodicidad</label>
              <input title="Periodicidad" type="text" readOnly value={service?.is_recurring ? 'Recurrente (servicio fijo)' : 'Una sola vez'} className={input + ' bg-gray-100 text-gray-600'} />
            </div>
          )}

          {/* Requisitos: observaciones para el auxiliar e internas */}
          <div className="md:col-span-2 border border-gray-200 rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold text-gray-700">📋 Requisitos del servicio</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones para el auxiliar (las verá el aseador)</label>
              <textarea value={form.obs_auxiliar} onChange={e => set('obs_auxiliar', e.target.value)} rows={2} className={input + ' resize-none'} placeholder="Ej: Traer escalera; el portón principal está dañado, usar el lateral." />
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
              <span>Este limpiador ya tiene un servicio que se cruza: <strong>{(conflict.clients as { company_name?: string } | undefined)?.company_name ?? 'otro cliente'}</strong> el {new Date(conflict.start_time).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}. Puedes guardar igual, pero quedará marcado en rojo.</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio del servicio (COP)</label>
            <input type="number" inputMode="numeric" value={form.price_cop} onChange={e => set('price_cop', e.target.value)} className={input} placeholder="Ej: 150000" />
          </div>

          {!isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select title="Estado" value={form.status} onChange={e => set('status', e.target.value)} className={input}>
                <option value="scheduled">Agendado</option>
                <option value="completed">Completado (listo para facturar)</option>
                <option value="canceled">Cancelado</option>
              </select>
            </div>
          )}

          {isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">¿Se repite?</label>
              <select title="Repetición" value={form.recurrence} onChange={e => set('recurrence', e.target.value)} className={input}>
                {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
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
              {loading ? 'Guardando…' : isNew ? 'Agendar' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>

    {showHoja && selectedCleaner && (
      <CleanerHojaDeVida cleaner={selectedCleaner} onClose={() => setShowHoja(false)} />
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
            <ResumenRow k="Fecha" v={new Date(form.start_time + ':00').toLocaleDateString('es-CO', { dateStyle: 'full' })} />
            <ResumenRow k="Entrada / Salida" v={`${timePart(form.start_time)} – ${timePart(form.end_time)}`} />
            <ResumenRow k="Turno" v={duration ?? '—'} />
            <ResumenRow k="Tipo" v={form.service_type || '—'} />
            <ResumenRow k="Periodicidad" v={isNew ? periodicidad : (service?.is_recurring ? 'Recurrente (fijo)' : 'Una sola vez')} />
            <ResumenRow k="Forma de pago" v={selectedClient?.forma_pago || '—'} />
            <ResumenRow k="Valor" v={form.price_cop ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(form.price_cop)) : '—'} />
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
