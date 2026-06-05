'use client'

import { useState } from 'react'

/** Logo de marca AMARU. Usa /amaru-logo.png desde la carpeta public; si el
 *  archivo aún no existe (o falla la carga) cae al texto "AMARU" para no mostrar
 *  una imagen rota. Coloca la imagen en `public/amaru-logo.png`. */
export default function Logo({ className = 'h-9 w-auto' }: { className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <span className="text-xl font-extrabold tracking-wide text-brand-700">AMARU</span>
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/amaru-logo.png" alt="AMARU" onError={() => setFailed(true)} className={className} />
  )
}
