/** Utilidades de fecha en hora de Colombia (UTC-5 fijo). Centraliza el offset que
 *  antes se repetía en cada vista (rangos de filtro, "hoy", inicio de mes), para
 *  que la conversión sea única y consistente. NO usar para la DIAN: esos
 *  documentos formatean su propia marca de tiempo en `src/lib/dian/*`. */

const OFFSET_MS = 5 * 3600_000

/** Ahora desplazado a hora de Colombia: sus componentes UTC equivalen a la hora
 *  local colombiana (Bogotá no tiene horario de verano). */
export const bogotaNow = (): Date => new Date(Date.now() - OFFSET_MS)

/** Hoy en Colombia como 'YYYY-MM-DD'. */
export const bogotaToday = (): string => bogotaNow().toISOString().slice(0, 10)

/** Día calendario en Colombia ('YYYY-MM-DD') de un instante ISO/UTC. */
export const bogotaDayOf = (iso: string): string =>
  new Date(new Date(iso).getTime() - OFFSET_MS).toISOString().slice(0, 10)

/** Inicio (00:00) de un día 'YYYY-MM-DD' colombiano, como ISO UTC. */
export const bogotaDayStartISO = (date: string): string =>
  new Date(`${date}T00:00:00-05:00`).toISOString()

/** Fin (23:59:59.999) de un día 'YYYY-MM-DD' colombiano, como ISO UTC. */
export const bogotaDayEndISO = (date: string): string =>
  new Date(`${date}T23:59:59.999-05:00`).toISOString()

/** Rango por defecto para reportes: del 1.° del mes a hoy, en Colombia. */
export function bogotaMonthRange(): { from: string; to: string } {
  const n = bogotaNow()
  const pad = (x: number) => String(x).padStart(2, '0')
  const ym = `${n.getUTCFullYear()}-${pad(n.getUTCMonth() + 1)}`
  return { from: `${ym}-01`, to: `${ym}-${pad(n.getUTCDate())}` }
}
