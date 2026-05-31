import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { isUuid } from '@/lib/validate'

/**
 * Elimina un limpiador: su usuario de acceso (auth), su perfil y su ficha.
 * Se bloquea si tiene servicios asignados (integridad del historial); en ese
 * caso lo correcto es desactivarlo, no borrarlo.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: cleanerId } = await params
  if (!isUuid(cleanerId)) return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })
  const admin = createAdminClient()

  // 1) Verificar que exista.
  const { data: cleaner, error: cleanerErr } = await admin
    .from('cleaners')
    .select('id, full_name')
    .eq('id', cleanerId)
    .single()
  if (cleanerErr || !cleaner) {
    return NextResponse.json({ error: 'Limpiador no encontrado' }, { status: 404 })
  }

  // 2) Bloquear si tiene servicios asignados (historial / facturación).
  const { count, error: countErr } = await admin
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('cleaner_id', cleanerId)
  if (countErr) {
    return NextResponse.json({ error: 'No se pudo verificar los servicios: ' + countErr.message }, { status: 400 })
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: tiene ${count} servicio(s) en el historial. Desactívalo en su lugar.`, code: 'HAS_SERVICES' },
      { status: 409 }
    )
  }

  // 3) Buscar y eliminar el usuario de auth vinculado.
  const { data: profile } = await admin
    .from('user_profiles')
    .select('id')
    .eq('cleaner_id', cleanerId)
    .single()
  if (profile) {
    const { error: delUserErr } = await admin.auth.admin.deleteUser(profile.id)
    // Si el usuario ya no existe en auth, seguimos; cualquier otro error se reporta.
    if (delUserErr && !delUserErr.message?.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'No se pudo eliminar el usuario: ' + delUserErr.message }, { status: 400 })
    }
  }

  // 4) Eliminar la ficha del limpiador.
  const { error: delCleanerErr } = await admin.from('cleaners').delete().eq('id', cleanerId)
  if (delCleanerErr) {
    return NextResponse.json({ error: 'No se pudo eliminar el limpiador: ' + delCleanerErr.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
