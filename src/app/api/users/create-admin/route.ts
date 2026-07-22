import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { CLEANER_EMAIL_DOMAIN } from '@/lib/auth/cleaner-email'
import { recordAudit } from '@/lib/audit/log'
import { validatePassword } from '@/lib/auth/password'
import { rateLimit } from '@/lib/rate-limit'
import { createLogger, newCorrelationId } from '@/lib/log/logger'

/**
 * Crea un nuevo administrador (correo + contraseña temporal). El usuario nace
 * obligado a cambiar la contraseña en su primer ingreso.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // Rate-limit: crear cuentas de administrador es una operación sensible.
  const rl = rateLimit(`create-admin:${auth.ctx.userId}`, 10, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ error: 'Demasiadas solicitudes; intenta en un momento.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })
  }
  const log = createLogger({ cid: newCorrelationId(), route: 'users/create-admin', actor: auth.ctx.userId })

  const { email, password, full_name } = (await req.json()) as { email?: string; password?: string; full_name?: string }
  const mail = email?.trim().toLowerCase() ?? ''
  const pass = password?.trim() ?? ''
  const name = full_name?.trim().slice(0, 120) ?? ''
  if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  if (!mail || !mail.includes('@')) return NextResponse.json({ error: 'Correo inválido' }, { status: 400 })
  if (mail.endsWith('@' + CLEANER_EMAIL_DOMAIN)) return NextResponse.json({ error: 'Ese dominio está reservado para auxiliares' }, { status: 400 })
  const weak = validatePassword(pass)
  if (weak) return NextResponse.json({ error: weak }, { status: 400 })

  const admin = createAdminClient()

  // 1) Crear el usuario de auth (con cambio de contraseña forzado).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: mail,
    password: pass,
    email_confirm: true,
    app_metadata: { must_change_password: true },
  })
  if (createErr || !created?.user) {
    const dup = createErr?.message?.toLowerCase().includes('already')
    log.warn('createUser falló', { dup: Boolean(dup) })
    return NextResponse.json({ error: dup ? 'Ya existe un usuario con ese correo' : (createErr?.message ?? 'No se pudo crear') }, { status: 400 })
  }

  // 2) Garantizar el perfil como admin (upsert: no depende de que el trigger
  //    'handle_new_user' ya haya insertado la fila).
  const { error: roleErr } = await admin
    .from('user_profiles')
    .upsert({ id: created.user.id, email: mail, role: 'admin', must_change_password: true, full_name: name })
  if (roleErr) {
    await admin.auth.admin.deleteUser(created.user.id)
    log.error('no se pudo asignar rol; usuario revertido', { reason: roleErr.message })
    return NextResponse.json({ error: 'No se pudo asignar el rol de administrador: ' + roleErr.message }, { status: 500 })
  }

  await recordAudit({ userId: auth.ctx.userId, action: 'admin_created', result: 'success', details: { email: mail } })
  log.info('administrador creado', { newUserId: created.user.id })
  return NextResponse.json({ ok: true, email: mail }, { status: 201 })
}
