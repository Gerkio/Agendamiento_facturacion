import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { isUuid, isRealImage } from '@/lib/validate'
import { recordAudit } from '@/lib/audit/log'

const ALLOWED: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

/** Sube/reemplaza la foto de un auxiliar al bucket privado cleaner-photos. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })

  // Corte temprano de cuerpos absurdamente grandes (antes de bufferizar). El
  // límite real lo impone file.size más abajo (Content-Length es del cliente).
  const declaredLen = Number(req.headers.get('content-length') || 0)
  if (declaredLen > MAX_BYTES + 1024 * 1024) return NextResponse.json({ error: 'La imagen supera 2 MB' }, { status: 413 })

  let file: File | null = null
  try {
    const fd = await req.formData()
    const f = fd.get('photo')
    if (f instanceof File) file = f
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'Falta el archivo de foto' }, { status: 400 })

  const ext = ALLOWED[file.type]
  if (!ext) return NextResponse.json({ error: 'Formato no permitido (usa JPG, PNG o WEBP)' }, { status: 415 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'La imagen supera 2 MB' }, { status: 413 })
  if (!(await isRealImage(file))) return NextResponse.json({ error: 'El archivo no es una imagen JPG, PNG o WEBP válida.' }, { status: 415 })

  const admin = createAdminClient()
  const path = `${id}.${ext}`
  const { error: upErr } = await admin.storage.from('cleaner-photos').upload(path, file, { upsert: true, contentType: file.type })
  if (upErr) { console.error('[cleaner photo upload]', upErr.message); return NextResponse.json({ error: 'No se pudo subir la foto.' }, { status: 400 }) }

  const { error: updErr } = await admin.from('cleaners').update({ photo_url: path }).eq('id', id)
  if (updErr) { console.error('[cleaner photo ref]', updErr.message); return NextResponse.json({ error: 'No se pudo guardar la referencia de la foto.' }, { status: 400 }) }

  await recordAudit({ userId: auth.ctx.userId, action: 'cleaner_photo_updated', result: 'success', details: { cleanerId: id } })

  // URL firmada para mostrarla de inmediato.
  const { data: signed } = await admin.storage.from('cleaner-photos').createSignedUrl(path, 3600)
  return NextResponse.json({ path, signedUrl: signed?.signedUrl ?? null })
}
