import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateCUDE } from '@/lib/dian/cude-calculator'
import { generateCreditNoteXML } from '@/lib/dian/credit-note-generator'
import { CREDIT_NOTE_CONCEPTS } from '@/lib/dian/credit-note-concepts'
import { signXML, loadCertFromEnv, verifySignatureInternally } from '@/lib/dian/xml-signer'
import { validateCertificate } from '@/lib/dian/cert-validator'
import { validateCreditNoteXsd } from '@/lib/dian/xsd-validator'
import { validateBusinessRules } from '@/lib/dian/schematron-validator'
import { buildSoapEnvelope } from '@/lib/dian/soap-wrapper'
import { sendToDian, DianTechnicalError } from '@/lib/dian/dian-client'
import { recordAudit, hashDocument } from '@/lib/audit/log'
import { isSameOrigin } from '@/lib/auth/origin'
import { isUuid } from '@/lib/validate'
import { missingEmissionEnv } from '@/lib/dian/env-check'
import { computeTax, configuredIvaRate } from '@/lib/dian/tax'
import { requireAdmin } from '@/lib/auth/require-admin'

// Pipeline pesado (firma + WASM + SaxonJS + SOAP): Node runtime, tiempo extendido.
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 })
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await req.json().catch(() => ({}))) as { invoiceId?: string; conceptCode?: string; reason?: string }
  const { invoiceId, conceptCode, reason } = body
  if (!isUuid(invoiceId)) return NextResponse.json({ error: 'invoiceId inválido' }, { status: 400 })
  const concept = CREDIT_NOTE_CONCEPTS.find(c => c.code === conceptCode)
  if (!concept) return NextResponse.json({ error: 'Concepto de nota crédito inválido' }, { status: 400 })

  const supabase = await createClient()
  const admin = createAdminClient()

  // La factura a anular/corregir debe estar VALIDADA por la DIAN y tener CUFE.
  const { data: invoice } = await supabase.from('invoices').select('*, clients(*)').eq('id', invoiceId).single()
  if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  if (invoice.billing_status !== 'sent_dian' || !invoice.cufe || !invoice.invoice_number) {
    return NextResponse.json({ error: 'Solo se puede emitir nota crédito sobre una factura validada por la DIAN.' }, { status: 422 })
  }

  // Evitar duplicar: si ya hay una nota en curso o aceptada para esta factura, no se crea otra.
  const { data: existing } = await admin
    .from('credit_notes')
    .select('id, billing_status')
    .eq('invoice_id', invoiceId)
    .in('billing_status', ['processing', 'sent_dian'])
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: `Esta factura ya tiene una nota crédito en estado '${existing.billing_status}'.` }, { status: 409 })
  }

  const client = invoice.clients as NonNullable<typeof invoice.clients>
  const { data: services } = await admin.from('services').select('*').eq('invoice_id', invoiceId).order('start_time')
  if (!services?.length) return NextResponse.json({ error: 'La factura no tiene servicios asociados' }, { status: 400 })

  // Fila de la nota en 'processing' (registro del intento).
  const { data: note, error: noteErr } = await admin
    .from('credit_notes')
    .insert({ invoice_id: invoiceId, concept_code: concept.code, reason: reason ?? concept.label, billing_status: 'processing' })
    .select()
    .single()
  if (noteErr || !note) return NextResponse.json({ error: 'No se pudo crear la nota: ' + (noteErr?.message ?? '') }, { status: 500 })

  const setStatus = (status: string, patch: Record<string, unknown> = {}) =>
    admin.from('credit_notes').update({ billing_status: status, ...patch }).eq('id', note.id)

  let noteNumber: string | null = null
  try {
    const issueDate = new Date()
    const environment = (process.env.DIAN_ENVIRONMENT ?? '2') as '1' | '2'

    const missing = missingEmissionEnv()
    if (missing.length) {
      await admin.from('credit_notes').delete().eq('id', note.id)
      return NextResponse.json({ error: 'Configuración de emisión incompleta o inválida: ' + missing.join(', ') }, { status: 422 })
    }

    const ivaRate = configuredIvaRate()
    const tax = computeTax(services.map(s => Number(s.price_cop)), ivaRate)

    // Certificado antes de numerar.
    const cert = loadCertFromEnv()
    const certCheck = validateCertificate(cert)
    if (!certCheck.ok) {
      await admin.from('credit_notes').delete().eq('id', note.id)
      return NextResponse.json({ error: 'Certificado no utilizable: ' + certCheck.hardFailures.join(' ') }, { status: 422 })
    }

    // Consecutivo de nota crédito (prefijo propio). service_role.
    const prefix = process.env.CREDIT_NOTE_PREFIX ?? 'NC'
    const { data: seq, error: seqErr } = await admin.rpc('allocate_invoice_number', { p_prefix: prefix })
    if (seqErr || seq == null) {
      await admin.from('credit_notes').delete().eq('id', note.id)
      return NextResponse.json({ error: 'No se pudo asignar el consecutivo: ' + (seqErr?.message ?? '') }, { status: 500 })
    }
    noteNumber = `${prefix}${seq}`

    const cude = calculateCUDE({
      noteNumber, issueDate, taxableBase: tax.taxableBase,
      taxAmount01: tax.taxAmount, taxAmount04: 0, taxAmount03: 0, totalAmount: tax.total,
      supplierNit: process.env.COMPANY_NIT!, customerDoc: client.nit_cedula,
      softwarePin: process.env.DIAN_SOFTWARE_PIN!, environment,
    })

    // Fecha de la factura original en hora legal de Colombia (UTC-5), consistente
    // con la que declaró el XML original.
    const origIssue = new Date(new Date(invoice.issue_date).getTime() - 5 * 3600_000)
    const origIssueStr = `${origIssue.getUTCFullYear()}-${String(origIssue.getUTCMonth() + 1).padStart(2, '0')}-${String(origIssue.getUTCDate()).padStart(2, '0')}`

    const xmlRaw = generateCreditNoteXML({
      noteNumber, issueDate, client, services, totalAmount: tax.total,
      taxAmount: tax.taxAmount, taxableBase: tax.taxableBase, taxRate: ivaRate, cude, environment,
      original: { number: invoice.invoice_number, cufe: invoice.cufe, issueDate: origIssueStr },
      concept: { code: concept.code, description: reason ?? concept.label },
    })

    const signedXml = signXML(xmlRaw, cert)
    const ver = verifySignatureInternally(signedXml, cert)
    if (!ver.ok) {
      await recordAudit({ userId: auth.ctx.userId, action: 'invoice_signed', result: 'failure', details: { noteNumber, reason: ver.reason, kind: 'credit_note' } })
      await admin.from('credit_notes').delete().eq('id', note.id)
      return NextResponse.json({ error: 'La firma de la nota no validó internamente; no se envió a la DIAN.' }, { status: 500 })
    }
    const signedHash = hashDocument(signedXml)
    await recordAudit({ userId: auth.ctx.userId, action: 'invoice_signed', result: 'success', documentHash: signedHash, details: { noteNumber, cude, kind: 'credit_note' } })

    // XSD (UBL-CreditNote)
    const enforceXsd = (process.env.DIAN_XSD_ENFORCE ?? 'true') !== 'false'
    const xsd = await validateCreditNoteXsd(signedXml)
    if (!xsd.valid && enforceXsd) {
      await setStatus('rejected', { note_number: noteNumber, cude, dian_response_description: 'XSD inválido' })
      return NextResponse.json({ error: 'La nota no cumple el esquema UBL 2.1.', xsdErrors: xsd.errors.slice(0, 10) }, { status: 422 })
    }

    // Schematron (reglas de negocio). Default: advertir.
    const enforceSch = (process.env.DIAN_SCHEMATRON_ENFORCE ?? 'false') === 'true'
    try {
      const sch = await validateBusinessRules(signedXml)
      if (!sch.valid && enforceSch) {
        await setStatus('rejected', { note_number: noteNumber, cude, dian_response_description: 'Reglas de negocio (Schematron)' })
        return NextResponse.json({ error: 'La nota no cumple reglas de negocio DIAN.', schematron: sch.findings.slice(0, 15) }, { status: 422 })
      }
    } catch { /* el motor Schematron no debe tumbar el envío */ }

    // SOAP + envío
    const soapEnvelope = buildSoapEnvelope({ signedXml, fileName: `${noteNumber}.xml`, certDerB64: cert.certDer.toString('base64') })
    let dianResponse
    try {
      dianResponse = await sendToDian(soapEnvelope, environment)
    } catch (e) {
      if (e instanceof DianTechnicalError) {
        // Error técnico/transitorio: se descarta el intento (como los demás fallos
        // tempranos) para poder reintentar limpio; no se marca 'rejected'.
        await recordAudit({ userId: auth.ctx.userId, action: 'dian_technical_error', result: 'warning', documentHash: signedHash, details: { noteNumber, message: e.message, httpStatus: e.httpStatus, kind: 'credit_note' } })
        await admin.from('credit_notes').delete().eq('id', note.id)
        return NextResponse.json({ error: 'La DIAN no respondió por un problema técnico; reintenta la nota crédito.', retryable: true }, { status: 503 })
      }
      throw e
    }

    await recordAudit({
      userId: auth.ctx.userId, action: dianResponse.isValid ? 'dian_sent' : 'dian_rejected',
      result: dianResponse.isValid ? 'success' : 'failure', documentHash: signedHash,
      details: { noteNumber, statusCode: dianResponse.statusCode, kind: 'credit_note' },
    })

    const qrBase = environment === '1' ? 'https://catalogo-vpfe.dian.gov.co' : 'https://catalogo-vpfe-hab.dian.gov.co'
    const { data: updated } = await admin
      .from('credit_notes')
      .update({
        note_number: noteNumber, cude, xml_content: signedXml,
        dian_response_code: dianResponse.statusCode, dian_response_description: dianResponse.statusDescription,
        billing_status: dianResponse.isValid ? 'sent_dian' : 'rejected',
        subtotal: tax.taxableBase, tax_amount: tax.taxAmount, total_amount: tax.total,
        qr_content: `${qrBase}/document/searchqr?documentkey=${cude}`,
      })
      .eq('id', note.id)
      .select()
      .single()

    return NextResponse.json({ success: dianResponse.isValid, creditNote: updated, dian: { isValid: dianResponse.isValid, statusCode: dianResponse.statusCode, statusDescription: dianResponse.statusDescription, cude } })
  } catch (err) {
    console.error('[credit-note pipeline error]', err)
    await setStatus(noteNumber ? 'rejected' : 'draft', noteNumber
      ? { note_number: noteNumber, dian_response_description: 'Error: ' + (err instanceof Error ? err.message : 'interno') }
      : {})
    return NextResponse.json({ error: 'Error procesando la nota crédito. Revisa la bitácora.' }, { status: 500 })
  }
}
