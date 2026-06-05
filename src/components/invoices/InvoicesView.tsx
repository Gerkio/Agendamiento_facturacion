'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP } from '@/lib/format'
import { billingLabel, billingCls, serviceLabel, serviceCls } from '@/lib/status'
import { computeTax } from '@/lib/dian/tax'
import { buildCsv, downloadCsv } from '@/lib/csv'
import { bogotaDayStartISO, bogotaDayEndISO, bogotaToday } from '@/lib/dates'
import type { Client, Invoice, Service, CreditNote } from '@/types/database'
import type { EmisorConfig } from '@/lib/dian/emisor-config'

// Modales pesados: solo se cargan al abrirlos (fuera del bundle inicial).
const InvoiceDocument = dynamic(() => import('@/components/invoices/InvoiceDocument'), { ssr: false })
const CreditNoteModal = dynamic(() => import('@/components/invoices/CreditNoteModal'), { ssr: false })

interface Props {
  clients: Client[]
  invoices: Invoice[]
  creditNotes: CreditNote[]
  emisor: EmisorConfig
}

export default function InvoicesView({ clients, invoices: initial, creditNotes: initialNotes, emisor }: Props) {
  const supabase = createClient()
  const { toast, confirm } = useUI()
  const [invoices, setInvoices] = useState(initial)
  const [creditNotes, setCreditNotes] = useState(initialNotes)
  const [cnInvoice, setCnInvoice] = useState<Invoice | null>(null)
  // Mapa factura → nota crédito (en curso o aceptada).
  const noteByInvoice = new Map(creditNotes.map(n => [n.invoice_id, n]))
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selectedClient, setSelectedClient] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'scheduled'>('all')
  const [services, setServices] = useState<Service[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [loadingServices, setLoadingServices] = useState(false)
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [sendingDian, setSendingDian] = useState<string | null>(null)
  // Representación gráfica abierta + sus ítems.
  const [docInvoice, setDocInvoice] = useState<Invoice | null>(null)
  const [docServices, setDocServices] = useState<Service[]>([])
  const [docLoading, setDocLoading] = useState(false)
  // Guarda contra respuestas que llegan fuera de orden al abrir documentos seguidos.
  const docReqRef = useRef(0)

  async function openDocument(inv: Invoice) {
    const reqId = ++docReqRef.current
    setDocInvoice(inv)
    setDocServices([])
    setDocLoading(true)
    const { data, error } = await supabase
      .from('services')
      .select('*, cleaners(full_name)')
      .eq('invoice_id', inv.id)
      .order('start_time')
    if (reqId !== docReqRef.current) return // llegó una apertura más reciente; ignorar
    if (error) toast('No se pudieron cargar los ítems: ' + error.message, 'error')
    setDocServices(data ?? [])
    setDocLoading(false)
  }

  async function searchServices() {
    if (!selectedClient) return
    setLoadingServices(true)
    let query = supabase
      .from('services')
      .select('*, clients(company_name), cleaners(full_name)')
      .eq('client_id', selectedClient)
      .is('invoice_id', null)
    // 'all' = cualquier servicio sin facturar que no esté cancelado.
    query = statusFilter === 'all' ? query.neq('status', 'canceled') : query.eq('status', statusFilter)
    if (dateFrom) query = query.gte('start_time', bogotaDayStartISO(dateFrom))
    if (dateTo) query = query.lte('start_time', bogotaDayEndISO(dateTo))
    // Cota de seguridad: si un cliente acumulara miles de servicios sin facturar,
    // se acotan los resultados y se sugiere filtrar por fechas.
    const { data, error } = await query.order('start_time').limit(200)
    if (error) toast('Error buscando servicios: ' + error.message, 'error')
    setServices(data ?? [])
    setHasSearched(true)
    setLoadingServices(false)
  }

  async function createInvoice() {
    if (!services.length) return
    setCreatingInvoice(true)
    const total = services.reduce((s, x) => s + Number(x.price_cop), 0)
    // El cliente se toma de los servicios buscados (no del dropdown, que pudo cambiar).
    const clientId = services[0].client_id
    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({ client_id: clientId, total_amount: total, billing_status: 'draft' })
      .select()
      .single()
    if (error || !invoice) { toast('Error creando factura: ' + error?.message, 'error'); setCreatingInvoice(false); return }

    // Vincular los servicios. Si falla, revertir la factura para no dejar un borrador huérfano.
    const { error: linkErr } = await supabase.from('services').update({ invoice_id: invoice.id }).in('id', services.map(s => s.id))
    if (linkErr) {
      await supabase.from('invoices').delete().eq('id', invoice.id).eq('billing_status', 'draft')
      toast('No se pudieron vincular los servicios; se canceló la factura: ' + linkErr.message, 'error')
      setCreatingInvoice(false)
      return
    }
    setInvoices(prev => [invoice, ...prev])
    setServices([])
    setHasSearched(false)
    setCreatingInvoice(false)
    toast('Factura en borrador creada.', 'success')
  }

  async function sendToDian(invoice: Invoice) {
    setSendingDian(invoice.id)
    try {
      const res = await fetch('/api/dian/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      })
      const data = await res.json()
      if (data.success) {
        setInvoices(prev => prev.map(i => i.id === invoice.id ? { ...i, ...data.invoice } : i))
        toast('Factura enviada a la DIAN.', 'success')
      } else {
        toast('Error DIAN: ' + (data.error ?? 'desconocido'), 'error')
      }
    } catch (e) {
      toast('Error de red: ' + (e instanceof Error ? e.message : 'desconocido'), 'error')
    }
    setSendingDian(null)
  }

  // F4: libro de facturas en CSV para contabilidad. La base es `total_amount`
  // (suma de los servicios, sin IVA); el IVA y el total se derivan con la tasa
  // configurada del emisor, igual que la representación gráfica.
  function exportLibro() {
    const headers = ['N° Factura', 'Fecha', 'Cliente', 'NIT', 'Base', 'IVA', 'Total', 'Estado', 'CUFE']
    const rows = invoices.map(inv => {
      const cli = inv.clients as { company_name?: string; nit_cedula?: string; dv?: string } | undefined
      const { taxableBase, taxAmount, total } = computeTax([Number(inv.total_amount)], emisor.ivaRate)
      return [
        inv.invoice_number ?? 'BORRADOR',
        new Date(inv.issue_date).toLocaleDateString('es-CO'),
        cli?.company_name ?? '',
        cli?.nit_cedula ? `${cli.nit_cedula}${cli.dv ? `-${cli.dv}` : ''}` : '',
        taxableBase,
        taxAmount,
        total,
        billingLabel(inv.billing_status),
        inv.cufe ?? '',
      ]
    })
    downloadCsv(`libro-facturas-${bogotaToday()}`, buildCsv(headers, rows))
  }

  async function deleteInvoice(invoice: Invoice) {
    // Solo se permite eliminar borradores. Una factura numerada/enviada es un
    // documento fiscal y debe anularse con nota crédito, no borrarse.
    if (invoice.billing_status !== 'draft') {
      toast('Solo se pueden eliminar borradores. Una factura enviada se anula con nota crédito.', 'error')
      return
    }
    const ok = await confirm({
      title: 'Eliminar borrador',
      message: 'Se eliminará este borrador y los servicios asociados volverán a quedar disponibles para facturar. ¿Continuar?',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    setDeleting(invoice.id)
    // Liberar los servicios vinculados antes de borrar la factura.
    await supabase.from('services').update({ invoice_id: null }).eq('invoice_id', invoice.id)
    const { error } = await supabase.from('invoices').delete().eq('id', invoice.id).eq('billing_status', 'draft')
    setDeleting(null)
    if (error) { toast('No se pudo eliminar: ' + error.message, 'error'); return }
    setInvoices(prev => prev.filter(i => i.id !== invoice.id))
    toast('Borrador eliminado. Los servicios quedaron disponibles.', 'success')
  }

  return (
    <div className="space-y-6">
      {/* Billing Engine */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Generar Nueva Factura</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-1">
          <select
            title="Cliente"
            value={selectedClient}
            onChange={e => { setSelectedClient(e.target.value); setServices([]); setHasSearched(false) }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Seleccionar cliente...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          <input type="date" title="Desde" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Desde" />
          <input type="date" title="Hasta" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Hasta" />
          <select title="Estado de los servicios a facturar" value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="all">Todos sin facturar</option>
            <option value="completed">Solo completados</option>
            <option value="scheduled">Solo agendados</option>
          </select>
          <button type="button" onClick={searchServices} disabled={!selectedClient || loadingServices}
            className="bg-gray-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {loadingServices ? 'Buscando...' : 'Buscar Servicios'}
          </button>
        </div>
        <p className="text-xs text-gray-600 mb-4">Sin fechas, busca todos los servicios sin facturar del cliente. «Todos» incluye agendados y completados.</p>

        {services.length > 0 && (
          <div>
            <p className="text-sm text-gray-500 mb-2">{services.length} servicio(s) sin facturar encontrado(s):</p>
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
              <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Fecha</th>
                    <th className="text-left px-4 py-2">Limpiador</th>
                    <th className="text-left px-4 py-2">Estado</th>
                    <th className="text-right px-4 py-2">Precio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {services.map(s => (
                    <tr key={s.id}>
                      <td className="px-4 py-2">{new Date(s.start_time).toLocaleDateString('es-CO')}</td>
                      <td className="px-4 py-2">{(s.cleaners as { full_name: string } | undefined)?.full_name ?? '—'}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${serviceCls(s.status)}`}>
                          {serviceLabel(s.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{formatCOP(Number(s.price_cop))}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={3} className="px-4 py-2 text-right">Total:</td>
                    <td className="px-4 py-2 text-right text-brand-700">
                      {formatCOP(services.reduce((s, x) => s + Number(x.price_cop), 0))}
                    </td>
                  </tr>
                </tbody>
              </table></div>
            </div>
            <button type="button" onClick={createInvoice} disabled={creatingInvoice}
              className="bg-brand-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {creatingInvoice ? 'Creando...' : 'Crear Factura en Borrador'}
            </button>
          </div>
        )}
        {services.length === 0 && hasSearched && !loadingServices && (
          <p className="text-sm text-gray-600 italic">No se encontraron servicios sin facturar para este cliente con el filtro seleccionado.</p>
        )}
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-700">Facturas ({invoices.length})</h2>
          <button type="button" onClick={exportLibro} disabled={invoices.length === 0}
            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50">
            <span aria-hidden="true">⬇️</span> Exportar libro (CSV)
          </button>
        </div>
        <div className="overflow-x-auto hidden md:block"><table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-3">N° Factura</th>
              <th className="text-left px-5 py-3">Cliente</th>
              <th className="text-left px-5 py-3">Fecha</th>
              <th className="text-right px-5 py-3">Total</th>
              <th className="text-left px-5 py-3">Estado</th>
              <th className="px-5 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-600">Sin facturas generadas</td></tr>
            )}
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-mono text-xs">{inv.invoice_number ?? 'BORRADOR'}</td>
                <td className="px-5 py-3">{(inv.clients as { company_name: string } | undefined)?.company_name ?? '—'}</td>
                <td className="px-5 py-3 text-gray-500">{new Date(inv.issue_date).toLocaleDateString('es-CO')}</td>
                <td className="px-5 py-3 text-right font-medium">{formatCOP(Number(inv.total_amount))}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${billingCls(inv.billing_status)}`}>
                    {billingLabel(inv.billing_status)}
                  </span>
                </td>
                <td className="px-5 py-3 flex gap-2 justify-end">
                  <button type="button" onClick={() => openDocument(inv)} className="text-brand-600 hover:underline text-xs font-medium">Ver factura</button>
                  {inv.billing_status === 'draft' && (
                    <>
                      <button
                        type="button"
                        onClick={() => sendToDian(inv)}
                        disabled={sendingDian === inv.id}
                        className="text-xs px-3 py-1 bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
                      >
                        {sendingDian === inv.id ? 'Enviando...' : 'Enviar DIAN'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteInvoice(inv)}
                        disabled={deleting === inv.id}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        {deleting === inv.id ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    </>
                  )}
                  {inv.billing_status === 'sent_dian' && (
                    noteByInvoice.has(inv.id) ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700"
                        title={noteByInvoice.get(inv.id)?.billing_status === 'sent_dian' ? 'Anulada/corregida por nota crédito' : 'Nota crédito en proceso'}>
                        NC {noteByInvoice.get(inv.id)?.note_number ?? '…'}
                      </span>
                    ) : (
                      <button type="button" onClick={() => setCnInvoice(inv)}
                        className="text-xs px-3 py-1 border border-purple-300 text-purple-700 rounded hover:bg-purple-50">
                        Nota crédito
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>

        {/* Vista de tarjetas (móvil) */}
        <div className="md:hidden divide-y divide-gray-100">
          {invoices.length === 0 && (
            <p className="text-center py-10 text-gray-600">Sin facturas generadas</p>
          )}
          {invoices.map(inv => (
            <div key={inv.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-gray-800">{inv.invoice_number ?? 'BORRADOR'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${billingCls(inv.billing_status)}`}>
                  {billingLabel(inv.billing_status)}
                </span>
              </div>
              <div className="mt-1 text-sm text-gray-600 flex items-center justify-between gap-2">
                <span className="truncate">{(inv.clients as { company_name: string } | undefined)?.company_name ?? '—'}</span>
                <span className="font-medium text-gray-800 whitespace-nowrap">{formatCOP(Number(inv.total_amount))}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{new Date(inv.issue_date).toLocaleDateString('es-CO')}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => openDocument(inv)} className="flex-1 min-w-[100px] py-2 rounded-lg border border-brand-300 text-brand-700 font-medium hover:bg-brand-50">Ver factura</button>
                {inv.billing_status === 'draft' && (
                  <>
                    <button type="button" onClick={() => sendToDian(inv)} disabled={sendingDian === inv.id}
                      className="flex-1 min-w-[100px] py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50">
                      {sendingDian === inv.id ? 'Enviando…' : 'Enviar DIAN'}
                    </button>
                    <button type="button" onClick={() => deleteInvoice(inv)} disabled={deleting === inv.id}
                      className="flex-1 min-w-[100px] py-2 rounded-lg border border-red-300 text-red-600 font-medium hover:bg-red-50 disabled:opacity-50">
                      {deleting === inv.id ? 'Eliminando…' : 'Eliminar'}
                    </button>
                  </>
                )}
                {inv.billing_status === 'sent_dian' && (
                  noteByInvoice.has(inv.id) ? (
                    <span className="flex-1 min-w-[100px] py-2 text-center rounded-lg bg-purple-100 text-purple-700 font-medium">
                      NC {noteByInvoice.get(inv.id)?.note_number ?? '…'}
                    </span>
                  ) : (
                    <button type="button" onClick={() => setCnInvoice(inv)}
                      className="flex-1 min-w-[100px] py-2 rounded-lg border border-purple-300 text-purple-700 font-medium hover:bg-purple-50">
                      Nota crédito
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Representación gráfica de la factura */}
      {docInvoice && (
        <InvoiceDocument
          invoice={docInvoice}
          client={clients.find(c => c.id === docInvoice.client_id)}
          services={docServices}
          emisor={emisor}
          loadingServices={docLoading}
          onClose={() => setDocInvoice(null)}
        />
      )}

      {/* Emisión de nota crédito */}
      {cnInvoice && (
        <CreditNoteModal
          invoice={cnInvoice}
          onClose={() => setCnInvoice(null)}
          onDone={(note) => { setCreditNotes(prev => [note, ...prev]); setCnInvoice(null) }}
        />
      )}
    </div>
  )
}
