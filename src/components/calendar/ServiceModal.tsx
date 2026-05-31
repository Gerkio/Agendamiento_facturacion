'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import type { Service, Client, Cleaner } from '@/types/database'

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

export default function ServiceModal({ service, isNew, defaultStart, services, clients, cleaners, defaultCleanerId, onClose }: Props) {
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
  })

  // Cierre con Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Al cambiar el inicio, si el fin queda antes, lo empuja 2h después.
  function onStartChange(v: string) {
    setForm(f => {
      const start = new Date(v).getTime()
      const end = new Date(f.end_time).getTime()
      const next = !f.end_time || end <= start ? toLocalInput(new Date(start + 2 * 3600_000)) : f.end_time
      return { ...f, start_time: v, end_time: next }
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

  const noClients = clients.length === 0
  const noCleaners = cleaners.length === 0
  const canSave = !!form.client_id && !!form.cleaner_id && !endBeforeStart && !loading

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">{isNew ? '🗓️ Agendar servicio' : 'Editar servicio'}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {(noClients || noCleaners) && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
              {noClients && <p>Primero crea al menos un <strong>cliente</strong> (menú Clientes).</p>}
              {noCleaners && <p>Primero crea al menos un <strong>limpiador</strong> (menú Limpiadores).</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">¿Para qué cliente?</label>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Empieza</label>
              <input title="Inicio" type="datetime-local" value={form.start_time} onChange={e => onStartChange(e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Termina</label>
              <input title="Fin" type="datetime-local" value={form.end_time} onChange={e => set('end_time', e.target.value)} className={input} />
            </div>
          </div>

          {duration && <p className="text-xs text-gray-500">⏱️ Duración: <strong>{duration}</strong></p>}
          {endBeforeStart && <p className="text-xs text-red-600">La hora de fin debe ser posterior a la de inicio.</p>}

          {conflict && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm flex items-start gap-2">
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

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
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
  )
}
