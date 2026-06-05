'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtDate, formatCOP } from '@/lib/format'
import { novedadTypeLabel } from '@/lib/novedades'
import { fullAddress } from '@/lib/maps'
import MapEmbed from '@/components/map/MapEmbed'
import type { Cleaner, Novedad } from '@/types/database'

interface Props {
  cleaner: Cleaner
  /** URL firmada de la foto (opcional; si no llega, se intenta generar). */
  photoUrl?: string | null
  onClose: () => void
}

interface PerfStats { completados: number; cancelados: number; ingresos: number; horas: number }

export default function CleanerHojaDeVida({ cleaner, photoUrl, onClose }: Props) {
  const supabase = createClient()
  const [signed, setSigned] = useState<string | null>(photoUrl ?? null)
  const [novedades, setNovedades] = useState<Novedad[]>([])
  const [stats, setStats] = useState<PerfStats | null>(null)

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

  // Desempeño: agrega los servicios del auxiliar (completados, horas, ingresos
  // generados y % de cumplimiento). Hace "viva" la hoja de vida.
  useEffect(() => {
    let active = true
    supabase.from('services').select('status, start_time, end_time, price_cop').eq('cleaner_id', cleaner.id)
      .then(({ data }) => {
        if (!active) return
        let completados = 0, cancelados = 0, ingresos = 0, ms = 0
        for (const r of (data ?? []) as { status: string; start_time: string; end_time: string; price_cop: number }[]) {
          if (r.status === 'completed') {
            completados++
            ingresos += Number(r.price_cop) || 0
            ms += Math.max(0, new Date(r.end_time).getTime() - new Date(r.start_time).getTime())
          } else if (r.status === 'canceled') cancelados++
        }
        setStats({ completados, cancelados, ingresos, horas: ms / 3_600_000 })
      })
    return () => { active = false }
  }, [supabase, cleaner.id])

  const cumplimiento = stats && stats.completados + stats.cancelados > 0
    ? Math.round((stats.completados / (stats.completados + stats.cancelados)) * 100)
    : null

  const initials = cleaner.full_name.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase()

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 print:static print:bg-white print:p-0 print:block">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto print:shadow-none print:rounded-none print:max-w-none print:max-h-none print:overflow-visible">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold">Hoja de vida</h2>
          <div className="flex items-center gap-2 print:hidden">
            <button type="button" onClick={() => window.print()} className="text-sm px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700">🖨️ PDF</button>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
          </div>
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

          {/* Desempeño (KPIs derivados de los servicios) */}
          <div>
            <h3 className="text-base font-semibold text-gray-700 mb-2">Desempeño</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Servicios" value={stats ? String(stats.completados) : '…'} sub="completados" />
              <Stat label="Horas" value={stats ? stats.horas.toFixed(0) : '…'} sub="trabajadas" />
              <Stat label="Ingresos" value={stats ? formatCOP(stats.ingresos) : '…'} sub="generados" />
              <Stat label="Cumplimiento" value={cumplimiento != null ? `${cumplimiento}%` : '—'} sub={stats ? `${stats.cancelados} cancelados` : ''} />
            </div>
          </div>

          {/* Ubicación en el mapa (no se imprime) */}
          {cleaner.address && (
            <div className="print:hidden">
              <h3 className="text-base font-semibold text-gray-700 mb-2">Ubicación</h3>
              <MapEmbed mode="place" q={fullAddress(cleaner.address)} title="Ubicación del auxiliar" />
            </div>
          )}

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

        <div className="flex justify-end p-5 border-t print:hidden">
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

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-bold text-gray-800 mt-0.5 truncate" title={value}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
    </div>
  )
}
