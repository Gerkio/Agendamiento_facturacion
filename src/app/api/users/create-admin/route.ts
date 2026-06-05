import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { recordAudit } from '@/lib/audit/log'

/**
 * Crea un nuevo administrador (correo + contraseña temporal). El usuario nace
 * obligado a cambiar la contraseña en su primer ingreso.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { email, password } = (await req.json()) as { email?: string; password?: string }
  const mail = email?.trim().toLowerCase() ?? ''
  const pass = password?.trim() ?? ''
  if (!mail || !mail.includes('@')) return NextResponse.json({ error: 'Correo inválido' }, { status: 400 })
  if (pass.length < 6) return NextResponse.json({ error: 'La contraseña temporal debe tener al menos 6 caracteres' }, { status: 400 })

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
    return NextResponse.json({ error: dup ? 'Ya existe un usuario con ese correo' : (createErr?.message ?? 'No se pudo crear') }, { status: 400 })
  }

  // 2) El trigger crea el perfil como 'cleaner'; promoverlo a admin.
  const { error: roleErr } = await admin
    .from('user_profiles')
    .update({ role: 'admin', must_change_password: true, email: mail })
    .eq('id', created.user.id)
  if (roleErr) {
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: 'No se pudo asignar el rol de administrador: ' + roleErr.message }, { status: 500 })
  }

  await recordAudit({ userId: auth.ctx.userId, action: 'admin_created', result: 'success', details: { email: mail } })
  return NextResponse.json({ ok: true, email: mail }, { status: 201 })
}
