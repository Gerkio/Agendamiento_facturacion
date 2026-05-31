'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { Client, Invoice, Service } from '@/types/database'
import type { EmisorConfig } from '@/lib/dian/emisor-config'
import { numeroALetras } from '@/lib/dian/number-to-words'
import { cityName } from '@/lib/dian/cities'
import { computeTax } from '@/lib/dian/tax'
import { formatCOP } from '@/lib/format'

interface Props {
  invoice: Invoice
  client: Client | undefined
  services: Service[]
  emisor: EmisorConfig
  loadingServices: boolean
  onClose: () => void
}

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'BORRADOR — PROFORMA', cls: 'bg-gray-100 text-gray-600 border-gray-300' },
  processing: { label: 'PROCESANDO', cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  signed: { label: 'FIRMADA', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  sent_dian: { label: 'VALIDADA POR LA DIAN', cls: 'bg-green-100 text-green-700 border-green-300' },
  rejected: { label: 'RECHAZADA', cls: 'bg-red-100 text-red-700 border-red-300' },
}

export default function InvoiceDocument({ invoice, client, services, emisor, loadingServices, onClose }: Props) {
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const isFiscal = invoice.billing_status === 'sent_dian'
  const isDraft = invoice.billing_status === 'draft' || invoice.billing_status === 'processing'

  useEffect(() => {
    let active = true
    if (invoice.qr_content) {
      QRCode.toDataURL(invoice.qr_content, { margin: 1, width: 180, errorCorrectionLevel: 'M' })
        .then(u => { if (active) setQrUrl(u) })
        .catch(() => { if (active) setQrUrl(null) })
    } else {
      setQrUrl(null)
    }
    return () => { active = false }
  }, [invoice.qr_content])

  // IVA con la tasa configurada (coincide con lo que se emite a la DIAN).
  const { taxableBase: subtotal, taxAmount: iva, total } = computeTax(services.map(s => Number(s.price_cop)), emisor.ivaRate)
  const issue = new Date(invoice.issue_date)
  const dueDate = new Date(issue)
  dueDate.setDate(dueDate.getDate() + 30)

  const fmtDate = (d: Date) => d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const fmtDateTime = (d: Date) =>
    d.toLocaleString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto print:bg-white print:p-0 print:overflow-visible">
      {/* Barra de acciones — no se imprime */}
      <div className="w-full max-w-3xl print:max-w-none">
        <div className="flex items-center justify-between mb-3 print:hidden">
          <h2 className="text-white font-semibold">Representación gráfica</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700"
            >
              🖨️ Imprimir / Guardar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-white text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* HOJA DE LA FACTURA */}
        <div id="invoice-doc" className="bg-white rounded-xl shadow-xl p-8 text-gray-800 print:rounded-none print:shadow-none print:p-6">
          {/* Avisos */}
          {!emisor.configured && (
            <div className="mb-4 bg-amber-50 border border-amber-300 text-amber-800 text-xs rounded-lg px-3 py-2 print:hidden">
              ⚠️ Datos del emisor de <strong>demostración</strong>. Configura las variables <code>COMPANY_*</code> e <code>INVOICE_*</code> con los datos reales y la resolución DIAN antes de emitir.
            </div>
          )}
          {emisor.environment === '2' && (
            <div className="mb-4 bg-blue-50 border border-blue-300 text-blue-800 text-xs rounded-lg px-3 py-2 print:hidden">
              🧪 Ambiente de <strong>PRUEBAS (habilitación)</strong>. Las facturas aquí no tienen validez fiscal.
            </div>
          )}

          {/* Encabezado: emisor + título */}
          <div className="flex justify-between items-start gap-6 border-b-2 border-gray-800 pb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-14 h-14 rounded-lg bg-brand-600 text-white flex items-center justify-center text-2xl font-bold shrink-0">
                  {(emisor.name || 'A').charAt(0)}
                </div>
                <div>
                  <h1 className="text-lg font-bold leading-tight">{emisor.name}</h1>
                  <p className="text-xs text-gray-500">Servicios de aseo y limpieza</p>
                </div>
              </div>
              <div className="text-xs text-gray-600 space-y-0.5 mt-2">
                <p><span className="text-gray-600">NIT:</span> {emisor.nit}{emisor.dv ? `-${emisor.dv}` : ''} · <span className="text-gray-600">Régimen:</span> {emisor.fiscalRegimen || '—'}</p>
                <p>{emisor.address}{emisor.cityCode ? ` · ${cityName(emisor.cityCode)}` : ''}</p>
                <p>Tel: {emisor.phone || '—'} · {emisor.email || '—'}</p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <h2 className="text-sm font-bold text-gray-800 uppercase leading-tight">Factura Electrónica<br />de Venta</h2>
              <div className="mt-2 border-2 border-gray-800 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-600 uppercase">N° Factura</p>
                <p className="text-lg font-bold font-mono">{invoice.invoice_number ?? 'SIN ASIGNAR'}</p>
              </div>
              <span className={`inline-block mt-2 text-xs font-semibold px-2 py-1 rounded border ${STATUS[invoice.billing_status]?.cls ?? ''}`}>
                {STATUS[invoice.billing_status]?.label ?? invoice.billing_status}
              </span>
            </div>
          </div>

          {/* Resolución DIAN */}
          <div className="mt-3 bg-gray-50 rounded-lg px-4 py-2 text-xs text-gray-600 leading-snug">
            <strong>Resolución DIAN de facturación:</strong>{' '}
            {emisor.resolutionNumber ? (
              <>
                N° {emisor.resolutionNumber} del {emisor.resolutionDate}. Autoriza el prefijo{' '}
                <strong>{emisor.invoicePrefix}</strong> desde el <strong>{emisor.fromNumber}</strong> hasta el{' '}
                <strong>{emisor.toNumber}</strong>.
              </>
            ) : (
              <span className="text-amber-600">No configurada.</span>
            )}
          </div>

          {/* Adquiriente + fechas */}
          <div className="grid grid-cols-2 gap-6 mt-5">
            <div>
              <p className="text-xs uppercase text-gray-600 font-semibold mb-1">Adquiriente / Cliente</p>
              <p className="font-semibold text-sm">{client?.company_name ?? (invoice.clients as { company_name?: string } | undefined)?.company_name ?? '—'}</p>
              <div className="text-xs text-gray-600 space-y-0.5 mt-1">
                <p>NIT/CC: {client?.nit_cedula ?? '—'}{client?.dv ? `-${client.dv}` : ''}</p>
                {client?.address && <p>{client.address}{client.city_code ? ` · ${cityName(client.city_code)}` : ''}</p>}
                {client?.email && <p>{client.email}</p>}
                {client?.phone && <p>Tel: {client.phone}</p>}
                <p>Régimen: {client?.fiscal_regimen ?? '—'}</p>
              </div>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <Row k="Fecha de generación" v={fmtDateTime(issue)} />
              <Row k="Fecha de vencimiento" v={fmtDate(dueDate)} />
              <Row k="Forma de pago" v="Crédito (30 días)" />
              <Row k="Medio de pago" v="Transferencia / Consignación" />
              <Row k="Moneda" v="COP — Peso colombiano" />
              <Row k="Ambiente" v={emisor.environment === '1' ? 'Producción' : 'Pruebas (habilitación)'} />
            </div>
          </div>

          {/* Ítems */}
          <table className="w-full text-xs mt-5 border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="text-left px-3 py-2 font-semibold">#</th>
                <th className="text-left px-3 py-2 font-semibold">Descripción</th>
                <th className="text-center px-3 py-2 font-semibold">Cant.</th>
                <th className="text-right px-3 py-2 font-semibold">Vr. Unitario</th>
                <th className="text-right px-3 py-2 font-semibold">Vr. Total</th>
              </tr>
            </thead>
            <tbody>
              {loadingServices && (
                <tr><td colSpan={5} className="text-center py-6 text-gray-600">Cargando ítems…</td></tr>
              )}
              {!loadingServices && services.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-gray-600">Sin ítems vinculados.</td></tr>
              )}
              {services.map((s, i) => {
                const d = new Date(s.start_time)
                const cleaner = (s.cleaners as { full_name?: string } | undefined)?.full_name
                return (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 align-top">{i + 1}</td>
                    <td className="px-3 py-2 align-top">
                      Servicio de aseo — {d.toLocaleDateString('es-CO')}
                      <span className="block text-xs text-gray-600">
                        {d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        {cleaner ? ` · Aux: ${cleaner}` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center align-top">1</td>
                    <td className="px-3 py-2 text-right align-top">{formatCOP(Number(s.price_cop))}</td>
                    <td className="px-3 py-2 text-right align-top font-medium">{formatCOP(Number(s.price_cop))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Totales + valor en letras */}
          <div className="flex justify-between items-start gap-6 mt-4">
            <div className="flex-1 text-xs">
              <p className="text-xs uppercase text-gray-600 font-semibold">Valor en letras</p>
              <p className="font-medium text-gray-700 mt-0.5">{numeroALetras(total)}</p>
            </div>
            <div className="w-64 text-sm">
              <TotalRow k="Subtotal" v={formatCOP(subtotal)} />
              <TotalRow k={emisor.ivaRate > 0 ? `IVA (${emisor.ivaRate}%)` : 'IVA'} v={formatCOP(iva)} />
              <div className="flex justify-between border-t-2 border-gray-800 mt-1 pt-1 font-bold">
                <span>TOTAL A PAGAR</span>
                <span className="text-brand-700">{formatCOP(total)}</span>
              </div>
            </div>
          </div>

          {/* CUFE + QR */}
          <div className="mt-6 border-t border-gray-200 pt-4 flex gap-5 items-start">
            <div className="shrink-0">
              {qrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrUrl} alt="Código QR DIAN" className="w-32 h-32 border border-gray-200 rounded" />
              ) : (
                <div className="w-32 h-32 border border-dashed border-gray-300 rounded flex items-center justify-center text-xs text-gray-600 text-center px-2">
                  {isDraft ? 'QR disponible al validar en la DIAN' : 'Sin QR'}
                </div>
              )}
            </div>
            <div className="flex-1 text-xs text-gray-500 leading-relaxed">
              <p className="font-semibold text-gray-600 text-xs">CUFE</p>
              <p className="font-mono break-all">{invoice.cufe ?? '— (se genera al validar en la DIAN)'}</p>
              {invoice.dian_response_description && (
                <p className="mt-1"><span className="text-gray-600">Respuesta DIAN:</span> {invoice.dian_response_description}</p>
              )}
              <p className="mt-2">
                {isFiscal
                  ? 'Documento equivalente a la factura electrónica de venta, generado y validado por la DIAN. Verifique en catalogo-vpfe.dian.gov.co escaneando el código QR.'
                  : 'Esta es una PROFORMA sin validez fiscal: aún no tiene numeración autorizada, CUFE ni validación de la DIAN. Se convierte en factura legal al enviarla y ser validada por la DIAN.'}
              </p>
              <p className="mt-1 text-gray-600">Software propio · Representación gráfica generada el {fmtDateTime(issue)}.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-600">{k}:</span>
      <span className="text-gray-700 text-right">{v}</span>
    </div>
  )
}

function TotalRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-gray-600">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  )
}
