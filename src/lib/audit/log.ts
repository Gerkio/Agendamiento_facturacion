import 'server-only'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export type AuditAction =
  | 'cert_validated'
  | 'cert_expiring'
  | 'xsd_validated'
  | 'schematron_validated'
  | 'invoice_signed'
  | 'dian_sent'
  | 'dian_rejected'
  | 'cleaner_created'
  | 'cleaner_photo_updated'
  | 'client_updated'
  | 'client_photo_updated'
  | 'password_reset'

export type AuditResult = 'success' | 'warning' | 'failure'

export interface AuditEntry {
  userId?: string | null
  userEmail?: string | null
  action: AuditAction
  result: AuditResult
  /** Hash SHA-384 (hex) del documento, si aplica. */
  documentHash?: string | null
  /** Metadatos NO sensibles. No incluir secretos, claves, tokens ni el documento. */
  details?: Record<string, unknown>
}

/** SHA-384 en hex de un contenido (XML firmado, etc.) para la bitácora. */
export function hashDocument(content: string | Buffer): string {
  return createHash('sha384').update(content).digest('hex')
}

/**
 * Registra un evento en audit_log. Best-effort: si la bitácora falla, NO debe
 * tumbar la operación de negocio, pero el fallo se reporta a la consola del servidor.
 * Nunca persiste secretos.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('audit_log').insert({
      user_id: entry.userId ?? null,
      user_email: entry.userEmail ?? null,
      action: entry.action,
      result: entry.result,
      document_hash: entry.documentHash ?? null,
      details: entry.details ?? null,
    })
    if (error) console.error('[audit_log] no se pudo registrar:', error.message)
  } catch (e) {
    console.error('[audit_log] error inesperado:', e instanceof Error ? e.message : 'desconocido')
  }
}
