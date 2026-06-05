/** Indicativo por defecto (Colombia). Los teléfonos en la BD vienen en formato
 *  local de 10 dígitos sin indicativo; WhatsApp exige el código de país. */
export const DEFAULT_COUNTRY = '57'

/** Deja solo dígitos (quita espacios, guiones, '+', paréntesis) y antepone el
 *  indicativo del país si el número viene en formato local de 10 dígitos. */
export function cleanPhone(raw?: string | null): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith(DEFAULT_COUNTRY) && digits.length >= 11) return digits
  if (digits.length === 10) return DEFAULT_COUNTRY + digits
  return digits
}

/** URL de WhatsApp Web (PC) con el contacto cargado y el mensaje en la caja. */
export function whatsappWebUrl(phone?: string | null, message = ''): string {
  return `https://web.whatsapp.com/send?phone=${cleanPhone(phone)}&text=${encodeURIComponent(message)}`
}

export interface AppointmentMessageData {
  clientName: string
  fecha: string
  entrada: string
  salida: string
  turnoLabel?: string
  serviceType?: string | null
  addressFull: string
  indicaciones?: string | null
  routeLink: string
}

/** Mensaje pre-formateado para el AUXILIAR (negritas con *…*, saltos de línea y
 *  emojis): encabezado + resumen del agendamiento + link de ruta en Google Maps. */
export function buildAuxiliarAppointmentMessage(d: AppointmentMessageData): string {
  const horario = `${d.entrada} – ${d.salida}${d.turnoLabel ? ` (${d.turnoLabel})` : ''}`
  const lines = [
    'Aquí está tu agendamiento:',
    '',
    `👤 *Cliente:* ${d.clientName}`,
    `📅 *Fecha:* ${d.fecha}`,
    `🕐 *Horario:* ${horario}`,
    `🧹 *Servicio:* ${d.serviceType || '—'}`,
    `📍 *Dirección:* ${d.addressFull || '—'}`,
  ]
  if (d.indicaciones) lines.push(`🧭 *Indicaciones:* ${d.indicaciones}`)
  lines.push('', '🗺️ *Cómo llegar (transporte público):*', d.routeLink)
  return lines.join('\n')
}
