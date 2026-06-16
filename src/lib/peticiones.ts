/** Etiquetas del módulo de Peticiones (solicitudes internas del personal). */

export const PETICION_TYPES = [
  { value: 'permiso', label: 'Permiso' },
  { value: 'dotacion', label: 'Dotación / EPP' },
  { value: 'anticipo', label: 'Anticipo' },
  { value: 'certificado', label: 'Certificado laboral' },
  { value: 'otro', label: 'Otro' },
]
export const peticionTypeLabel = (v?: string | null) => PETICION_TYPES.find(t => t.value === v)?.label ?? v ?? '—'

export const PETICION_STATUS: Record<string, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  aprobada: { label: 'Aprobada', cls: 'bg-green-100 text-green-700' },
  rechazada: { label: 'Rechazada', cls: 'bg-red-100 text-red-700' },
  resuelta: { label: 'Resuelta', cls: 'bg-blue-100 text-blue-700' },
}
export const peticionStatusLabel = (s: string) => PETICION_STATUS[s]?.label ?? s
export const peticionStatusCls = (s: string) => PETICION_STATUS[s]?.cls ?? 'bg-gray-100 text-gray-600'

/** Estado que cuenta como pendiente (badge del menú admin). */
export const PETICION_PENDIENTES = ['pendiente']
