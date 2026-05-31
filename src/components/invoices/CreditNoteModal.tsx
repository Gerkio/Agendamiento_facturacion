'use client'

import { useState } from 'react'
import { useUI } from '@/components/ui/UIProvider'
import { CREDIT_NOTE_CONCEPTS } from '@/lib/dian/credit-note-concepts'
import { formatCOP } from '@/lib/format'
import type { Invoice, CreditNote } from '@/types/database'

interface Props {
  invoice: Invoice
  onClose: () => void
  onDone: (note: CreditNote) => void
}

export default function CreditNoteModal({ invoice, onClose, onDone }: Props) {
  const { toast } = useUI()
  const [conceptCode, setConceptCode] = useState('2') // Anulación por defecto
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)

  async function submit() {
    setSending(true)
    try {
      const res = await fetch('/api/dian/credit-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id, conceptCode, reason: reason.trim() || undefined }),
      })
      const data = await res.json()
      if (data.success && data.creditNote) {
        toast('Nota crédito emitida y enviada a la DIAN.', 'success')
        onDone(data.creditNote as CreditNote)
      } else {
        toast('No se pudo emitir: ' + (data.error ?? 'error desconocido'), 'error')
      }
    } catch (e) {
      toast('Error de red: ' + (e instanceof Error ? e.message : 'desconocido'), 'error')
    }
    setSending(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-xl font-bold">Nota crédito</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-4 text-base">
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700">
            Factura <strong className="font-mono">{invoice.invoice_number}</strong> · {formatCOP(Number(invoice.total_amount))}
          </div>
          <p className="text-sm text-gray-600">
            La nota crédito corrige o anula una factura ya validada por la DIAN. Es el único modo legal de “deshacer” una factura enviada.
          </p>
          <div>
            <label htmlFor="cn-concept" className="block text-base font-semibold text-gray-800 mb-1">Concepto</label>
            <select id="cn-concept" value={conceptCode} onChange={e => setConceptCode(e.target.value)}
              className="w-full border border-gray-400 rounded-lg px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500">
              {CREDIT_NOTE_CONCEPTS.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cn-reason" className="block text-base font-semibold text-gray-800 mb-1">Motivo (opcional)</label>
            <textarea id="cn-reason" value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder="Ej: Servicio no prestado; cliente canceló."
              className="w-full border border-gray-400 rounded-lg px-3.5 py-2.5 text-base resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg text-base border border-gray-400 hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={submit} disabled={sending}
            className="px-4 py-2.5 rounded-lg text-base bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-50">
            {sending ? 'Emitiendo…' : 'Emitir nota crédito'}
          </button>
        </div>
      </div>
    </div>
  )
}
