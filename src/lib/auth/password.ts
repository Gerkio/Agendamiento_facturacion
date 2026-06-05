/** Política mínima para contraseñas ELEGIDAS por un usuario (no las temporales
 *  generadas por el sistema). Liviano: longitud + lista de las más comunes. */
export const PASSWORD_MIN_LENGTH = 8

const COMMON = new Set([
  '12345678', '123456789', '1234567890', 'password', 'qwerty123', 'contrasena', 'contraseña',
  'admin123', 'aseo1234', '11111111', '00000000', 'abcd1234', 'iloveyou', 'cleansched',
])

/** Mensaje de error si la contraseña es débil; null si es aceptable. */
export function validatePassword(pwd: string): string | null {
  if (pwd.length < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`
  if (COMMON.has(pwd.toLowerCase())) return 'Esa contraseña es demasiado común; elige otra'
  return null
}
