import { NextRequest, NextResponse } from 'next/server'
import { calculateCUFE } from '@/lib/dian/cufe-calculator'
import { generateInvoiceXML } from '@/lib/dian/xml-generator'
import { signXML, loadCertFromEnv } from '@/lib/dian/xml-signer'
import { buildSoapEnvelope } from '@/lib/dian/soap-wrapper'
import { sendToDian } from '@/lib/dian/dian-client'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { Client, Service } from '@/types/database'

function makeMockClient(nit: string): Client {
  const now = new Date().toISOString()
  return {
    id: 'test-client',
    company_name: 'Empresa de Prueba DIAN S.A.S.',
    nit_cedula: nit,
    dv: '1',
    email: 'test@dian.gov.co',
    phone: '6001234567',
    address: 'Calle de Prueba 123',
    city_code: '11001',
    tax_scheme: '01',
    fiscal_regimen: 'R-99-PN',
    created_at: now,
  }
}

function makeMockService(idx: number): Service {
  const now = new Date()
  return {
    id: `svc-test-${idx}`,
    client_id: 'test-client',
    cleaner_id: 'cleaner-test',
    start_time: now.toISOString(),
    end_time: new Date(now.getTime() + 7200000).toISOString(),
    status: 'completed',
    is_recurring: false,
    recurrence_group_id: null,
    invoice_id: null,
    price_cop: 150000,
    created_at: now.toISOString(),
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { step, testClientNit } = await req.json() as { step: number; testClientNit: string }

  const environment = (process.env.DIAN_ENVIRONMENT ?? '2') as '1' | '2'
  const prefix = process.env.INVOICE_PREFIX ?? 'SETT'
  const invoiceNumber = `${prefix}${String(90000 + step).padStart(5, '0')}`
  const now = new Date()

  if (step === 4) {
    return NextResponse.json({
      success: true,
      message: 'Verificación completada. Revisar correo de confirmación DIAN.',
      detail: 'Si los pasos 1-3 fueron exitosos (IsValid=true), la habilitación está completa.',
    })
  }

  const client = makeMockClient(testClientNit ?? '800000000')
  const services = [makeMockService(step)]
  const taxableBase = 150000
  const taxAmount = 0
  const totalAmount = taxableBase + taxAmount

  try {
    const cufe = calculateCUFE({
      invoiceNumber,
      issueDate: now,
      taxableBase,
      taxAmount01: taxAmount,
      taxAmount04: 0,
      taxAmount03: 0,
      totalAmount,
      supplierNit: process.env.COMPANY_NIT ?? '000000000',
      customerDoc: client.nit_cedula,
      technicalKey: process.env.DIAN_TECHNICAL_KEY ?? 'test-key',
      environment,
    })

    const xml = generateInvoiceXML({
      invoiceNumber,
      issueDate: now,
      client,
      services,
      totalAmount,
      taxAmount,
      taxableBase,
      taxRate: 0,
      cufe,
      environment,
    })

    let signedXml = xml
    try {
      const cert = loadCertFromEnv()
      if (cert.privateKeyPem && cert.certPem) {
        signedXml = signXML(xml, cert)
      }
    } catch (signErr) {
      return NextResponse.json({
        success: false,
        error: 'Error firmando XML: ' + (signErr instanceof Error ? signErr.message : 'unknown'),
        detail: 'Verifica que DIAN_CERTIFICATE_BASE64 y DIAN_PRIVATE_KEY_BASE64 estén configurados.',
      })
    }

    const cert = loadCertFromEnv()
    const soapEnvelope = buildSoapEnvelope({
      signedXml,
      fileName: `${invoiceNumber}.xml`,
      certDerB64: cert.certDer.toString('base64'),
    })

    const dianResponse = await sendToDian(soapEnvelope, environment)

    return NextResponse.json({
      success: dianResponse.isValid,
      message: dianResponse.isValid
        ? `Factura ${invoiceNumber} aceptada por DIAN (${dianResponse.statusCode})`
        : `Rechazada: ${dianResponse.statusDescription}`,
      cufe,
      xml: step === 1 ? signedXml : undefined,
      detail: dianResponse.statusDescription,
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Error desconocido',
    })
  }
}
