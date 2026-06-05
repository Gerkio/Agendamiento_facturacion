'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP } from '@/lib/format'
import { serviceCls, serviceLabel, billingCls, billingLabel } from '@/lib/status'
import { buildCsv, downloadCsv } from '@/lib/csv'
import type { Service } from '@/types/database'

interface Props {
  services: Service[]
  cleaners: { id: string; full_name: string }[]
  clients: { id: string; company_name: string }[]
}

type StatusFilter = 'all' | 'scheduled' | 'completed' | 'canceled'

const companyOf = (s: Service) => (s.clients as { company_name?: string } | undefined)?.company_name ?? '—'
const cleanerOf = (s: Service) => (s.cleaners as { full_name?: string } | undefined)?.full_name ?? '—'
const bogota = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleString('es-CO', { ...opts, timeZone: 'America/Bogota' })

/** Historial global de TODOS los servicios: filtros (fecha, auxiliar, cliente,
 *  estado), búsqueda, exportación a CSV y facturación 1-click de un servicio
 *  completado sin factura (conecta Agenda → Facturación). */
export default function ServicesHistory({ services, cleaners, clients }: Props) {
  const supabase = createClient()
  const { toast } = useUI()
  const [rows, setRows] = useState<Service[]>(services)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [cleanerId, setCleanerId] = useState('')
  const [clientId, setClientId] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [facturando, setFacturando] = useState<string | null>(null)

  // Límites de fecha en hora de Colombia (UTC-5); start_time se guarda en UTC.
  const toUtcMs = (date: string, endOfDay: boolean) =>
    new Date(`${date}T${endOfDay ? '23:59:59.999' : '00:00:00'}-05:00`).getTime()

  const filtered = useMemo(() => {
    const fromMs = from ? toUtcMs(from, false) : null
    const toMs = to ? toUtcMs(to, true) : null
    const q = search.trim().toLowerCase()
    return rows.filter(s => {
      const t = new Date(s.start_time).getTime()
      if (fromMs != null && t < fromMs) return false
      if (toMs != null && t > toMs) return false
      if (cleanerId && s.cleaner_id !== cleanerId) return false
      if (clientId && s.client_id !== clientId) return false
      if (status !== 'all' && s.status !== status) return false
      if (q) {
        const hay = `${companyOf(s)} ${cleanerOf(s)} ${s.service_type ?? ''} ${s.service_class ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, from, to, cleanerId, clientId, status, search])

  const totalCop = filtered.reduce((sum, s) => sum + Number(s.price_cop), 0)
  const hasFilters = Boolean(from || to || cleanerId || clientId || status !== 'all' || search.trim())

  function clearFilters() {
    setFrom(''); setTo(''); setCleanerId(''); setClientId(''); setStatus('all'); setSearch('')
  }

  function exportCsv() {
    const headers = ['Fecha', 'Hora', 'Cliente', 'Auxiliar', 'Clase', 'Tipo', 'Estado', 'N° Factura', 'Estado factura', 'Precio (COP)']
    const data = filtered.map(s => [
      bogota(s.start_time, { dateStyle: 'short' }),
      bogota(s.start_time, { timeStyle: 'short' }),
      companyOf(s),
      cleanerOf(s),
      s.service_class ?? '',
      s.service_type ?? '',
      serviceLabel(s.status),
      s.invoices?.invoice_number ?? (s.invoice_id ? 'BORRADOR' : ''),
      s.invoices ? billingLabel(s.invoices.billing_status) : '',
      Number(s.price_cop),
    ])
    const stamp = bogota(new Date().toISOString(), { dateStyle: 'short' }).replace(/\//g, '-')
    downloadCsv(`historial-servicios-${stamp}`, buildCsv(headers, data))
  }

  // F1: crea un borrador de factura con un único servicio completado y lo vincula.
  async function facturar(s: Service) {
    setFacturando(s.id)
    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({ client_id: s.client_id, total_amount: Number(s.price_cop), billing_status: 'draft' })
      .select('id, invoice_number, billing_status')
      .single()
    if (error || !invoice) { toast('Error creando factura: ' + (error?.message ?? 'desconocido'), 'error'); setFacturando(null); return }

    // Vincular sólo si sigue sin factura (evita doble facturación). Si falla, revertir.
    const { error: linkErr, count } = await supabase
      .from('services')
      .update({ invoice_id: invoice.id }, { count: 'exact' })
      .eq('id', s.id)
      .is('invoice_id', null)
    if (linkErr || !count) {
      await supabase.from('invoices').delete().eq('id', invoice.id).eq('billing_status', 'draft')
      toast(linkErr ? 'No se pudo vincular el servicio; se canceló la factura.' : 'El servicio ya tenía factura.', 'error')
      setFacturando(null)
      return
    }
    setRows(prev => prev.map(r => r.id === s.id
      ? { ...r, invoice_id: invoice.id, invoices: { invoice_number: invoice.invoice_number, billing_status: invoice.billing_status } }
      : r))
    setFacturando(null)
    toast('Borrador de factura creado. Ábrelo en Facturación para enviarlo a la DIAN.', 'success')
  }

  const selectCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input type="date" title="Desde" value={from} onChange={e => setFrom(e.target.value)} className={selectCls} />
          <input type="date" title="Hasta" value={to} onChange={e => setTo(e.target.value)} className={selectCls} />
          <select title="Auxiliar" value={cleanerId} onChange={e => setCleanerId(e.target.value)} className={selectCls}>
            <option value="">Todos los auxiliares</option>
            {cleaners.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <select title="Cliente" value={clientId} onChange={e => setClientId(e.target.value)} className={selectCls}>
            <option value="">Todos los clientes</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          <select title="Estado" value={status} onChange={e => setStatus(e.target.value as StatusFilter)} className={selectCls}>
            <option value="all">Todos los estados</option>
            <option value="scheduled">Agendados</option>
            <option value="completed">Completados</option>
            <option value="canceled">Cancelados</option>
          </select>
          <input type="search" title="Buscar" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente, auxiliar, tipo…" className={`${selectCls} lg:col-span-2`} />
          <button type="button" onClick={clearFilters} disabled={!hasFilters}
            className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            Limpiar filtros
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100">
          <p className="text-sm text-gray-600">
            <strong>{filtered.length}</strong> servicio(s) · Total <strong className="text-brand-700">{formatCOP(totalCop)}</strong>
          </p>
          <button type="button" onClick={exportCsv} disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50">
            <span aria-hidden="true">⬇️</span> Exportar CSV
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[820px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
            <th className="text-left px-4 py-3">Fecha</th>
            <th className="text-left px-4 py-3">Cliente</th>
            <th className="text-left px-4 py-3">Auxiliar</th>
            <th className="text-left px-4 py-3">Clase</th>
            <th className="text-left px-4 py-3">Estado</th>
            <th className="text-left px-4 py-3">Factura</th>
            <th className="text-right px-4 py-3">Precio</th>
            <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="py-10 text-center text-gray-500">Sin servicios para los filtros seleccionados.</td></tr>
            )}
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{bogota(s.start_time, { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className="px-4 py-3 text-gray-700">{companyOf(s)}</td>
                <td className="px-4 py-3 text-gray-700">{cleanerOf(s)}</td>
                <td className="px-4 py-3 text-gray-600">{s.service_class ?? '—'}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${serviceCls(s.status)}`}>{serviceLabel(s.status)}</span></td>
                <td className="px-4 py-3">
                  {s.invoices ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-mono text-xs text-gray-600">{s.invoices.invoice_number ?? 'BORRADOR'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${billingCls(s.invoices.billing_status)}`}>{billingLabel(s.invoices.billing_status)}</span>
                    </span>
                  ) : s.invoice_id ? (
                    <span className="text-xs text-gray-500">Borrador</span>
                  ) : (
                    <span className="text-xs text-gray-400">Sin facturar</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatCOP(Number(s.price_cop))}</td>
                <td className="px-4 py-3 text-right">
                  {s.status === 'completed' && !s.invoice_id && (
                    <button type="button" onClick={() => facturar(s)} disabled={facturando === s.id}
                      className="text-xs px-3 py-1 bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap">
                      {facturando === s.id ? 'Creando…' : 'Facturar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  )
}
