'use client'

import { useEffect } from 'react'
import { turnoLabel } from '@/lib/service-catalog'
import { fullAddress } from '@/lib/maps'
import MapEmbed from '@/components/map/MapEmbed'
import type { Service, Client, Cleaner } from '@/types/database'

/** Detalle de solo lectura de un servicio, pensado para el aseador (incluye indicaciones de llegada). */
export default function ServiceDetail({ service, onClose }: { service: Service; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const client = service.clients as Partial<Client> | undefined
  const cleaner = service.cleaners as Partial<Cleaner> | undefined
  const start = new Date(service.start_time)
  const end = new Date(service.end_time)
  const fmtTime = (d: Date) => d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
  const fmtDate = (d: Date) => d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">Detalle del servicio</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <div>
            <div className="text-xs text-gray-600">Cliente</div>
            <div className="text-base font-semibold text-gray-800">{client?.company_name ?? 'Cliente'}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-600">Fecha</div>
              <div className="capitalize text-gray-700">{fmtDate(start)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Horario</div>
              <div className="text-gray-700">{fmtTime(start)} – {fmtTime(end)}</div>
            </div>
            {service.turno && (
              <div>
                <div className="text-xs text-gray-600">Turno</div>
                <div className="text-gray-700">{turnoLabel(service.turno)}</div>
              </div>
            )}
          </div>

          {service.service_type && (
            <div>
              <div className="text-xs text-gray-600">Tipo de servicio</div>
              <div className="text-gray-700">{service.service_type}</div>
            </div>
          )}

          <div>
            <div className="text-xs text-gray-600">Dirección</div>
            <div className="text-gray-700">{client?.address || '—'}</div>
          </div>

          {service.obs_auxiliar && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-amber-800 flex items-center gap-1 mb-1">📋 Observaciones para ti</div>
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{service.obs_auxiliar}</p>
            </div>
          )}

          {client?.phone && (
            <div>
              <div className="text-xs text-gray-600">Teléfono</div>
              <a href={`tel:${client.phone}`} className="text-brand-700 underline">{client.phone}</a>
            </div>
          )}

          {/* Indicaciones de llegada — lo más importante para el aseador */}
          <div className="bg-brand-50 border border-brand-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-brand-700 flex items-center gap-1 mb-1">🧭 Indicaciones de llegada</div>
            {client?.indicaciones
              ? <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{client.indicaciones}</p>
              : <p className="text-gray-600 italic">Sin indicaciones registradas para este cliente.</p>}
          </div>

          {/* Cómo llegar: ruta en transporte público desde tu casa al cliente. */}
          {client?.address && (
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">🚌 Cómo llegar (transporte público)</div>
              <MapEmbed
                mode="directions"
                origin={fullAddress(cleaner?.address)}
                destination={fullAddress(client.address, client.city_code)}
                title="Ruta al cliente"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
