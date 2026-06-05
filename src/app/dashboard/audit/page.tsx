import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface AuditRow {
  id: string
  user_email: string | null
  action: string
  result: 'success' | 'warning' | 'failure'
  document_hash: string | null
  details: Record<string, unknown> | null
  created_at: string
}

// Acciones DIAN registradas → etiqueta legible.
const ACTION_LABEL: Record<string, string> = {
  cert_validated: 'Certificado validado',
  cert_expiring: 'Certificado por vencer',
  invoice_signed: 'Factura firmada',
  xsd_validated: 'Validación XSD',
  schematron_validated: 'Validación Schematron',
  dian_sent: 'Enviada a la DIAN',
  dian_rejected: 'Rechazada por la DIAN',
  credit_note_signed: 'Nota crédito firmada',
  credit_note_sent: 'Nota crédito enviada',
}

const RESULT: Record<string, { label: string; cls: string }> = {
  success: { label: 'Éxito', cls: 'bg-green-100 text-green-700' },
  warning: { label: 'Aviso', cls: 'bg-amber-100 text-amber-700' },
  failure: { label: 'Fallo', cls: 'bg-red-100 text-red-700' },
}

/** P9 · Bitácora de auditoría: vista de solo lectura del audit_log (cada paso DIAN
 *  con su usuario, resultado y hash). Conecta Usuarios + Facturación con la capa de
 *  seguridad. La tabla ya existe; aquí se hace visible. Solo admin (RLS + guard). */
export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data } = await supabase
    .from('audit_log')
    .select('id, user_email, action, result, document_hash, details, created_at')
    .order('created_at', { ascending: false })
    .limit(300)
    .returns<AuditRow[]>()

  const rows = data ?? []

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Auditoría DIAN</h1>
      <p className="text-sm text-gray-500 mb-6">Bitácora inmutable de las operaciones de facturación electrónica (últimas 300).</p>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[760px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
            <th className="text-left px-4 py-3">Fecha (UTC)</th>
            <th className="text-left px-4 py-3">Usuario</th>
            <th className="text-left px-4 py-3">Acción</th>
            <th className="text-left px-4 py-3">Resultado</th>
            <th className="text-left px-4 py-3">Detalle</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-gray-500">Sin eventos de auditoría todavía.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 align-top">
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">{new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 19)}</td>
                <td className="px-4 py-3 text-gray-700">{r.user_email ?? <span className="text-gray-400">sistema</span>}</td>
                <td className="px-4 py-3 text-gray-700">{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RESULT[r.result]?.cls ?? 'bg-gray-100 text-gray-600'}`}>{RESULT[r.result]?.label ?? r.result}</span></td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {r.details && Object.keys(r.details).length > 0 && (
                    <span className="break-all">{JSON.stringify(r.details)}</span>
                  )}
                  {r.document_hash && (
                    <span className="block font-mono text-gray-400 mt-0.5" title={r.document_hash}>hash: {r.document_hash.slice(0, 16)}…</span>
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
