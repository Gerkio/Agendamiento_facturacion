/** Formatea un monto en pesos colombianos (sin decimales). */
export const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

/** Fecha corta es-CO. Acepta Date, ISO o 'YYYY-MM-DD' (este último se ancla a
 *  medianoche local para no correrse un día por zona horaria). Nulo → '—'. */
export const fmtDate = (d?: string | Date | null) => {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d.length === 10 ? d + 'T00:00:00' : d) : d
  return date.toLocaleDateString('es-CO')
}

/** Hora HH:mm (24 h) es-CO a partir de un ISO. */
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
