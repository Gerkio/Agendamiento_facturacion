import 'server-only'
import { randomUUID } from 'crypto'

/**
 * Logger estructurado (una línea JSON por evento) pensado para los log drains
 * de Vercel. Cada request de servidor crea un `correlationId` y lo arrastra en
 * todos sus logs, para poder seguir un flujo completo (p. ej. una emisión DIAN)
 * en la consola. NO registrar secretos ni el documento; solo metadatos.
 */
export type LogLevel = 'info' | 'warn' | 'error'
type Fields = Record<string, unknown>

/** Identificador único para correlacionar todos los logs de un mismo request. */
export function newCorrelationId(): string {
  return randomUUID()
}

function emit(level: LogLevel, msg: string, fields: Fields) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export interface Logger {
  info(msg: string, fields?: Fields): void
  warn(msg: string, fields?: Fields): void
  error(msg: string, fields?: Fields): void
  /** Deriva un logger que añade campos fijos (se combinan con los base). */
  child(bound: Fields): Logger
}

/** Crea un logger con campos base (p. ej. { cid, route, actor }). */
export function createLogger(base: Fields = {}): Logger {
  return {
    info: (m, f) => emit('info', m, { ...base, ...f }),
    warn: (m, f) => emit('warn', m, { ...base, ...f }),
    error: (m, f) => emit('error', m, { ...base, ...f }),
    child: (bound) => createLogger({ ...base, ...bound }),
  }
}
