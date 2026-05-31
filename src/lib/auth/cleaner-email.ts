/**
 * Los limpiadores inician sesión con su número de cédula, pero Supabase Auth
 * usa email. Mapeamos la cédula a un email sintético interno y constante.
 */
export const CLEANER_EMAIL_DOMAIN = 'cleaner.cleansched.local'

export function cedulaToEmail(cedula: string): string {
  return `${cedula.trim()}@${CLEANER_EMAIL_DOMAIN}`
}

/** true si el identificador escrito parece un email real (admins) y no una cédula. */
export function looksLikeEmail(identifier: string): boolean {
  return identifier.includes('@')
}

/** Resuelve el identificador del login: email tal cual, o cédula → email sintético. */
export function resolveLoginEmail(identifier: string): string {
  const id = identifier.trim()
  return looksLikeEmail(id) ? id : cedulaToEmail(id)
}
