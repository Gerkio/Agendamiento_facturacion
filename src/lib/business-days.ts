/** Días hábiles y festivos de Colombia (Ley 51/1983 + Ley Emiliani). Trabaja con
 *  fechas 'YYYY-MM-DD' en UTC para evitar deslices de zona horaria. Se usa para el
 *  SLA de PQR (y a futuro Peticiones/Nómina). Puro: sin Date.now ni Math.random. */

const DAY = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)
const parse = (s: string) => new Date(`${s}T00:00:00Z`)

/** Domingo de Pascua (algoritmo anónimo gregoriano / Gauss). */
function easter(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

/** Mueve la fecha al próximo lunes si no cae en lunes (Ley Emiliani). */
function toMonday(d: Date): Date {
  const delta = ((1 - d.getUTCDay()) + 7) % 7
  return delta === 0 ? d : addDays(d, delta)
}

function colombiaHolidays(year: number): Set<string> {
  const out = new Set<string>()
  const fixed = (mo: number, da: number) => out.add(iso(new Date(Date.UTC(year, mo - 1, da))))
  const emiliani = (mo: number, da: number) => out.add(iso(toMonday(new Date(Date.UTC(year, mo - 1, da)))))

  fixed(1, 1)        // Año Nuevo
  emiliani(1, 6)     // Reyes Magos
  emiliani(3, 19)    // San José
  fixed(5, 1)        // Día del Trabajo
  fixed(7, 20)       // Independencia
  fixed(8, 7)        // Batalla de Boyacá
  emiliani(6, 29)    // San Pedro y San Pablo
  emiliani(8, 15)    // Asunción de la Virgen
  emiliani(10, 12)   // Día de la Raza
  emiliani(11, 1)    // Todos los Santos
  emiliani(11, 11)   // Independencia de Cartagena
  fixed(12, 8)       // Inmaculada Concepción
  fixed(12, 25)      // Navidad

  const e = easter(year)
  out.add(iso(addDays(e, -3)))            // Jueves Santo
  out.add(iso(addDays(e, -2)))            // Viernes Santo
  out.add(iso(toMonday(addDays(e, 39))))  // Ascensión del Señor
  out.add(iso(toMonday(addDays(e, 60))))  // Corpus Christi
  out.add(iso(toMonday(addDays(e, 68))))  // Sagrado Corazón
  return out
}

const cache = new Map<number, Set<string>>()
const holidaysFor = (year: number): Set<string> => {
  const hit = cache.get(year)
  if (hit) return hit
  const h = colombiaHolidays(year)
  cache.set(year, h)
  return h
}

/** ¿La fecha ('YYYY-MM-DD') es día hábil (no fin de semana ni festivo)? */
export function isBusinessDay(dateStr: string): boolean {
  const d = parse(dateStr)
  const dow = d.getUTCDay()
  if (dow === 0 || dow === 6) return false
  return !holidaysFor(d.getUTCFullYear()).has(dateStr)
}

/** Suma n días hábiles a una fecha 'YYYY-MM-DD' → 'YYYY-MM-DD'. */
export function addBusinessDays(dateStr: string, n: number): string {
  let d = parse(dateStr), added = 0
  while (added < n) {
    d = addDays(d, 1)
    if (isBusinessDay(iso(d))) added++
  }
  return iso(d)
}

/** Días hábiles entre dos fechas (0 si `to` ≤ `from`). */
export function businessDaysBetween(fromStr: string, toStr: string): number {
  let d = parse(fromStr)
  const to = parse(toStr)
  let count = 0
  while (d < to) {
    d = addDays(d, 1)
    if (isBusinessDay(iso(d))) count++
  }
  return count
}
