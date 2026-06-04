import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { recordAudit } from '@/lib/audit/log'
import { isSameOrigin } from '@/lib/auth/origin'
import { isUuid } from '@/lib/validate'

/**
 * Resetea la contraseña de un limpiador.
 * Por defecto vuelve a la cédula; opcionalmente acepta una contraseña temporal.
 * En ambos casos se obliga a cambiarla en el próximo ingreso.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: cleanerId } = await params
  if (!isUuid(cleanerId)) return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })
  let customPassword: string | undefined
  try {
    const body = await req.json()
    customPassword = body?.password?.toString().trim() || undefined
  } catch {
    // sin cuerpo → reset a la cédula
  }
  if (customPassword && customPassword.length < 4) {
    return NextResponse.json({ error: 'La contraseña temporal debe tener al menos 4 caracteres' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Ficha del limpiador → cédula
  const { data: cleaner, error: cleanerErr } = await admin
    .from('cleaners')
    .select('id, document_id')
    .eq('id', cleanerId)
    .single()
  if (cleanerErr || !cleaner) {
    return NextResponse.json({ error: 'Limpiador no encontrado' }, { status: 404 })
  }

  // Perfil de usuario vinculado
  const { data: profile } = await admin
    .from('user_profiles')
    .select('id')
    .eq('cleaner_id', cleanerId)
    .single()
  if (!profile) {
    return NextResponse.json({ error: 'Este limpiador no tiene un usuario vinculado' }, { status: 404 })
  }

  const newPassword = customPassword ?? cleaner.document_id

  const { error: updErr } = await admin.auth.admin.updateUserById(profile.id, {
    password: newPassword,
    // Vuelve a exigir cambio de contraseña (flag leído por el middleware desde el JWT).
    app_metadata: { must_change_password: true },
  })
  if (updErr) {
    return NextResponse.json({ error: 'No se pudo resetear: ' + updErr.message }, { status: 400 })
  }

  await admin.from('user_profiles').update({ must_change_password: true }).eq('id', profile.id)

  await recordAudit({
    userId: auth.ctx.userId,
    action: 'password_reset',
    result: 'success',
    details: { cleanerId, custom: Boolean(customPassword) },
  })

  return NextResponse.json({ ok: true, tempPassword: newPassword })
}
