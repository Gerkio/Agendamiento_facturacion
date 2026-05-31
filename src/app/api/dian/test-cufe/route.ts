import { NextResponse } from 'next/server'
import { calculateCUFE } from '@/lib/dian/cufe-calculator'
import { requireAdmin } from '@/lib/auth/require-admin'

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const now = new Date()
  const cufe = calculateCUFE({
    invoiceNumber: `${process.env.INVOICE_PREFIX ?? 'SETT'}00001`,
    issueDate: now,
    taxableBase: 100000,
    taxAmount01: 0,
    taxAmount04: 0,
    taxAmount03: 0,
    totalAmount: 100000,
    supplierNit: process.env.COMPANY_NIT ?? '000000000',
    customerDoc: '800000000',
    technicalKey: process.env.DIAN_TECHNICAL_KEY ?? 'test-key',
    environment: (process.env.DIAN_ENVIRONMENT ?? '2') as '1' | '2',
  })
  return NextResponse.json({ cufe })
}
