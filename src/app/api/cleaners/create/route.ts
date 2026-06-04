import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { cedulaToEmail } from '@/lib/auth/cleaner-email'
import { recordAudit } from '@/lib/audit/log'
import { isSameOrigin } from '@/lib/auth/origin'

interface Body {
  full_name: string
  document_id: string
  phone?: string | null
  is_active?: boolean
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await req.json()) as Body
  const fullName = body.full_name?.trim()
  const cedula = body.document_id?.trim()
  const phone = body.phone?.toString().trim() || null
  const isActive = body.is_active ?? true

  if (!fullName || !cedula) {
    return NextResponse.json({ error: 'Nombre y cédula son obligatorios' }, { status: 400 })
  }
  if (cedula.length < 4) {
    return NextResponse.json({ error: 'La cédula es demasiado corta para usarse como contraseña' }, { status: 400 })
  }

  const admin = createAdminClient()
  const email = cedulaToEmail(cedula)

  // 1) Crear el usuario de auth (usuario = cédula, contraseña inicial = cédula).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: cedula,
    email_confirm: true,
    user_metadata: { full_name: fullName, cedula },
    // El middleware lee este flag del JWT (sin consultar la BD por request).
    app_metadata: { must_change_password: true },
  })

  if (createErr || !created?.user) {
    const dup = createErr?.message?.toLowerCase().includes('already')
    return NextResponse.json(
      { error: dup ? 'Ya existe un usuario con esa cédula' : createErr?.message ?? 'No se pudo crear el usuario' },
      { status: 400 }
    )
  }
  const userId = created.user.id

  // 2) Crear la ficha del limpiador.
  const { data: cleaner, error: cleanerErr } = await admin
    .from('cleaners')
    .insert({ full_name: fullName, document_id: cedula, phone, is_active: isActive })
    .select()
    .single()

  if (cleanerErr || !cleaner) {
    // Rollback: eliminar el usuario huérfano.
    await admin.auth.admin.deleteUser(userId)
    const dup = cleanerErr?.message?.toLowerCase().includes('duplicate')
    return NextResponse.json(
      { error: dup ? 'Ya existe un limpiador con esa cédula' : cleanerErr?.message ?? 'No se pudo crear el limpiador' },
      { status: 400 }
    )
  }

  // 3) Vincular el perfil: rol cleaner, cleaner_id y forzar cambio de contraseña.
  const { error: profileErr } = await admin
    .from('user_profiles')
    .update({ role: 'cleaner', cleaner_id: cleaner.id, must_change_password: true })
    .eq('id', userId)

  if (profileErr) {
    // Rollback completo: sin el vínculo de perfil quedaría un usuario sin
    // cleaner_id y sin forzar cambio de contraseña (cuenta huérfana).
    await admin.from('cleaners').delete().eq('id', cleaner.id)
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json(
      { error: 'No se pudo vincular el perfil del limpiador: ' + profileErr.message },
      { status: 500 }
    )
  }

  await recordAudit({
    userId: auth.ctx.userId,
    action: 'cleaner_created',
    result: 'success',
    details: { cleanerId: cleaner.id, fullName },
  })

  return NextResponse.json({ cleaner, username: cedula }, { status: 201 })
}
