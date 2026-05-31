'use client'

import { useCallback, useMemo, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction'
import type { EventClickArg, DateSelectArg } from '@fullcalendar/core'
import type { Service, Client, Cleaner } from '@/types/database'
import ServiceModal from './ServiceModal'

interface CalendarViewProps {
  services: Service[]
  clients: Client[]
  cleaners: Cleaner[]
  isAdmin: boolean
}

function detectDoubleBookings(services: Service[]): Set<string> {
  const doubled = new Set<string>()
  const active = services.filter(s => s.status !== 'canceled')
  const sorted = [...active].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].cleaner_id !== sorted[i].cleaner_id) continue
      const aEnd = new Date(sorted[i].end_time).getTime()
      const bStart = new Date(sorted[j].start_time).getTime()
      if (bStart < aEnd) {
        doubled.add(sorted[i].id)
        doubled.add(sorted[j].id)
      }
    }
  }
  return doubled
}

/** Devuelve la fecha de inicio sugerida: si el clic fue de "todo el día" (vista Mes), usa 8am. */
function suggestedStart(date: Date, allDay: boolean): Date {
  const d = new Date(date)
  if (allDay) d.setHours(8, 0, 0, 0)
  return d
}

export default function CalendarView({ services, clients, cleaners, isAdmin }: CalendarViewProps) {
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isNewEvent, setIsNewEvent] = useState(false)
  const [newStart, setNewStart] = useState<Date | null>(null)

  const doubled = useMemo(() => detectDoubleBookings(services), [services])
  const hasDoubleBooking = doubled.size > 0

  const events = useMemo(() =>
    services
      .filter(s => s.status !== 'canceled')
      .map(s => ({
        id: s.id,
        title: `${(s.clients as { company_name?: string } | undefined)?.company_name ?? 'Cliente'} · ${(s.cleaners as { full_name?: string } | undefined)?.full_name ?? 'Limpiador'}`,
        start: s.start_time,
        end: s.end_time,
        className: doubled.has(s.id) ? 'fc-event-double-booked' : '',
        extendedProps: { service: s },
      })),
    [services, doubled]
  )

  const openEdit = useCallback((arg: EventClickArg) => {
    const service = arg.event.extendedProps['service'] as Service | undefined
    if (service) setSelectedService(service)
    setIsNewEvent(false)
    setIsModalOpen(true)
  }, [])

  const openNewAt = useCallback((date: Date, allDay: boolean) => {
    if (!isAdmin) return
    setNewStart(suggestedStart(date, allDay))
    setSelectedService(null)
    setIsNewEvent(true)
    setIsModalOpen(true)
  }, [isAdmin])

  const handleDateClick = useCallback((arg: DateClickArg) => openNewAt(arg.date, arg.allDay), [openNewAt])
  const handleSelect = useCallback((arg: DateSelectArg) => openNewAt(arg.start, arg.allDay), [openNewAt])

  function openNewButton() {
    const now = new Date()
    now.setMinutes(0, 0, 0)
    now.setHours(now.getHours() + 1)
    openNewAt(now, false)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {hasDoubleBooking ? (
          <div className="flex items-center gap-2 bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-2.5 text-sm font-medium">
            <span className="text-lg">⚠️</span>
            Hay limpiadores con doble reserva. Los servicios en <span className="text-red-600 font-semibold">rojo</span> están cruzados.
          </div>
        ) : (
          <p className="text-sm text-gray-500">Haz clic en una hora del calendario para agendar, o usa el botón.</p>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={openNewButton}
            className="bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-brand-700 transition shadow-sm"
          >
            + Nuevo servicio
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          eventClick={openEdit}
          dateClick={isAdmin ? handleDateClick : undefined}
          selectable={isAdmin}
          select={isAdmin ? handleSelect : undefined}
          selectMirror
          nowIndicator
          height="auto"
          locale="es"
          firstDay={1}
          buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          slotDuration="00:30:00"
          expandRows
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        />
      </div>

      {isAdmin && (
        <p className="text-xs text-gray-600 mt-3 text-center">
          💡 Tip: arrastra sobre el calendario para elegir el rango de horas, o haz clic en un servicio para editarlo.
        </p>
      )}

      {isModalOpen && (
        <ServiceModal
          service={selectedService}
          isNew={isNewEvent}
          defaultStart={newStart}
          services={services}
          clients={clients}
          cleaners={cleaners}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  )
}
