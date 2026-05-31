import { NextRequest, NextResponse } from 'next/server'
import { calculateCUFE } from '@/lib/dian/cufe-calculator'
import { generateInvoiceXML } from '@/lib/dian/xml-generator'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { Client, Service } from '@/types/database'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { testClientNit } = await req.json() as { testClientNit?: string }
  const now = new Date()
  const environment = (process.env.DIAN_ENVIRONMENT ?? '2') as '1' | '2'
  const invoiceNumber = `${process.env.INVOICE_PREFIX ?? 'SETT'}00001`

  const mockClient: Client = {
    id: 'test-id',
    company_name: 'Cliente de Prueba S.A.S.',
    nit_cedula: testClientNit ?? '800000000',
    dv: '1',
    email: 'prueba@cliente.com',
    phone: '6001234567',
    address: 'Calle Falsa 123',
    city_code: '11001',
    tax_scheme: '01',
    fiscal_regimen: 'R-99-PN',
    created_at: now.toISOString(),
  }

  const mockService: Service = {
    id: 'svc-test',
    client_id: mockClient.id,
    cleaner_id: 'cleaner-test',
    start_time: now.toISOString(),
    end_time: new Date(now.getTime() + 7200000).toISOString(),
    status: 'completed',
    is_recurring: false,
    recurrence_group_id: null,
    invoice_id: null,
    price_cop: 100000,
    created_at: now.toISOString(),
  }

  const cufe = calculateCUFE({
    invoiceNumber,
    issueDate: now,
    taxableBase: 100000,
    taxAmount01: 0,
    taxAmount04: 0,
    taxAmount03: 0,
    totalAmount: 100000,
    supplierNit: process.env.COMPANY_NIT ?? '000000000',
    customerDoc: mockClient.nit_cedula,
    technicalKey: process.env.DIAN_TECHNICAL_KEY ?? 'test-key',
    environment,
  })

  const xml = generateInvoiceXML({
    invoiceNumber,
    issueDate: now,
    client: mockClient,
    services: [mockService],
    totalAmount: 100000,
    taxAmount: 0,
    taxableBase: 100000,
    taxRate: 0,
    cufe,
    environment,
  })

  return NextResponse.json({ xml, cufe })
}
