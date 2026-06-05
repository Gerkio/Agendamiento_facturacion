import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { isUuid } from '@/lib/validate'
import { recordAudit } from '@/lib/audit/log'
import { validatePassword } from '@/lib/auth/password'

/**
 * Cambia la contraseña de un usuario desde la pestaña Usuarios (solo admin).
 * - Si un admin cambia la de OTRO usuario: queda como temporal y ese usuario
 *   deberá redefinirla en su próximo ingreso.
 * - Si el admin cambia la SUYA: queda definitiva (la eligió a conciencia).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })

  const { password } = (await req.json()) as { password?: string }
  const pass = password?.trim() ?? ''
  const weak = validatePassword(pass)
  if (weak) return NextResponse.json({ error: weak }, { status: 400 })

  const admin = createAdminClient()
  const { data: target } = await admin.from('user_profiles').select('id').eq('id', id).single()
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const isSelf = id === auth.ctx.userId
  const forceChange = !isSelf // si la cambia otro admin, el usuario debe redefinirla

  const { error } = await admin.auth.admin.updateUserById(id, {
    password: pass,
    app_metadata: { must_change_password: forceChange },
  })
  if (error) { console.error('[user password PATCH]', error.message); return NextResponse.json({ error: 'No se pudo cambiar la contraseña.' }, { status: 400 }) }

  await admin.from('user_profiles').update({ must_change_password: forceChange }).eq('id', id)
  await recordAudit({ userId: auth.ctx.userId, action: 'password_reset', result: 'success', details: { targetId: id, self: isSelf } })

  return NextResponse.json({ ok: true, mustChange: forceChange })
}
