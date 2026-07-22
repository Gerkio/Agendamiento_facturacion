import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

interface HasPhoto { id: string; photo_url?: string | null }

/** Firma varias fotos de un bucket privado en UNA sola llamada (createSignedUrls),
 *  evitando el N+1 de una petición por fila. Devuelve { [id]: signedUrl } solo para
 *  las que tienen foto y firmaron correctamente. */
export async function signedPhotoUrls(
  supabase: SupabaseClient,
  bucket: string,
  items: HasPhoto[],
  expiresIn = 3600,
): Promise<Record<string, string>> {
  const withPhoto = items.filter((i): i is HasPhoto & { photo_url: string } => !!i.photo_url)
  if (withPhoto.length === 0) return {}

  const { data } = await supabase.storage.from(bucket).createSignedUrls(withPhoto.map(i => i.photo_url), expiresIn)

  const byPath = new Map<string, string>()
  for (const d of data ?? []) if (d.path && d.signedUrl) byPath.set(d.path, d.signedUrl)

  const out: Record<string, string> = {}
  for (const i of withPhoto) {
    const url = byPath.get(i.photo_url)
    if (url) out[i.id] = url
  }
  return out
}
