import { cityName } from '@/lib/dian/cities'

/** Clave de la Maps Embed API (pública; restringir por dominio en Google Cloud). */
export const MAPS_EMBED_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY ?? ''

const enc = encodeURIComponent

/** String geocodificable: "<dirección>, <ciudad>, Colombia". '' si no hay dirección. */
export function fullAddress(address?: string | null, cityCode?: string | null): string {
  const dir = (address ?? '').trim()
  if (!dir) return ''
  const city = cityName(cityCode ?? undefined)
  return [dir, city, 'Colombia'].filter(Boolean).join(', ')
}

/** URL del iframe Embed para ubicar una dirección (requiere key). */
export function placeEmbedUrl(q: string): string {
  return `https://www.google.com/maps/embed/v1/place?key=${MAPS_EMBED_KEY}&q=${enc(q)}`
}

/** URL del iframe Embed con la ruta en transporte público (requiere key). */
export function directionsEmbedUrl(origin: string, destination: string): string {
  return `https://www.google.com/maps/embed/v1/directions?key=${MAPS_EMBED_KEY}&origin=${enc(origin)}&destination=${enc(destination)}&mode=transit`
}

/** Enlaces externos a Google Maps (NO requieren key; sirven de respaldo). */
export function mapsSearchLink(q: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${enc(q)}`
}
export function mapsDirLink(origin: string, destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${enc(origin)}&destination=${enc(destination)}&travelmode=transit`
}
