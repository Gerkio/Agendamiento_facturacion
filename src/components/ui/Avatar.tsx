'use client'

import { useState } from 'react'

/** Avatar con foto (URL firmada) o iniciales como fallback. Reutilizable.
 *  Si la imagen no carga (URL vencida, bloqueo, 404) cae a las iniciales. */
export default function Avatar({ name, url, size = 'md' }: { name: string; url?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const initials = name.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase()
  const cls = size === 'sm' ? 'w-9 h-9 text-xs' : size === 'lg' ? 'w-20 h-20 text-2xl' : 'w-11 h-11 text-sm'
  return url && failedUrl !== url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} onError={() => setFailedUrl(url)} className={`${cls} rounded-full object-cover border border-gray-200 shrink-0`} />
  ) : (
    <div className={`${cls} rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold shrink-0`}>{initials}</div>
  )
}
