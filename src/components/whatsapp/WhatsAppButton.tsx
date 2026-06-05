'use client'

import { cleanPhone, whatsappWebUrl } from '@/lib/whatsapp'

interface Props {
  /** Teléfono del destinatario (cualquier formato; se limpia internamente). */
  phone?: string | null
  /** Mensaje ya formateado (negritas con *…*, saltos de línea, emojis). */
  message: string
  label?: string
  className?: string
}

/** Botón reutilizable: abre WhatsApp Web (PC) en pestaña nueva con el contacto
 *  cargado y el mensaje en la caja, listo para que el usuario presione Enter. */
export default function WhatsAppButton({ phone, message, label = 'Enviar por WhatsApp', className }: Props) {
  const valid = cleanPhone(phone)
  function send() {
    if (!valid) return
    window.open(whatsappWebUrl(phone, message), '_blank', 'noopener,noreferrer')
  }
  return (
    <button
      type="button"
      onClick={send}
      disabled={!valid}
      className={className ?? 'inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition disabled:opacity-50'}
    >
      <span aria-hidden="true">💬</span> {label}
    </button>
  )
}
