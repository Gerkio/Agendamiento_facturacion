import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isSameOrigin } from '@/lib/auth/origin'
import { isUuid } from '@/lib/validate'
import { recordAudit } from '@/lib/audit/log'
import { deriveCompanyName, nameIsValid } from '@/lib/clients'

/** Actualiza un cliente. Deriva company_name (razón social) de forma autoritativa
 *  para no romper la facturación DIAN. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string).trim() : '')

  const naturaleza = str('naturaleza') === 'natural' ? 'natural' : 'juridica'
  const nameParts = {
    naturaleza, company_name: str('company_name'),
    first_name: str('first_name'), second_name: str('second_name'),
    first_surname: str('first_surname'), second_surname: str('second_surname'),
  }
  if (!nameIsValid(nameParts)) {
    return NextResponse.json({ error: naturaleza === 'natural' ? 'Faltan primer nombre y primer apellido.' : 'Falta la razón social.' }, { status: 400 })
  }
  const company_name = deriveCompanyName(nameParts)

  // Requeridos DIAN.
  for (const [k, label] of [['nit_cedula', 'NIT/Cédula'], ['dv', 'DV'], ['email', 'correo'], ['address', 'dirección'], ['city_code', 'ciudad']] as const) {
    if (!str(k)) return NextResponse.json({ error: `Falta ${label}.` }, { status: 400 })
  }

  const payload = {
    company_name,
    naturaleza,
    first_name: str('first_name') || null, second_name: str('second_name') || null,
    first_surname: str('first_surname') || null, second_surname: str('second_surname') || null,
    nit_cedula: str('nit_cedula'), dv: str('dv'),
    email: str('email'), phone: str('phone') || null, phone2: str('phone2') || null,
    address: str('address'), city_code: str('city_code'),
    tax_scheme: str('tax_scheme') || '01', fiscal_regimen: str('fiscal_regimen') || 'R-99-PN',
    indicaciones: str('indicaciones') || null, forma_pago: str('forma_pago') || null,
    observaciones: str('observaciones') || null, sucursal: str('sucursal') || null,
    customer_type: str('customer_type') || null, origen: str('origen') || null,
    is_active: b.is_active !== false,
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('clients').update(payload).eq('id', id).select().single()
  if (error) {
    const dup = error.message.toLowerCase().includes('duplicate') || error.message.includes('nit_cedula')
    return NextResponse.json({ error: dup ? 'Ya existe otro cliente con ese NIT/Cédula.' : error.message }, { status: 400 })
  }

  await recordAudit({ userId: auth.ctx.userId, action: 'client_updated', result: 'success', details: { clientId: id } })
  return NextResponse.json({ client: data })
}
