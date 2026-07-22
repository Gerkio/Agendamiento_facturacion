import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateCUFE } from '@/lib/dian/cufe-calculator'
import { generateInvoiceXML } from '@/lib/dian/xml-generator'
import { signXML, loadCertFromEnv, verifySignatureInternally } from '@/lib/dian/xml-signer'
import { validateCertificate } from '@/lib/dian/cert-validator'
import { validateInvoiceXsd } from '@/lib/dian/xsd-validator'
import { validateBusinessRules } from '@/lib/dian/schematron-validator'
import { buildSoapEnvelope } from '@/lib/dian/soap-wrapper'
import { sendToDian, DianTechnicalError } from '@/lib/dian/dian-client'
import { recordAudit, hashDocument } from '@/lib/audit/log'
import { isSameOrigin } from '@/lib/auth/origin'
import { isUuid } from '@/lib/validate'
import { missingEmissionEnv } from '@/lib/dian/env-check'
import { computeTax, configuredIvaRate } from '@/lib/dian/tax'

// El pipeline (validar cert + XSD WASM + Schematron SaxonJS + SOAP a la DIAN)
// puede tardar más que el límite por defecto de Vercel. Node runtime obligatorio
// (usa crypto, xml-crypto, fs); no compatible con Edge.
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const supabase = await createClient()

  // Auth: solo administradores.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { invoiceId } = (await req.json()) as { invoiceId: string }
  if (!isUuid(invoiceId)) return NextResponse.json({ error: 'invoiceId inválido' }, { status: 400 })

  const setStatus = (status: string, patch: Record<string, unknown> = {}) =>
    supabase.from('invoices').update({ billing_status: status, ...patch }).eq('id', invoiceId)

  // ── IDEMPOTENCIA: transición ATÓMICA draft -> processing ────────────────────
  // Solo un proceso puede pasar la factura de 'draft' a 'processing'; los demás
  // (o un reintento) caen en la rama idempotente y NO reenvían.
  const { data: claimed } = await supabase
    .from('invoices')
    .update({ billing_status: 'processing' })
    .eq('id', invoiceId)
    .eq('billing_status', 'draft')
    .select('*, clients(*)')
    .single()

  if (!claimed) {
    const { data: current } = await supabase.from('invoices').select('*, clients(*)').eq('id', invoiceId).single()
    if (!current) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    return NextResponse.json({
      success: current.billing_status === 'sent_dian',
      idempotent: true,
      invoice: current,
      message: `La factura ya está en estado '${current.billing_status}'; no se reenvía.`,
    })
  }

  const invoice = claimed
  const client = invoice.clients as NonNullable<typeof invoice.clients>

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('start_time')

  if (!services?.length) {
    await setStatus('draft')
    return NextResponse.json({ error: 'No hay servicios vinculados a esta factura' }, { status: 400 })
  }

  let invoiceNumber: string | null = null
  try {
    const issueDate = new Date()
    const environment = (process.env.DIAN_ENVIRONMENT ?? '2') as '1' | '2'

    // 0) Fail-fast: no emitir si falta configuración obligatoria (evita CUFE/XML inválidos).
    const missing = missingEmissionEnv()
    if (missing.length) {
      await setStatus('draft')
      return NextResponse.json({ error: 'Configuración de emisión incompleta. Faltan: ' + missing.join(', ') }, { status: 422 })
    }

    // IVA: tasa configurable (COMPANY_IVA_RATE). Por defecto 0 (exento). Se calcula
    // por línea y se suma para que el impuesto del documento cuadre con las líneas.
    const ivaRate = configuredIvaRate()
    const tax = computeTax(services.map(s => Number(s.price_cop)), ivaRate)
    const taxableBase = tax.taxableBase
    const taxAmount = tax.taxAmount
    const totalAmount = tax.total

    // 1) Validar certificado ANTES de consumir un número (evita huecos en la numeración).
    const cert = loadCertFromEnv()
    const certCheck = validateCertificate(cert)
    if (!certCheck.ok) {
      await recordAudit({ userId: user.id, userEmail: user.email, action: 'cert_validated', result: 'failure', details: { hardFailures: certCheck.hardFailures } })
      await setStatus('draft')
      return NextResponse.json({ error: 'Certificado no utilizable: ' + certCheck.hardFailures.join(' ') }, { status: 422 })
    }
    await recordAudit({
      userId: user.id, userEmail: user.email,
      action: certCheck.warnings.length ? 'cert_expiring' : 'cert_validated',
      result: certCheck.warnings.length ? 'warning' : 'success',
      details: { daysToExpiry: certCheck.info.daysToExpiry, chainVerified: certCheck.info.chainVerified, warnings: certCheck.warnings },
    })

    // 2) Asignar consecutivo de forma ATÓMICA (sin duplicados ni saltos por concurrencia).
    //    Se llama con el cliente admin (service_role): la función NO es ejecutable
    //    por usuarios anon/authenticated vía RPC (evita que alguien queme números).
    const prefix = process.env.INVOICE_PREFIX ?? 'SETT'
    const { data: seq, error: seqErr } = await createAdminClient().rpc('allocate_invoice_number', { p_prefix: prefix })
    if (seqErr || seq == null) {
      await setStatus('draft')
      return NextResponse.json({ error: 'No se pudo asignar el consecutivo: ' + (seqErr?.message ?? 'desconocido') }, { status: 500 })
    }
    invoiceNumber = `${prefix}${seq}`

    // 3) CUFE + XML
    const cufe = calculateCUFE({
      invoiceNumber, issueDate, taxableBase,
      taxAmount01: taxAmount, taxAmount04: 0, taxAmount03: 0, totalAmount,
      supplierNit: process.env.COMPANY_NIT!, customerDoc: client.nit_cedula,
      technicalKey: process.env.DIAN_TECHNICAL_KEY!, environment,
    })
    const xmlRaw = generateInvoiceXML({ invoiceNumber, issueDate, client, services, totalAmount, taxAmount, taxableBase, taxRate: ivaRate, cufe, environment })

    // 4) Firmar + verificar la firma ANTES de enviar (fail-fast: no se manda a la
    //    DIAN un documento cuya firma no valida internamente).
    const signedXml = signXML(xmlRaw, cert)
    const ver = verifySignatureInternally(signedXml, cert)
    if (!ver.ok) {
      await recordAudit({ userId: user.id, userEmail: user.email, action: 'invoice_signed', result: 'failure', details: { invoiceNumber, reason: ver.reason } })
      await setStatus('draft', { dian_response_description: 'Firma interna inválida: ' + (ver.reason ?? '') })
      return NextResponse.json({ error: 'La firma no validó internamente; no se envió a la DIAN. Revisa la configuración del certificado.' }, { status: 500 })
    }
    const signedHash = hashDocument(signedXml)
    await recordAudit({ userId: user.id, userEmail: user.email, action: 'invoice_signed', result: 'success', documentHash: signedHash, details: { invoiceNumber, cufe } })

    // 5) Validación XSD (UBL 2.1 oficial DIAN)
    const enforceXsd = (process.env.DIAN_XSD_ENFORCE ?? 'true') !== 'false'
    const xsd = await validateInvoiceXsd(signedXml)
    if (!xsd.valid) {
      await recordAudit({ userId: user.id, userEmail: user.email, action: 'xsd_validated', result: enforceXsd ? 'failure' : 'warning', documentHash: signedHash, details: { invoiceNumber, errors: xsd.errors.slice(0, 10) } })
      if (enforceXsd) {
        await setStatus('rejected', { invoice_number: invoiceNumber, cufe, dian_response_description: 'XSD inválido' })
        return NextResponse.json({ error: 'El XML no cumple el esquema UBL 2.1.', xsdErrors: xsd.errors.slice(0, 10) }, { status: 422 })
      }
    } else {
      await recordAudit({ userId: user.id, userEmail: user.email, action: 'xsd_validated', result: 'success', documentHash: signedHash, details: { invoiceNumber } })
    }

    // 6) Reglas de negocio (Schematron oficial DIAN). Default: advertir.
    const enforceSch = (process.env.DIAN_SCHEMATRON_ENFORCE ?? 'false') === 'true'
    try {
      const sch = await validateBusinessRules(signedXml)
      await recordAudit({
        userId: user.id, userEmail: user.email, action: 'schematron_validated',
        result: sch.valid ? 'success' : (enforceSch ? 'failure' : 'warning'),
        documentHash: signedHash,
        details: { invoiceNumber, findings: sch.findings.slice(0, 15), ignored: sch.ignored.length },
      })
      if (!sch.valid && enforceSch) {
        await setStatus('rejected', { invoice_number: invoiceNumber, cufe, dian_response_description: 'Reglas de negocio (Schematron)' })
        return NextResponse.json({ error: 'El documento no cumple reglas de negocio DIAN.', schematron: sch.findings.slice(0, 15) }, { status: 422 })
      }
    } catch (schErr) {
      await recordAudit({ userId: user.id, userEmail: user.email, action: 'schematron_validated', result: 'warning', documentHash: signedHash, details: { invoiceNumber, engineError: schErr instanceof Error ? schErr.message : 'desconocido' } })
    }

    // 7) SOAP + envío a la DIAN
    const soapEnvelope = buildSoapEnvelope({ signedXml, fileName: `${invoiceNumber}.xml`, certDerB64: cert.certDer.toString('base64') })
    let dianResponse
    try {
      dianResponse = await sendToDian(soapEnvelope, environment)
    } catch (e) {
      if (e instanceof DianTechnicalError) {
        // Error TÉCNICO (red/SOAP Fault/HTTP): el documento está firmado y es válido,
        // pero la DIAN no dio una respuesta de negocio. NO se marca 'rejected'
        // (rechazo permanente): se deja en 'draft' para reintentar. El consecutivo
        // previo queda como hueco justificable — mejor que un rechazo falso.
        await recordAudit({ userId: user.id, userEmail: user.email, action: 'dian_technical_error', result: 'warning', documentHash: signedHash, details: { invoiceNumber, message: e.message, httpStatus: e.httpStatus, environment } })
        await setStatus('draft', { dian_response_description: 'Error técnico de la DIAN (reintentable): ' + e.message })
        return NextResponse.json({ error: 'La DIAN no respondió por un problema técnico; la factura quedó como borrador para reintentar.', retryable: true }, { status: 503 })
      }
      throw e
    }

    await recordAudit({
      userId: user.id, userEmail: user.email,
      action: dianResponse.isValid ? 'dian_sent' : 'dian_rejected',
      result: dianResponse.isValid ? 'success' : 'failure',
      documentHash: signedHash,
      details: { invoiceNumber, statusCode: dianResponse.statusCode, statusDescription: dianResponse.statusDescription, environment },
    })

    const qrBase = environment === '1' ? 'https://catalogo-vpfe.dian.gov.co' : 'https://catalogo-vpfe-hab.dian.gov.co'
    const { data: updatedInvoice } = await supabase
      .from('invoices')
      .update({
        invoice_number: invoiceNumber,
        cufe,
        xml_content: signedXml,
        dian_response_code: dianResponse.statusCode,
        dian_response_description: dianResponse.statusDescription,
        billing_status: dianResponse.isValid ? 'sent_dian' : 'rejected',
        qr_content: `${qrBase}/document/searchqr?documentkey=${cufe}`,
      })
      .eq('id', invoiceId)
      .select()
      .single()

    return NextResponse.json({
      success: dianResponse.isValid,
      invoice: updatedInvoice,
      dian: { isValid: dianResponse.isValid, statusCode: dianResponse.statusCode, statusDescription: dianResponse.statusDescription, cufe },
    })
  } catch (err) {
    console.error('[DIAN pipeline error]', err)
    // El detalle se guarda en la BD (solo admin) y en logs del servidor; al
    // cliente solo le llega un mensaje genérico para no filtrar internos.
    await setStatus(invoiceNumber ? 'rejected' : 'draft', invoiceNumber
      ? { invoice_number: invoiceNumber, dian_response_description: 'Error: ' + (err instanceof Error ? err.message : 'interno') }
      : {})
    return NextResponse.json({ error: 'Error procesando la factura. Revisa la bitácora.' }, { status: 500 })
  }
}
