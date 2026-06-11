import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { isUuid, isRealImage } from '@/lib/validate'
import { recordAudit } from '@/lib/audit/log'

const ALLOWED: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

/** Sube/reemplaza la foto de perfil de un administrador (bucket privado
 *  admin-photos, mismo patrón que las fotos de auxiliares). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })

  // Corte temprano de cuerpos absurdamente grandes (antes de bufferizar).
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
  const { data: target } = await admin.from('user_profiles').select('role').eq('id', id).single()
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (target.role !== 'admin') return NextResponse.json({ error: 'La foto de un auxiliar se sube en su hoja de vida' }, { status: 400 })

  const path = `${id}.${ext}`
  const { error: upErr } = await admin.storage.from('admin-photos').upload(path, file, { upsert: true, contentType: file.type })
  if (upErr) { console.error('[admin photo upload]', upErr.message); return NextResponse.json({ error: 'No se pudo subir la foto.' }, { status: 400 }) }

  const { error: updErr } = await admin.from('user_profiles').update({ photo_url: path }).eq('id', id)
  if (updErr) { console.error('[admin photo ref]', updErr.message); return NextResponse.json({ error: 'No se pudo guardar la referencia de la foto.' }, { status: 400 }) }

  await recordAudit({ userId: auth.ctx.userId, action: 'admin_photo_updated', result: 'success', details: { targetId: id } })

  // URL firmada para mostrarla de inmediato.
  const { data: signed } = await admin.storage.from('admin-photos').createSignedUrl(path, 3600)
  return NextResponse.json({ path, signedUrl: signed?.signedUrl ?? null })
}
