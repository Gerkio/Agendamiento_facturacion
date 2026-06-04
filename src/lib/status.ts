/** Etiquetas y clases de badge para los estados de la app. Centralizado para que
 *  la facturación, la ficha de cliente y la agenda usen los mismos colores/textos. */

export const FALLBACK_BADGE = 'bg-gray-100 text-gray-600'

/** Estado de facturación (factura y nota crédito). */
export const BILLING_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'bg-gray-100 text-gray-600' },
  processing: { label: 'Procesando…', cls: 'bg-amber-100 text-amber-700' },
  signed: { label: 'Firmada', cls: 'bg-blue-100 text-blue-700' },
  sent_dian: { label: 'Enviada DIAN', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rechazada', cls: 'bg-red-100 text-red-700' },
}

/** Estado de un servicio agendado. */
export const SERVICE_STATUS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Agendado', cls: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completado', cls: 'bg-green-100 text-green-700' },
  canceled: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
}

export const billingLabel = (s: string) => BILLING_STATUS[s]?.label ?? s
export const billingCls = (s: string) => BILLING_STATUS[s]?.cls ?? FALLBACK_BADGE
export const serviceLabel = (s: string) => SERVICE_STATUS[s]?.label ?? s
export const serviceCls = (s: string) => SERVICE_STATUS[s]?.cls ?? FALLBACK_BADGE
