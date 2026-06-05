'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Service, Client, Cleaner, ServiceCatalog } from '@/types/database'
import ServiceModal from './ServiceModal'
import ServiceDetail from './ServiceDetail'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP } from '@/lib/format'

interface Props {
  cleaners: Cleaner[]
  clients: Client[]
  catalog?: ServiceCatalog[]
  isAdmin: boolean
  cleanerId: string | null
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MORNING_HOUR = 8
const AFTERNOON_HOUR = 14
// Servicios que inician antes de las 13:00 = Mañana (M); 13:00 o después = Tarde (T).
const SPLIT_HOUR = 13

// Colores por ESTADO del servicio (no por cliente), en tonos de la marca:
//   verde = agendado · gris = completado · rojo = doble reserva (alerta).
const COLOR_SCHEDULED = { background: '#e6efe3', borderLeft: '3px solid #7c9c74', color: '#154735' }
const COLOR_DONE = { background: '#f1f2f0', borderLeft: '3px solid #8f9593', color: '#4b5563' }
const COLOR_CONFLICT = { background: '#fee2e2', borderLeft: '3px solid #ef4444', color: '#991b1b' }

function mondayOf(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function fmtRange(start: Date): string {
  const f = (x: Date) => x.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  return `${f(start)} – ${f(addDays(start, 6))}`
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function periodOf(iso: string): 'M' | 'T' { return new Date(iso).getHours() < SPLIT_HOUR ? 'M' : 'T' }
function hours(s: Service): number { return (+new Date(s.end_time) - +new Date(s.start_time)) / 3600000 }
// Franjas (M/T) que ocupa un servicio. Cubre AMBAS solo si cruza las 13:00 y
// dura 4 h o más; si está dentro de una franja o dura menos de 4 h, ocupa una.
function periodsOf(s: Service): ('M' | 'T')[] {
  const start = new Date(s.start_time)
  const end = new Date(s.end_time)
  const startH = start.getHours() + start.getMinutes() / 60
  const endH = end.getHours() + end.getMinutes() / 60
  const spansBoth = startH < SPLIT_HOUR && endH > SPLIT_HOUR
  if (spansBoth && hours(s) >= 4) return ['M', 'T']
  return [startH < SPLIT_HOUR ? 'M' : 'T']
}
const clientNameOf = (s: Service) => (s.clients as { company_name?: string } | undefined)?.company_name ?? 'Cliente'

export default function AgendaMatrix({ cleaners, clients, catalog = [], isAdmin, cleanerId }: Props) {
  const supabase = createClient()
  const { toast, confirm } = useUI()
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [newStart, setNewStart] = useState<Date | null>(null)
  const [newCleanerId, setNewCleanerId] = useState<string | null>(null)
  const [detailService, setDetailService] = useState<Service | null>(null)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const rows = isAdmin ? cleaners : cleaners.filter(c => c.id === cleanerId)

  const fetchWeek = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('services')
      .select('*, clients(company_name, address, phone, indicaciones, forma_pago), cleaners(full_name)')
      .neq('status', 'canceled')
      .gte('start_time', weekStart.toISOString())
      .lt('start_time', addDays(weekStart, 7).toISOString())
    if (!isAdmin && cleanerId) q = q.eq('cleaner_id', cleanerId)
    const { data } = await q
    setServices((data ?? []) as Service[])
    setLoading(false)
  }, [supabase, weekStart, isAdmin, cleanerId])

  useEffect(() => { fetchWeek() }, [fetchWeek])

  const cellMap = useMemo(() => {
    // both = servicios que cruzan mañana y tarde (tarjeta ancha sobre las dos
    // franjas). M / T = servicios de una sola franja.
    const map: Record<string, Record<number, { both: Service[]; M: Service[]; T: Service[] }>> = {}
    for (const s of services) {
      const idx = Math.floor((+new Date(s.start_time) - weekStart.getTime()) / 86400000)
      if (idx < 0 || idx > 6) continue
      const c = (map[s.cleaner_id] ??= {})
      const cell = (c[idx] ??= { both: [], M: [], T: [] })
      const ps = periodsOf(s)
      if (ps.length === 2) cell.both.push(s)
      else cell[ps[0]].push(s)
    }
    return map
  }, [services, weekStart])

  const doubled = useMemo(() => {
    const set = new Set<string>()
    const byCleaner: Record<string, Service[]> = {}
    for (const s of services) (byCleaner[s.cleaner_id] ??= []).push(s)
    for (const list of Object.values(byCleaner)) {
      const sorted = [...list].sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))
      for (let i = 0; i < sorted.length; i++)
        for (let j = i + 1; j < sorted.length; j++)
          if (+new Date(sorted[j].start_time) < +new Date(sorted[i].end_time)) { set.add(sorted[i].id); set.add(sorted[j].id) }
    }
    return set
  }, [services])

  // Totales por auxiliar y resumen de la semana.
  const perCleaner = useMemo(() => {
    const m: Record<string, { count: number; hours: number; revenue: number }> = {}
    for (const s of services) {
      const e = (m[s.cleaner_id] ??= { count: 0, hours: 0, revenue: 0 })
      e.count++; e.hours += hours(s); e.revenue += Number(s.price_cop)
    }
    return m
  }, [services])

  const summary = useMemo(() => {
    const totalHours = services.reduce((a, s) => a + hours(s), 0)
    const totalRevenue = services.reduce((a, s) => a + Number(s.price_cop), 0)
    const withWork = new Set(services.map(s => s.cleaner_id))
    return { count: services.length, totalHours, totalRevenue, idle: rows.filter(c => !withWork.has(c.id)).length }
  }, [services, rows])

  function openEdit(s: Service) { setEditing(s); setNewStart(null); setNewCleanerId(null); setModalOpen(true) }
  function openNew(cId: string, day: Date, period: 'M' | 'T') {
    if (!isAdmin) return
    const start = new Date(day); start.setHours(period === 'M' ? MORNING_HOUR : AFTERNOON_HOUR, 0, 0, 0)
    setEditing(null); setNewStart(start); setNewCleanerId(cId); setModalOpen(true)
  }

  // Reprogramar por arrastre: cambia auxiliar + día (y turno si difiere), conserva duración.
  async function onDropCell(cleanerId2: string, day: Date, period: 'M' | 'T') {
    const id = dragId; setDragId(null)
    if (!id || !isAdmin) return
    const s = services.find(x => x.id === id); if (!s) return
    const durationMs = +new Date(s.end_time) - +new Date(s.start_time)
    const newStart = new Date(day)
    if (period === periodOf(s.start_time)) newStart.setHours(new Date(s.start_time).getHours(), new Date(s.start_time).getMinutes(), 0, 0)
    else newStart.setHours(period === 'M' ? MORNING_HOUR : AFTERNOON_HOUR, 0, 0, 0)
    const patch = { cleaner_id: cleanerId2, start_time: newStart.toISOString(), end_time: new Date(+newStart + durationMs).toISOString() }
    setServices(prev => prev.map(x => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('services').update(patch).eq('id', id)
    if (error) toast('No se pudo reprogramar: ' + error.message, 'error')
    fetchWeek()
  }

  async function duplicateWeek() {
    if (!isAdmin) return
    // Solo se copian los servicios agendados (no completados ni facturados).
    const copiables = services.filter(s => s.status === 'scheduled')
    if (!copiables.length) { toast('No hay servicios agendados en esta semana para copiar.', 'info'); return }
    const ok = await confirm({ title: 'Duplicar semana', message: `¿Copiar ${copiables.length} servicio(s) agendado(s) a la semana siguiente?`, confirmLabel: 'Duplicar' })
    if (!ok) return
    setBusy(true)
    const rowsToInsert = copiables.map(s => ({
      client_id: s.client_id, cleaner_id: s.cleaner_id,
      start_time: addDays(new Date(s.start_time), 7).toISOString(),
      end_time: addDays(new Date(s.end_time), 7).toISOString(),
      status: 'scheduled', is_recurring: false, recurrence_group_id: null, price_cop: s.price_cop,
      service_type: s.service_type ?? null,
    }))
    const { error } = await supabase.from('services').insert(rowsToInsert)
    setBusy(false)
    if (error) { toast('Error al duplicar: ' + error.message, 'error'); return }
    toast(`${rowsToInsert.length} servicio(s) copiados a la semana siguiente.`, 'success')
    setWeekStart(addDays(weekStart, 7))
  }

  const hasDouble = doubled.size > 0

  // Tarjeta de un servicio dentro de la matriz (reutilizada por la franja única
  // y por la tarjeta ancha que cubre mañana + tarde).
  function renderServiceCard(s: Service) {
    const red = doubled.has(s.id)
    const done = s.status === 'completed'
    const style = red ? COLOR_CONFLICT : done ? COLOR_DONE : COLOR_SCHEDULED
    return (
      <button key={s.id} type="button"
        draggable={isAdmin}
        onDragStart={() => setDragId(s.id)}
        onClick={() => (isAdmin ? openEdit(s) : setDetailService(s))}
        style={style}
        title={`${clientNameOf(s)} · ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}`}
        className="w-full text-left rounded px-1.5 py-1 transition hover:brightness-95 cursor-pointer">
        <div className="text-xs font-medium leading-tight truncate">{done && '✓ '}{clientNameOf(s)}</div>
        <div className="text-xs opacity-75 leading-tight">{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</div>
      </button>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold text-gray-800">📅 Agenda</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button type="button" onClick={duplicateWeek} disabled={busy}
              className="px-3 py-1.5 text-sm border border-brand-300 text-brand-700 rounded-lg hover:bg-brand-50 disabled:opacity-50">
              ⧉ Duplicar semana
            </button>
          )}
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">‹ Sem. ant.</button>
          <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">{fmtRange(weekStart)}</span>
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Sem. sig. ›</button>
          <button type="button" onClick={() => setWeekStart(mondayOf(new Date()))}
            className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">Hoy</button>
        </div>
      </div>

      {/* Resumen de la semana (solo admin) */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <SummaryCard label="Servicios" value={String(summary.count)} icon="🧹" />
          <SummaryCard label="Horas" value={`${summary.totalHours.toFixed(1)} h`} icon="⏱️" />
          <SummaryCard label="Ingresos estimados" value={formatCOP(summary.totalRevenue)} icon="💰" />
          <SummaryCard label="Auxiliares sin agenda" value={String(summary.idle)} icon="🚫" highlight={summary.idle > 0} />
        </div>
      )}

      {hasDouble && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-2.5 text-sm font-medium">
          <span className="text-lg">⚠️</span> {isAdmin ? 'Hay auxiliares con doble reserva (celdas en rojo).' : 'Tienes servicios cruzados (en rojo).'}
        </div>
      )}

      {/* Vista del aseador: lista por día (móvil-friendly) */}
      {!isAdmin && (
        <div className="space-y-4">
          {days.map((d, dIdx) => {
            const dayCell = cellMap[cleanerId ?? '']?.[dIdx]
            const list = [...(dayCell?.both ?? []), ...(dayCell?.M ?? []), ...(dayCell?.T ?? [])]
              .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))
            if (list.length === 0) return null
            const isToday = d.toDateString() === new Date().toDateString()
            return (
              <div key={dIdx}>
                <div className={`text-sm font-semibold mb-2 ${isToday ? 'text-brand-700' : 'text-gray-600'}`}>
                  {DAY_NAMES[dIdx]} {d.getDate()} {isToday && '· hoy'}
                </div>
                <div className="space-y-2">
                  {list.map(s => {
                    const cl = s.clients as { company_name?: string; address?: string; indicaciones?: string | null } | undefined
                    const done = s.status === 'completed'
                    const red = doubled.has(s.id)
                    return (
                      <button key={s.id} type="button" onClick={() => setDetailService(s)}
                        className={`w-full text-left bg-white border rounded-xl p-3 flex gap-3 items-start hover:bg-gray-50 transition ${red ? 'border-red-300' : 'border-gray-200'}`}>
                        <div className="text-center min-w-[58px]">
                          <div className="text-sm font-semibold text-gray-800">{fmtTime(s.start_time)}</div>
                          <div className="text-xs text-gray-600">{fmtTime(s.end_time)}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 truncate">{done && '✓ '}{cl?.company_name ?? 'Cliente'}</div>
                          {cl?.address && <div className="text-xs text-gray-500 truncate">📍 {cl.address}</div>}
                          {cl?.indicaciones && <div className="text-xs text-brand-600 truncate">🧭 {cl.indicaciones}</div>}
                        </div>
                        <span className="text-gray-500 text-lg">›</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {services.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-600">
              <div className="text-4xl mb-2">📅</div>
              No tienes servicios esta semana.
            </div>
          )}
        </div>
      )}

      {isAdmin && (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[1000px]">
          <thead>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="sticky left-0 z-10 bg-gray-50 text-left px-4 py-2 border-b border-r border-gray-200 font-semibold text-gray-600 min-w-[150px]">Auxiliar</th>
              {days.map((d, i) => {
                const isToday = d.toDateString() === new Date().toDateString()
                return (
                  <th key={i} colSpan={2} className={`px-2 py-2 border-b border-r border-gray-200 text-center text-xs font-semibold ${isToday ? 'bg-brand-50 text-brand-700' : 'text-gray-600'}`}>
                    {DAY_NAMES[i]} {d.getDate()}
                  </th>
                )
              })}
              <th rowSpan={2} className="px-3 py-2 border-b border-l border-gray-200 text-center text-xs font-semibold text-gray-600 min-w-[110px]">Semana</th>
            </tr>
            <tr className="bg-gray-50 text-xs text-gray-600 uppercase">
              {days.map((_, i) => (
                <FragmentMT key={i} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr><td colSpan={16} className="text-center py-10 text-gray-600">No hay auxiliares activos.</td></tr>
            )}
            {rows.map(cl => {
              const tot = perCleaner[cl.id]
              return (
                <tr key={cl.id} className="hover:bg-gray-50/50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 border-r border-gray-200 font-medium text-gray-800 align-top">{cl.full_name}</td>
                  {days.map((day, dIdx) => {
                    const cell = cellMap[cl.id]?.[dIdx] ?? { both: [], M: [], T: [] }
                    return (
                      <td key={dIdx} colSpan={2} className="border-r border-gray-100 p-1 align-top min-w-[184px]">
                        <div className="space-y-1">
                          {/* Servicio que cruza mañana y tarde: una sola tarjeta ancha sobre ambas franjas. */}
                          {cell.both.map(s => renderServiceCard(s))}
                          {/* Las dos franjas (M | T): cada una es zona de drop y con su botón "+". */}
                          <div className="grid grid-cols-2 gap-1">
                            {(['M', 'T'] as const).map(period => {
                              const list = cell[period]
                              return (
                                <div key={period}
                                  onDragOver={isAdmin ? (e) => e.preventDefault() : undefined}
                                  onDrop={isAdmin ? () => onDropCell(cl.id, day, period) : undefined}
                                  className="min-h-[40px]">
                                  {list.length === 0 ? (
                                    isAdmin ? (
                                      <button type="button" onClick={() => openNew(cl.id, day, period)}
                                        className="w-full h-full min-h-[40px] rounded text-gray-500 hover:bg-brand-50 hover:text-brand-500 transition text-xs">+</button>
                                    ) : <div className="min-h-[40px]" />
                                  ) : (
                                    <div className="space-y-1">{list.map(s => renderServiceCard(s))}</div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 border-l border-gray-200 text-center align-top text-xs text-gray-600">
                    {tot ? (
                      <>
                        <div className="font-semibold text-gray-800">{tot.count} serv</div>
                        <div>{tot.hours.toFixed(1)} h</div>
                        <div className="text-brand-700">{formatCOP(tot.revenue)}</div>
                      </>
                    ) : <span className="text-gray-500">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

      {loading && <p className="text-center text-xs text-gray-600 mt-3">Cargando semana…</p>}
      {isAdmin && (
        <>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs text-gray-600">
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: COLOR_SCHEDULED.background, borderLeft: COLOR_SCHEDULED.borderLeft }} /> Agendado</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: COLOR_DONE.background, borderLeft: COLOR_DONE.borderLeft }} /> Completado</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: COLOR_CONFLICT.background, borderLeft: COLOR_CONFLICT.borderLeft }} /> Doble reserva</span>
          </div>
          <p className="text-center text-xs text-gray-600 mt-2">
            💡 Clic en celda vacía para agendar · clic en un servicio para editarlo · <strong>arrástralo</strong> a otra celda para reprogramar · M = mañana, T = tarde.
          </p>
        </>
      )}

      {modalOpen && (
        <ServiceModal
          service={editing}
          isNew={!editing}
          defaultStart={newStart}
          defaultCleanerId={newCleanerId}
          services={services}
          clients={clients}
          cleaners={cleaners}
          catalog={catalog}
          onClose={() => { setModalOpen(false); fetchWeek() }}
        />
      )}

      {detailService && (
        <ServiceDetail service={detailService} onClose={() => setDetailService(null)} />
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon, highlight }: { label: string; value: string; icon: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
      <div className="text-xs text-gray-500 flex items-center gap-1">{icon} {label}</div>
      <div className={`text-lg font-semibold mt-0.5 ${highlight ? 'text-amber-700' : 'text-gray-800'}`}>{value}</div>
    </div>
  )
}

function FragmentMT() {
  return (
    <>
      <th className="px-1 py-1 border-r border-gray-200 text-center font-medium">M</th>
      <th className="px-1 py-1 border-r border-gray-200 text-center font-medium">T</th>
    </>
  )
}
