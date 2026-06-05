/** Valida que un string tenga forma de UUID (8-4-4-4-12 hex), igual que acepta
 *  el tipo `uuid` de Postgres. No se exigen los bits de versión/variante de la
 *  RFC 4122 para no rechazar UUID válidos en la base (p.ej. datos sembrados o
 *  importados). Solo previene entradas malformadas. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Verifica por "magic bytes" que el archivo sea realmente JPEG/PNG/WEBP y que
 *  coincida con su Content-Type declarado (no confiar solo en file.type). */
export async function isRealImage(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const real =
    head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff ? 'image/jpeg'
    : head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 ? 'image/png'
    : head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46
        && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50 ? 'image/webp'
    : null
  return real !== null && real === file.type
}
