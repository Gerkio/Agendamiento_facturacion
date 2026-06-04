import type { ServiceSegment, ServiceTipo } from '@/types/database'

/** Grupo del servicio (a quién va dirigido). */
export const SEGMENTS: { value: ServiceSegment; label: string }[] = [
  { value: 'hogar', label: 'Hogar' },
  { value: 'empresa', label: 'Empresa' },
]

/** Jornada del servicio. */
export const TIPOS: { value: ServiceTipo; label: string }[] = [
  { value: 'dia_completo', label: 'Día completo' },
  { value: 'medio_dia_manana', label: 'Medio día mañana' },
  { value: 'medio_dia_tarde', label: 'Medio tarde' },
]

export const segmentLabel = (v: string) => SEGMENTS.find(s => s.value === v)?.label ?? v
export const tipoLabel = (v: string) => TIPOS.find(t => t.value === v)?.label ?? v

/** Turnos con su horario por defecto (Entrada/Salida) para el modal de agendar. */
export const TURNOS = [
  { value: 'manana', label: 'Mañana', entrada: '08:00', salida: '12:00' },
  { value: 'tarde', label: 'Tarde', entrada: '14:00', salida: '18:00' },
  { value: 'dia_completo', label: 'Día completo', entrada: '08:00', salida: '15:40' },
] as const
export const turnoLabel = (v?: string | null) => TURNOS.find(t => t.value === v)?.label ?? '—'
/** Jornada del catálogo → turno del agendamiento. */
export const tipoToTurno = (tipo: string): string =>
  tipo === 'medio_dia_manana' ? 'manana' : tipo === 'medio_dia_tarde' ? 'tarde' : 'dia_completo'

/** Clasificación operativa del servicio (campo "Tipo" de la referencia). */
export const SERVICE_CLASSES = ['Normal', 'Garantía', 'Obsequio', 'Reinducción', 'Dominical']

/** Formas de pago frecuentes (la del cliente se usa como valor por defecto). */
export const FORMA_PAGO_OPTIONS = ['Contado', 'Crédito 5 días', 'Crédito 8 días', 'Crédito 15 días', 'Crédito 30 días']

/** "HH:mm[:ss]" → "HH:mm". */
export const hhmm = (time: string) => time.slice(0, 5)

/** Suma minutos a una hora "HH:mm" y devuelve "HH:mm" (acota a 24 h). */
export function addMinutesToTime(time: string, mins: number): string {
  const [h, m] = hhmm(time).split(':').map(Number)
  const total = ((h * 60 + m + mins) % 1440 + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Duración legible: 460 → "7 h 40 min". */
export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60
  return `${h ? `${h} h ` : ''}${m ? `${m} min` : ''}`.trim() || '0 min'
}

/** Horario legible a partir de inicio + duración: "08:00 – 15:40". */
export function scheduleLabel(startTime: string, durationMinutes: number): string {
  return `${hhmm(startTime)} – ${addMinutesToTime(startTime, durationMinutes)}`
}
