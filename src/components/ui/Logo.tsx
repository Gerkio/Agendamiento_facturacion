'use client'

import { useState } from 'react'

/** Logo de marca AMARU (`public/amaru-logo.webp`, WebP optimizado ~11 KB). Si la
 *  imagen falla al cargar, cae al texto "AMARU" para no mostrar una imagen rota. */
export default function Logo({ className = 'h-9 w-auto' }: { className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <span className="text-xl font-extrabold tracking-wide text-brand-700">AMARU</span>
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/amaru-logo.webp" alt="AMARU" onError={() => setFailed(true)} className={className} />
  )
}
