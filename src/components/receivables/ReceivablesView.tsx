'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP, fmtDate } from '@/lib/format'
import { buildCsv, downloadCsv } from '@/lib/csv'

interface Inv {
  id: string
  invoice_number: string | null
  issue_date: string
  total_amount: number
  client_id: string
  clients?: { company_name?: string; forma_pago?: string | null } | null
}
interface Pay { id: string; invoice_id: string; amount: number; paid_at: string; method: string | null; note: string | null }

const MEDIOS = ['Efectivo', 'Transferencia', 'Consignación', 'Cheque', 'Otro']
const DIAS_CREDITO = 30
const dayMs = 86_400_000

const companyOf = (i: Inv) => i.clients?.company_name ?? '—'
const dueDateOf = (i: Inv) => new Date(new Date(i.issue_date).getTime() + DIAS_CREDITO * dayMs)

// Hoy en hora de Colombia (UTC-5). En funciones de módulo (no en el render) para
// no violar react-hooks/purity.
const bogotaNow = () => new Date(Date.now() - 5 * 3600_000)
function todayBogotaMs() {
  const n = bogotaNow()
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 5, 0, 0)
}
const todayBogotaStr = () => bogotaNow().toISOString().slice(0, 10)

/** F5/P10 · Cartera (cuentas por cobrar): cruza las facturas validadas con sus
 *  abonos (tabla invoice_payments) para mostrar saldo, estado y mora, y registrar
 *  pagos. El saldo se deriva (total − abonos), nunca se almacena. Conecta
 *  Facturación + Clientes. Solo admin (RLS + guard de página). */
