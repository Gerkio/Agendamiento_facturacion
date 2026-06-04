import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSameOrigin } from '@/lib/auth/origin'

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { password } = (await req.json()) as { password?: string }
  const newPassword = password?.trim() ?? ''

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Si es un limpiador, no permitir que la nueva contraseña sea igual a su cédula.
  const { data: profile } = await admin
    .from('user_profiles')
    .select('cleaner_id')
    .eq('id', user.id)
    .single()

  if (profile?.cleaner_id) {
    const { data: cleaner } = await admin
      .from('cleaners')
      .select('document_id')
      .eq('id', profile.cleaner_id)
      .single()
    if (cleaner?.document_id && newPassword === cleaner.document_id) {
      return NextResponse.json(
        { error: 'La nueva contraseña no puede ser igual a tu cédula' },
        { status: 400 }
      )
    }
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
    // Limpia el flag en el JWT; el middleware lo verá en el próximo request.
    app_metadata: { must_change_password: false },
  })
  if (updErr) {
    return NextResponse.json({ error: 'No se pudo actualizar: ' + updErr.message }, { status: 400 })
  }

  await admin.from('user_profiles').update({ must_change_password: false }).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
