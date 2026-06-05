import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { isUuid } from '@/lib/validate'
import { recordAudit } from '@/lib/audit/log'

// Ban prácticamente permanente (~100 años); 'none' lo levanta.
const BAN_FOREVER = '876000h'

/**
 * Activa o desactiva un auxiliar. Al desactivarlo se BLOQUEA su acceso (ban del
 * usuario de auth); al activarlo se restablece. Así un auxiliar inactivo no puede
 * iniciar sesión, no solo desaparece de las listas.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: cleanerId } = await params
  if (!isUuid(cleanerId)) return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as { is_active?: boolean }
  const isActive = body.is_active
  if (typeof isActive !== 'boolean') return NextResponse.json({ error: 'is_active es requerido' }, { status: 400 })

  const admin = createAdminClient()

  const { data: cleaner, error } = await admin
    .from('cleaners')
    .update({ is_active: isActive })
    .eq('id', cleanerId)
    .select()
    .single()
  if (error || !cleaner) {
    return NextResponse.json({ error: 'No se pudo actualizar: ' + (error?.message ?? 'no encontrado') }, { status: 400 })
  }

  // Bloquear/desbloquear el acceso del usuario vinculado (si tiene cuenta).
  // Nunca se banea a un administrador (evita auto-bloqueo si un admin quedó
  // vinculado a una ficha de auxiliar).
  const { data: profile } = await admin.from('user_profiles').select('id, role').eq('cleaner_id', cleanerId).single()
  if (profile && profile.role !== 'admin') {
    const { error: banErr } = await admin.auth.admin.updateUserById(profile.id, {
      ban_duration: isActive ? 'none' : BAN_FOREVER,
    })
    if (banErr) {
      return NextResponse.json({ error: 'Ficha actualizada, pero no se pudo cambiar el acceso: ' + banErr.message }, { status: 400 })
    }
  }

  await recordAudit({ userId: auth.ctx.userId, action: 'cleaner_status_changed', result: 'success', details: { cleanerId, isActive } })
  return NextResponse.json({ ok: true, cleaner })
}
