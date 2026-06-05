'use client'

import { MAPS_EMBED_KEY, placeEmbedUrl, directionsEmbedUrl, mapsSearchLink, mapsDirLink } from '@/lib/maps'

interface Props {
  mode: 'place' | 'directions'
  /** Dirección a ubicar (modo place). */
  q?: string
  /** Origen/destino (modo directions, transporte público). */
  origin?: string
  destination?: string
  title?: string
}

/** Mapa con Google Maps Embed API. Degrada con elegancia: sin dirección no
 *  renderiza; sin key muestra una nota + enlace externo (que sí funciona). */
export default function MapEmbed({ mode, q, origin, destination, title = 'Mapa' }: Props) {
  const dest = (mode === 'place' ? q : destination)?.trim() || ''
  if (!dest) return null

  const hasOrigin = !!origin?.trim()
  // directions sin origen → ubica solo el destino.
  const isRoute = mode === 'directions' && hasOrigin
  const externalLink = isRoute ? mapsDirLink(origin!.trim(), dest) : mapsSearchLink(dest)

  if (!MAPS_EMBED_KEY) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600">
        <p className="mb-1">🗺️ Mapa no configurado (falta <code>NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY</code>).</p>
        <a href={externalLink} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">Abrir en Google Maps</a>
      </div>
    )
  }

  const src = isRoute ? directionsEmbedUrl(origin!.trim(), dest) : placeEmbedUrl(dest)

  return (
    <div>
      <iframe
        title={title}
        src={src}
        loading="lazy"
        allowFullScreen
        className="w-full aspect-video rounded-lg border border-gray-200"
      />
      <a href={externalLink} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-xs text-brand-700 underline">
        Abrir en Google Maps{isRoute ? ' (ruta)' : ''}
      </a>
    </div>
  )
}
