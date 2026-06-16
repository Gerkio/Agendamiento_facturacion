import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { isUuid, isRealImage } from '@/lib/validate'
import { recordAudit } from '@/lib/audit/log'

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf',
}
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB (soportes pueden ser PDF de factura)

/** Devuelve una URL firmada para ver el soporte de un gasto (bucket privado). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })

  const admin = createAdminClient()
  const { data: row } = await admin.from('expenses').select('support_path').eq('id', id).single()
  if (!row?.support_path) return NextResponse.json({ error: 'Sin soporte' }, { status: 404 })
  const { data: signed } = await admin.storage.from('expense-receipts').createSignedUrl(row.support_path, 3600)
  return NextResponse.json({ signedUrl: signed?.signedUrl ?? null })
}

/** Sube/reemplaza el soporte (factura/recibo) de un gasto en el bucket privado
 *  expense-receipts. Acepta imagen o PDF. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })

  const declaredLen = Number(req.headers.get('content-length') || 0)
  if (declaredLen > MAX_BYTES + 1024 * 1024) return NextResponse.json({ error: 'El soporte supera 5 MB' }, { status: 413 })

  let file: File | null = null
  try {
    const fd = await req.formData()
    const f = fd.get('support')
    if (f instanceof File) file = f
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'Falta el archivo de soporte' }, { status: 400 })

  const ext = ALLOWED[file.type]
  if (!ext) return NextResponse.json({ error: 'Formato no permitido (usa JPG, PNG, WEBP o PDF)' }, { status: 415 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'El soporte supera 5 MB' }, { status: 413 })
  // Las imágenes se validan por contenido; el PDF se acepta por tipo declarado.
  if (file.type !== 'application/pdf' && !(await isRealImage(file))) {
    return NextResponse.json({ error: 'El archivo no es una imagen válida.' }, { status: 415 })
  }

  const admin = createAdminClient()
  const { data: target } = await admin.from('expenses').select('id').eq('id', id).single()
  if (!target) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })

  const path = `${id}.${ext}`
  const { error: upErr } = await admin.storage.from('expense-receipts').upload(path, file, { upsert: true, contentType: file.type })
  if (upErr) { console.error('[expense receipt upload]', upErr.message); return NextResponse.json({ error: 'No se pudo subir el soporte.' }, { status: 400 }) }

  const { error: updErr } = await admin.from('expenses').update({ support_path: path, support_type: file.type }).eq('id', id)
  if (updErr) { console.error('[expense receipt ref]', updErr.message); return NextResponse.json({ error: 'No se pudo guardar la referencia del soporte.' }, { status: 400 }) }

  await recordAudit({ userId: auth.ctx.userId, action: 'expense_receipt_updated', result: 'success', details: { expenseId: id } })

  const { data: signed } = await admin.storage.from('expense-receipts').createSignedUrl(path, 3600)
  return NextResponse.json({ path, signedUrl: signed?.signedUrl ?? null })
}
