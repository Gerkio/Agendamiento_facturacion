import type { NovedadType } from '@/types/database'

/** Tipos de novedad de RR. HH. y sus etiquetas legibles. */
export const NOVEDAD_TYPES: NovedadType[] = ['permiso', 'vacaciones', 'incapacidad', 'otro']

export const NOVEDAD_TYPE_LABELS: Record<string, string> = {
  permiso: 'Permiso',
  vacaciones: 'Vacaciones',
  incapacidad: 'Incapacidad',
  otro: 'Otro',
}

export const novedadTypeLabel = (t: string) => NOVEDAD_TYPE_LABELS[t] ?? t
