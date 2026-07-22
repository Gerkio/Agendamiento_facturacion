'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP, fmtDate } from '@/lib/format'
import { buildCsv, downloadCsv } from '@/lib/csv'
import { bogotaToday } from '@/lib/dates'
import { numeroALetras } from '@/lib/dian/number-to-words'
import { MEDIOS_GASTO } from '@/lib/expenses'
import type { PaymentReceipt } from '@/types/database'

interface Props {
  initialReceipts: PaymentReceipt[]
  clients: { id: string; company_name: string }[]
  emisorName: string
}

interface ReceiptLine { invoice_number: string | null; amount: number }
const companyOf = (r: PaymentReceipt) => r.clients?.company_name ?? '—'

/** Recibos de caja: libro de comprobantes de pago del cliente, emisión (con
 *  distribución entre facturas), impresión y devolución/anulación. Solo admin. */
export default function ReceiptsView({ initialReceipts, clients, emisorName }: Props) {
  const supabase = createClient()
  const { toast } = useUI()
  const [rows, setRows] = useState<PaymentReceipt[]>(initialReceipts)
  const [search, setSearch] = useState('')
  const [soloActivos, setSoloActivos] = useState(false)
  const [emit, setEmit] = useState(false)
  const [printDoc, setPrintDoc] = useState<{ receipt: PaymentReceipt; lines: ReceiptLine[] } | null>(null)
  const [anularTarget, setAnularTarget] = useState<PaymentReceipt | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (soloActivos && r.status !== 'activo') return false
      if (q) {
        const hay = `${r.receipt_number ?? ''} ${companyOf(r)}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, search, soloActivos])

  async function openPrint(r: PaymentReceipt) {
    const { data } = await supabase.from('invoice_payments').select('amount, invoices(invoice_number)').eq('receipt_id', r.id)
    const lines: ReceiptLine[] = ((data ?? []) as { amount: number; invoices?: { invoice_number?: string | null } | null }[])
      .map(p => ({ invoice_number: p.invoices?.invoice_number ?? null, amount: Number(p.amount) }))
    setPrintDoc({ receipt: r, lines })
  }

  function exportCsv() {
    const headers = ['Recibo', 'Fecha', 'Cliente', 'Total', 'Medio', 'Estado']
    const data = filtered.map(r => [r.receipt_number ?? '', fmtDate(r.issue_date), companyOf(r), Number(r.total_amount), r.method ?? '', r.status])
    downloadCsv(`recibos-${bogotaToday()}`, buildCsv(headers, data))
  }

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar recibo o cliente…" className={`${inputCls} flex-1 min-w-[160px]`} />
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} className="rounded" /> Solo activos
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"><span aria-hidden="true">⬇️</span> CSV</button>
          <button type="button" onClick={() => setEmit(true)} className="text-sm px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700">+ Emitir recibo</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[680px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
            <th className="text-left px-4 py-3">Recibo</th>
            <th className="text-left px-4 py-3">Fecha</th>
            <th className="text-left px-4 py-3">Cliente</th>
            <th className="text-right px-4 py-3">Total</th>
            <th className="text-left px-4 py-3">Estado</th>
            <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-500">Sin recibos.</td></tr>}
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{r.receipt_number ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.issue_date)}</td>
                <td className="px-4 py-3 text-gray-700">{companyOf(r)}</td>
                <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatCOP(Number(r.total_amount))}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === 'activo' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{r.status === 'activo' ? 'Activo' : 'Anulado'}</span></td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button type="button" onClick={() => openPrint(r)} className="text-brand-600 hover:underline text-xs font-medium mr-3">Ver / Imprimir</button>
                  {r.status === 'activo' && <button type="button" onClick={() => setAnularTarget(r)} className="text-red-500 hover:underline text-xs">Anular</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {emit && (
        <EmitModal clients={clients} onClose={() => setEmit(false)} onEmitted={(r, lines) => { setRows(prev => [r, ...prev]); setEmit(false); setPrintDoc({ receipt: r, lines }) }} />
      )}
      {printDoc && (
        <ReceiptPrint receipt={printDoc.receipt} lines={printDoc.lines} emisorName={emisorName} onClose={() => setPrintDoc(null)} />
      )}
      {anularTarget && (
        <AnularModal receipt={anularTarget} onClose={() => setAnularTarget(null)}
          onDone={(id, reason) => { setRows(prev => prev.map(x => x.id === id ? { ...x, status: 'anulado', reversal_reason: reason } : x)); setAnularTarget(null) }} />
      )}
    </div>
  )
}

function AnularModal({ receipt, onClose, onDone }: {
  receipt: PaymentReceipt
  onClose: () => void
  onDone: (id: string, reason: string) => void
}) {
  const supabase = createClient()
  const { toast } = useUI()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function anular() {
    setBusy(true)
    const { error } = await supabase.rpc('reverse_payment_receipt', { p_receipt_id: receipt.id, p_reason: reason.trim() || null })
    setBusy(false)
    if (error) { toast('No se pudo anular: ' + error.message, 'error'); return }
    toast('Recibo anulado. El saldo volvió a las facturas.', 'success')
    onDone(receipt.id, reason.trim())
  }

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">Anular recibo {receipt.receipt_number}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-600">Se anulará el recibo y el saldo volverá a las facturas abonadas. Queda registrado y no se puede deshacer.</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Motivo de la anulación</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" placeholder="Ej: pago revertido / error de digitación" />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={anular} disabled={busy} className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{busy ? 'Anulando…' : 'Anular recibo'}</button>
        </div>
      </div>
    </div>
  )
}

function EmitModal({ clients, onClose, onEmitted }: {
  clients: { id: string; company_name: string }[]
  onClose: () => void
  onEmitted: (r: PaymentReceipt, lines: ReceiptLine[]) => void
}) {
  const supabase = createClient()
  const { toast } = useUI()
  const [clientId, setClientId] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  // Facturas con saldo del cliente: { id, number, saldo, checked, amount }
  const [items, setItems] = useState<{ id: string; number: string | null; saldo: number; checked: boolean; amount: string }[]>([])
  const [method, setMethod] = useState(MEDIOS_GASTO[1])
  const [issueDate, setIssueDate] = useState(bogotaToday())
  const [note, setNote] = useState('')

  async function loadInvoices(cid: string) {
    setClientId(cid); setItems([])
    if (!cid) return
    setLoading(true)
    const [{ data: inv }, { data: pays }] = await Promise.all([
      supabase.from('invoices').select('id, invoice_number, total_amount').eq('client_id', cid).eq('billing_status', 'sent_dian').order('issue_date'),
      supabase.from('invoice_payments').select('invoice_id, amount'),
    ])
    const paid = new Map<string, number>()
    ;((pays ?? []) as { invoice_id: string; amount: number }[]).forEach(p => paid.set(p.invoice_id, (paid.get(p.invoice_id) ?? 0) + Number(p.amount)))
    const list = ((inv ?? []) as { id: string; invoice_number: string | null; total_amount: number }[])
      .map(i => ({ id: i.id, number: i.invoice_number, saldo: Math.max(0, Number(i.total_amount) - (paid.get(i.id) ?? 0)) }))
      .filter(i => i.saldo > 0)
      .map(i => ({ ...i, checked: false, amount: String(i.saldo) }))
    setItems(list)
    setLoading(false)
  }

  const total = items.filter(i => i.checked).reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const setItem = (id: string, patch: Partial<{ checked: boolean; amount: string }>) => setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))

  async function emitir() {
    const chosen = items.filter(i => i.checked && Number(i.amount) > 0)
    if (!chosen.length) { toast('Selecciona al menos una factura con monto.', 'error'); return }
    for (const i of chosen) if (Number(i.amount) > i.saldo + 0.5) { toast(`El abono a ${i.number} supera su saldo.`, 'error'); return }
    setSaving(true)
    // Emisión atómica en el servidor: cabecera + abonos en una sola transacción
    // (RPC emit_payment_receipt). El total lo calcula la BD como suma de líneas.
    const { data: receipt, error } = await supabase.rpc('emit_payment_receipt', {
      p_client_id: clientId,
      p_issue_date: issueDate,
      p_method: method,
      p_note: note || null,
      p_items: chosen.map(i => ({ invoice_id: i.id, amount: Number(i.amount) })),
    })
    setSaving(false)
    if (error || !receipt) { toast('No se pudo emitir: ' + (error?.message ?? ''), 'error'); return }
    // La RPC devuelve la fila cruda; se adjunta el nombre del cliente (ya conocido)
    // para la impresión/listado sin un round-trip extra.
    const withClient = { ...(receipt as PaymentReceipt), clients: { company_name: clients.find(c => c.id === clientId)?.company_name ?? '—' } }
    toast(`Recibo ${withClient.receipt_number} emitido.`, 'success')
    onEmitted(withClient, chosen.map(i => ({ invoice_number: i.number, amount: Number(i.amount) })))
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">Emitir recibo de caja</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
            <select title="Cliente" value={clientId} onChange={e => loadInvoices(e.target.value)} className={input}>
              <option value="">Seleccionar cliente…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>

          {loading && <p className="text-sm text-gray-500">Cargando facturas…</p>}
          {clientId && !loading && items.length === 0 && <p className="text-sm text-gray-500 italic">Este cliente no tiene facturas con saldo.</p>}
          {items.length > 0 && (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {items.map(i => (
                <div key={i.id} className="flex items-center gap-2 px-3 py-2">
                  <input type="checkbox" title="Incluir" checked={i.checked} onChange={e => setItem(i.id, { checked: e.target.checked })} className="rounded" />
                  <span className="flex-1 text-sm font-mono text-gray-700">{i.number ?? '—'}</span>
                  <span className="text-xs text-gray-500">Saldo {formatCOP(i.saldo)}</span>
                  <input type="number" title="Monto a abonar" inputMode="numeric" min={0} value={i.amount} disabled={!i.checked} onChange={e => setItem(i.id, { amount: e.target.value })} className="w-28 border border-gray-300 rounded-lg px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
              <input type="date" title="Fecha del recibo" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Medio de pago</label>
              <select title="Medio de pago" value={method} onChange={e => setMethod(e.target.value)} className={input}>
                {MEDIOS_GASTO.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nota (opcional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} className={input} placeholder="Ej: consignación Bancolombia" />
          </div>
          <p className="text-sm text-gray-700 text-right">Total del recibo: <strong className="text-brand-700">{formatCOP(total)}</strong></p>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={emitir} disabled={saving || total <= 0} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Emitiendo…' : 'Emitir recibo'}</button>
        </div>
      </div>
    </div>
  )
}

function ReceiptPrint({ receipt, lines, emisorName, onClose }: {
  receipt: PaymentReceipt
  lines: ReceiptLine[]
  emisorName: string
  onClose: () => void
}) {
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/60 flex items-start justify-center z-[60] p-4 overflow-y-auto print:bg-white print:p-0 print:static print:block">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md print:max-w-none">
        <div className="flex items-center justify-end gap-2 mb-3 print:hidden">
          <button type="button" onClick={() => window.print()} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700">🖨️ Imprimir / PDF</button>
          <button type="button" onClick={onClose} className="bg-white text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-100">Cerrar</button>
        </div>
        <div className="bg-white rounded-xl shadow-xl p-6 text-gray-800 print:shadow-none print:rounded-none">
          <div className="flex items-center justify-between border-b-2 border-gray-800 pb-3">
            <div>
              <h1 className="text-lg font-bold">{emisorName}</h1>
              <p className="text-xs text-gray-500">Recibo de caja · comprobante de pago</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase">N°</p>
              <p className="font-mono font-bold">{receipt.receipt_number}</p>
            </div>
          </div>

          {receipt.status === 'anulado' && (
            <p className="mt-2 text-center text-red-600 font-bold border border-red-300 rounded py-1">ANULADO</p>
          )}

          <div className="mt-4 text-sm space-y-1">
            <p><span className="text-gray-500">Fecha:</span> {fmtDate(receipt.issue_date)}</p>
            <p><span className="text-gray-500">Recibí de:</span> <strong>{companyOf(receipt)}</strong></p>
            <p><span className="text-gray-500">Medio de pago:</span> {receipt.method ?? '—'}</p>
          </div>

          {lines.length > 0 && (
            <table className="w-full text-xs mt-4 border-collapse">
              <thead><tr className="border-b border-gray-300 text-gray-500"><th className="text-left py-1">Factura abonada</th><th className="text-right py-1">Valor</th></tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b border-gray-100"><td className="py-1 font-mono">{l.invoice_number ?? '—'}</td><td className="py-1 text-right">{formatCOP(l.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-4 border-t-2 border-gray-800 pt-2 flex justify-between font-bold">
            <span>TOTAL RECIBIDO</span>
            <span className="text-brand-700">{formatCOP(Number(receipt.total_amount))}</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">Son: {numeroALetras(Number(receipt.total_amount))}</p>
          {receipt.note && <p className="text-xs text-gray-500 mt-2">Nota: {receipt.note}</p>}

          <div className="mt-10 grid grid-cols-2 gap-6 text-center text-xs text-gray-500">
            <div className="border-t border-gray-400 pt-1">Recibí conforme</div>
            <div className="border-t border-gray-400 pt-1">Entregó</div>
          </div>
          <p className="text-[10px] text-gray-400 mt-4 text-center">Documento de control interno. No es factura ni documento equivalente DIAN.</p>
        </div>
      </div>
    </div>
  )
}
