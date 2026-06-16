/** Etiquetas y configuración del módulo PQR (servicio al cliente).
 *  La empresa presta aseo comercial/privado (Ley 1480), así que el plazo de
 *  respuesta es una POLÍTICA configurable, no el término legal de 15 días hábiles
 *  de servicios públicos. El SLA se fija al radicar (días hábiles). */

export const PQR_TIPOS = [
  { value: 'peticion', label: 'Petición' },
  { value: 'queja', label: 'Queja' },
  { value: 'reclamo', label: 'Reclamo' },
  { value: 'sugerencia', label: 'Sugerencia' },
]
export const pqrTipoLabel = (v?: string | null) => PQR_TIPOS.find(t => t.value === v)?.label ?? v ?? '—'

export const PQR_CANALES = ['Teléfono', 'WhatsApp', 'Correo', 'Presencial', 'Web']

export const PQR_ESTADOS: Record<string, { label: string; cls: string }> = {
  radicada: { label: 'Radicada', cls: 'bg-blue-100 text-blue-700' },
  en_tramite: { label: 'En trámite', cls: 'bg-amber-100 text-amber-700' },
  respondida: { label: 'Respondida', cls: 'bg-green-100 text-green-700' },
  cerrada: { label: 'Cerrada', cls: 'bg-gray-100 text-gray-600' },
  desistida: { label: 'Desistida', cls: 'bg-gray-100 text-gray-500' },
}
export const pqrEstadoLabel = (s: string) => PQR_ESTADOS[s]?.label ?? s
export const pqrEstadoCls = (s: string) => PQR_ESTADOS[s]?.cls ?? 'bg-gray-100 text-gray-600'

/** Días hábiles por defecto para responder (política editable al radicar). */
export const PQR_SLA_DIAS_DEFAULT = 15

/** Estados que cuentan como "pendiente" (badge del menú). */
export const PQR_PENDIENTES = ['radicada', 'en_tramite']

/** Acciones registradas en la bitácora (pqr_events). */
export const PQR_EVENT_LABEL: Record<string, string> = {
  radicada: 'Radicada',
  asignada: 'Responsable asignado',
  en_tramite: 'En trámite',
  nota: 'Nota',
  respondida: 'Respondida',
  cerrada: 'Cerrada',
  desistida: 'Desistida',
}