export default function ReceivablesView() {
  const supabase = createClient()
  const { toast } = useUI()
  const [invoices, setInvoices] = useState<Inv[]>([])
  const [payments, setPayments] = useState<Pay[]>([])
  const [loading, setLoading] = useState(true)
  const [soloSaldo, setSoloSaldo] = useState(true)
  const [search, setSearch] = useState('')
  const [modalInv, setModalInv] = useState<Inv | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: inv, error: e1 }, { data: pays, error: e2 }] = await Promise.all([
      supabase.from('invoices').select('id, invoice_number, issue_date, total_amount, client_id, clients(company_name, forma_pago)').eq('billing_status', 'sent_dian').order('issue_date'),
      supabase.from('invoice_payments').select('id, invoice_id, amount, paid_at, method, note'),
    ])
    if (e1 || e2) toast('Error cargando la cartera: ' + (e1?.message ?? e2?.message ?? ''), 'error')
    setInvoices((inv as Inv[]) ?? [])
    setPayments((pays as Pay[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const paidByInvoice = useMemo(() => {
    const m = new Map<string, number>()
    payments.forEach(p => m.set(p.invoice_id, (m.get(p.invoice_id) ?? 0) + Number(p.amount)))
    return m
  }, [payments])

  // Hoy en hora de Colombia (UTC-5), como instante, para calcular mora.
  const hoyMs = useMemo(() => todayBogotaMs(), [])

  const filas = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invoices.map(i => {
      const total = Number(i.total_amount)
      const abonado = paidByInvoice.get(i.id) ?? 0
      const saldo = Math.max(0, total - abonado)
      const due = dueDateOf(i).getTime()
      const moraDias = saldo > 0 && hoyMs > due ? Math.floor((hoyMs - due) / dayMs) : 0
      const estado = saldo <= 0 ? 'pagada' : abonado > 0 ? 'parcial' : 'pendiente'
      return { inv: i, total, abonado, saldo, moraDias, estado }
    })
      .filter(f => (soloSaldo ? f.saldo > 0 : true))
      .filter(f => (q ? companyOf(f.inv).toLowerCase().includes(q) || (f.inv.invoice_number ?? '').toLowerCase().includes(q) : true))
      .sort((a, b) => b.moraDias - a.moraDias || b.saldo - a.saldo)
  }, [invoices, paidByInvoice, soloSaldo, search, hoyMs])

  const totalPorCobrar = filas.reduce((s, f) => s + f.saldo, 0)
  const totalVencido = filas.reduce((s, f) => s + (f.moraDias > 0 ? f.saldo : 0), 0)
  const conSaldo = filas.filter(f => f.saldo > 0).length

  function exportCsv() {
    const headers = ['N° Factura', 'Cliente', 'Forma de pago', 'Emisión', 'Vencimiento', 'Total', 'Abonado', 'Saldo', 'Estado', 'Mora (días)']
    const data = filas.map(f => [
      f.inv.invoice_number ?? 'BORRADOR', companyOf(f.inv), f.inv.clients?.forma_pago ?? '',
      fmtDate(f.inv.issue_date), fmtDate(dueDateOf(f.inv).toISOString()),
      f.total, f.abonado, f.saldo, f.estado, f.moraDias,
    ])
    downloadCsv(`cartera-${new Date(hoyMs).toISOString().slice(0, 10)}`, buildCsv(headers, data))
  }

  const estadoBadge: Record<string, string> = {
    pagada: 'bg-green-100 text-green-700', parcial: 'bg-amber-100 text-amber-700', pendiente: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 shadow-sm p-4">
          <p className="text-xs uppercase text-gray-500 font-semibold">Por cobrar</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{formatCOP(totalPorCobrar)}</p>
          <p className="text-xs text-gray-600 mt-0.5">{conSaldo} factura(s) con saldo</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 shadow-sm p-4">
          <p className="text-xs uppercase text-gray-500 font-semibold">Vencido</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{formatCOP(totalVencido)}</p>
          <p className="text-xs text-gray-600 mt-0.5">saldo de facturas en mora</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-gray-500 font-semibold">Acciones</p>
            <label className="text-xs text-gray-600 mt-2 inline-flex items-center gap-2">
              <input type="checkbox" checked={soloSaldo} onChange={e => setSoloSaldo(e.target.checked)} className="rounded" /> Solo con saldo
            </label>
          </div>
          <button type="button" onClick={exportCsv} disabled={filas.length === 0}
            className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50">
            <span aria-hidden="true">⬇️</span> CSV
          </button>
        </div>
      </div>

      <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente o N° de factura…"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[820px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
            <th className="text-left px-4 py-3">N° Factura</th>
            <th className="text-left px-4 py-3">Cliente</th>
            <th className="text-left px-4 py-3">Vencimiento</th>
            <th className="text-right px-4 py-3">Total</th>
            <th className="text-right px-4 py-3">Abonado</th>
            <th className="text-right px-4 py-3">Saldo</th>
            <th className="text-left px-4 py-3">Estado</th>
            <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={8} className="py-10 text-center text-gray-500">Cargando…</td></tr>}
            {!loading && filas.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-gray-500">Sin facturas en cartera.</td></tr>}
            {!loading && filas.map(f => (
              <tr key={f.inv.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{f.inv.invoice_number ?? 'BORRADOR'}</td>
                <td className="px-4 py-3 text-gray-700">{companyOf(f.inv)}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {fmtDate(dueDateOf(f.inv).toISOString())}
                  {f.moraDias > 0 && <span className="block text-xs text-red-600 font-medium">{f.moraDias} día(s) de mora</span>}
                </td>
                <td className="px-4 py-3 text-right">{formatCOP(f.total)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{formatCOP(f.abonado)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCOP(f.saldo)}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoBadge[f.estado]}`}>{f.estado === 'pagada' ? 'Pagada' : f.estado === 'parcial' ? 'Parcial' : 'Pendiente'}</span></td>
                <td className="px-4 py-3 text-right">
                  {f.saldo > 0 && (
                    <button type="button" onClick={() => setModalInv(f.inv)} className="text-xs px-3 py-1 bg-brand-600 text-white rounded hover:bg-brand-700 whitespace-nowrap">Registrar abono</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {modalInv && (
        <AbonoModal
          invoice={modalInv}
          saldo={Math.max(0, Number(modalInv.total_amount) - (paidByInvoice.get(modalInv.id) ?? 0))}
          payments={payments.filter(p => p.invoice_id === modalInv.id)}
          onClose={() => setModalInv(null)}
          onSaved={(p) => { setPayments(prev => [...prev, p]); setModalInv(null) }}
        />
      )}
    </div>
  )
}

function AbonoModal({ invoice, saldo, payments, onClose, onSaved }: {
  invoice: Inv; saldo: number; payments: Pay[]; onClose: () => void; onSaved: (p: Pay) => void
}) {
  const supabase = createClient()
  const { toast } = useUI()
  const [amount, setAmount] = useState(String(saldo))
  const [paidAt, setPaidAt] = useState(() => todayBogotaStr())
  const [method, setMethod] = useState(MEDIOS[0])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const val = Number(amount)
    if (!(val > 0)) { toast('El monto debe ser mayor a 0.', 'error'); return }
    if (val > saldo + 0.5) { toast('El abono no puede superar el saldo pendiente.', 'error'); return }
    setSaving(true)
    const { data, error } = await supabase
      .from('invoice_payments')
      .insert({ invoice_id: invoice.id, amount: val, paid_at: paidAt, method, note: note || null })
      .select('id, invoice_id, amount, paid_at, method, note')
      .single()
    setSaving(false)
    if (error || !data) { toast('No se pudo registrar el abono: ' + (error?.message ?? ''), 'error'); return }
    toast('Abono registrado.', 'success')
    onSaved(data as Pay)
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-semibold">Registrar abono</h2>
            <p className="text-sm text-gray-500">{invoice.invoice_number ?? 'Factura'} · Saldo {formatCOP(saldo)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Monto (COP)</label>
            <input type="number" title="Monto del abono" inputMode="numeric" min={0} value={amount} onChange={e => setAmount(e.target.value)} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
              <input type="date" title="Fecha del abono" value={paidAt} onChange={e => setPaidAt(e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Medio</label>
              <select title="Medio de pago" value={method} onChange={e => setMethod(e.target.value)} className={input}>
                {MEDIOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nota (opcional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} className={input} placeholder="Ej: consignación Bancolombia" />
          </div>

          {payments.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-600 mb-1">Abonos registrados</p>
              <ul className="space-y-1 text-sm">
                {payments.map(p => (
                  <li key={p.id} className="flex justify-between text-gray-600">
                    <span>{fmtDate(p.paid_at)} · {p.method ?? '—'}</span>
                    <span className="font-medium">{formatCOP(Number(p.amount))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar abono'}
          </button>
        </div>
      </div>
    </div>
  )
}
