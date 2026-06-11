import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { isUuid } from '@/lib/validate'
import { recordAudit } from '@/lib/audit/log'

/** Actualiza el nombre de un usuario administrador. Los auxiliares llevan su
 *  nombre en `cleaners`, por eso aquí solo se permite editar perfiles admin. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })

  const { full_name } = (await req.json()) as { full_name?: string }
  const name = full_name?.trim().slice(0, 120) ?? ''
  if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

  const admin = createAdminClient()
  const { data: target } = await admin.from('user_profiles').select('role').eq('id', id).single()
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (target.role !== 'admin') return NextResponse.json({ error: 'El nombre de un auxiliar se edita en su hoja de vida' }, { status: 400 })

  const { error } = await admin.from('user_profiles').update({ full_name: name }).eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo actualizar: ' + error.message }, { status: 400 })

  await recordAudit({ userId: auth.ctx.userId, action: 'admin_profile_updated', result: 'success', details: { targetId: id } })
  return NextResponse.json({ ok: true, full_name: name })
}
