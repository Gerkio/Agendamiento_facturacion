'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/format'
import { novedadTypeLabel } from '@/lib/novedades'
import type { Cleaner, Novedad } from '@/types/database'

interface Props {
  cleaner: Cleaner
  /** URL firmada de la foto (opcional; si no llega, se intenta generar). */
  photoUrl?: string | null
  onClose: () => void
}

export default function CleanerHojaDeVida({ cleaner, photoUrl, onClose }: Props) {
  const supabase = createClient()
  const [signed, setSigned] = useState<string | null>(photoUrl ?? null)
  const [novedades, setNovedades] = useState<Novedad[]>([])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Foto: si no vino firmada, intentar generarla (admin puede leer el bucket).
  useEffect(() => {
    let active = true
    if (!photoUrl && cleaner.photo_url) {
      supabase.storage.from('cleaner-photos').createSignedUrl(cleaner.photo_url, 3600)
        .then(({ data }) => { if (active && data?.signedUrl) setSigned(data.signedUrl) })
        .catch(() => {})
    }
    return () => { active = false }
  }, [supabase, cleaner.photo_url, photoUrl])

  // Últimas novedades del auxiliar (si la tabla existe).
  useEffect(() => {
    let active = true
    supabase.from('novedades').select('*').eq('cleaner_id', cleaner.id)
      .order('start_date', { ascending: false }).limit(5)
      .then(({ data }) => { if (active) setNovedades((data ?? []) as Novedad[]) })
    return () => { active = false }
  }, [supabase, cleaner.id])

  const initials = cleaner.full_name.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase()

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold">Hoja de vida</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Encabezado: foto + nombre + estado */}
          <div className="flex items-center gap-4">
            {signed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signed} alt={cleaner.full_name} onError={() => setSigned(null)} className="w-20 h-20 rounded-full object-cover border border-gray-200" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-2xl font-bold">{initials}</div>
            )}
            <div>
              <div className="text-lg font-bold text-gray-800">{cleaner.full_name}</div>
              <div className="text-sm text-gray-600">Cédula: <span className="font-mono">{cleaner.document_id}</span></div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cleaner.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {cleaner.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>

          {/* Datos */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Field label="Teléfono" value={cleaner.phone} />
            <Field label="Tel. emergencia" value={cleaner.emergency_phone} />
            <Field label="Contacto emergencia" value={cleaner.emergency_contact_name} />
            <Field label="Fecha de nacimiento" value={fmtDate(cleaner.birth_date)} />
            <Field label="Dirección" value={cleaner.address} full />
            <Field label="EPS" value={cleaner.eps} />
            <Field label="ARL" value={cleaner.arl} />
            <Field label="Fecha de ingreso" value={fmtDate(cleaner.hire_date)} />
          </div>

          {/* Novedades recientes */}
          <div>
            <h3 className="text-base font-semibold text-gray-700 mb-2">Novedades recientes</h3>
            {novedades.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Sin novedades registradas.</p>
            ) : (
              <ul className="space-y-2">
                {novedades.map(n => (
                  <li key={n.id} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-800">{novedadTypeLabel(n.type)} · {n.subject}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${n.status === 'pendiente' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {n.status === 'pendiente' ? 'Pendiente' : 'Resuelta'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{n.cod} · {fmtDate(n.start_date)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end p-5 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg text-base border border-gray-400 hover:bg-gray-50">Cerrar</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-gray-800">{value || '—'}</div>
    </div>
  )
}
