import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { isUuid } from '@/lib/validate'
import { recordAudit } from '@/lib/audit/log'

/** Cambia el rol de un usuario (admin ↔ cleaner), con salvaguardas. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })
  if (id === auth.ctx.userId) return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 400 })

  const { role } = (await req.json()) as { role?: string }
  if (role !== 'admin' && role !== 'cleaner') return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })

  const admin = createAdminClient()
  const { data: target, error: tErr } = await admin.from('user_profiles').select('role').eq('id', id).single()
  if (tErr || !target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (target.role === role) return NextResponse.json({ ok: true })

  // No dejar el sistema sin administradores.
  if (target.role === 'admin' && role === 'cleaner') {
    const { count } = await admin.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
    if ((count ?? 0) <= 1) return NextResponse.json({ error: 'Debe quedar al menos un administrador' }, { status: 400 })
  }

  // Al promover a admin se libera el vínculo con la ficha de auxiliar (un admin
  // no debe poder quedar bloqueado al desactivar ese auxiliar).
  const patch = role === 'admin' ? { role, cleaner_id: null } : { role }
  const { error: updErr } = await admin.from('user_profiles').update(patch).eq('id', id)
  if (updErr) return NextResponse.json({ error: 'No se pudo cambiar el rol: ' + updErr.message }, { status: 400 })

  await recordAudit({ userId: auth.ctx.userId, action: 'role_changed', result: 'success', details: { targetId: id, role } })
  return NextResponse.json({ ok: true })
}
