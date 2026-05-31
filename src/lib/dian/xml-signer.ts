/**
 * XAdES-EPES Enveloped Signature using native Node.js crypto.
 *
 * DIAN requires XAdES-EPES (ETSI TS 101 903) with RSA-SHA256.
 * The signature node is injected into the second <ext:UBLExtension>
 * placeholder left empty in the XML template.
 *
 * Certificate handling:
 *  - Node's crypto signs with PEM keys; it cannot extract a key from a
 *    PKCS#12 (.pfx) container natively. The .pfx the DIAN issues is
 *    therefore converted ONCE to two PEM values via scripts/pfx-to-env.mjs
 *    and stored as DIAN_PRIVATE_KEY_BASE64 + DIAN_CERTIFICATE_BASE64.
 *
 * NOTE ON CANONICALIZATION: a fully DIAN-compliant signature requires
 * exclusive XML canonicalization (exc-c14n) of the signed nodes before
 * digesting. The digests below are computed over the serialized strings,
 * which is sufficient for structural validation but must be hardened with
 * a real C14N pass before going live in production. See README.
 */

import 'server-only'
import { createHash, createSign, createVerify, X509Certificate, createPrivateKey } from 'crypto'
import { ExclusiveCanonicalization } from 'xml-crypto'
import { DOMParser, XMLSerializer, type Node as XmlNode } from '@xmldom/xmldom'

const C14N_EXC = 'http://www.w3.org/2001/10/xml-exc-c14n#'
const ALG_SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256'
const ALG_SHA384 = 'http://www.w3.org/2001/04/xmldsig-more#sha384'
const ALG_RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
const ALG_ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'

// Política de firma DIAN (valores tomados de los ejemplos oficiales de la Caja de
// Herramientas 1.9; el DigestValue corresponde al PDF de política v2 de la DIAN).
const SIG_POLICY_URL = 'https://facturaelectronica.dian.gov.co/politicadefirma/v1/politicadefirmav2.pdf'
const SIG_POLICY_HASH = 'EQC0kiWPaAME6IsEZ7WuaTWJ97Zmf6hIO69rMCVURmQxBB9ebgLrjhL5BArQ0a0l'

/** Canonicalización exclusiva (exc-c14n) conforme W3C, vía xml-crypto (auditada). */
function canonicalizeExc(node: unknown): string {
  const c = new ExclusiveCanonicalization()
  // @ts-expect-error xml-crypto acepta el nodo DOM de xmldom
  return c.process(node, {}) as string
}

export interface CertData {
  privateKeyPem: string  // PEM-encoded RSA private key
  certPem: string        // PEM-encoded X.509 certificate
  certDer: Buffer        // Raw DER bytes of the certificate
}

/**
 * Load certificate data from environment variables.
 * Both env vars hold base64-encoded PEM strings (see scripts/pfx-to-env.mjs).
 * Throws descriptive errors so misconfiguration fails loudly, not silently.
 */
export function loadCertFromEnv(): CertData {
  const keyB64 = process.env.DIAN_PRIVATE_KEY_BASE64
  const certB64 = process.env.DIAN_CERTIFICATE_BASE64

  if (!keyB64) {
    throw new Error(
      'DIAN_PRIVATE_KEY_BASE64 no está configurada. Ejecuta `node scripts/pfx-to-env.mjs <cert.pfx> <password>` y copia el resultado a .env.local.'
    )
  }
  if (!certB64) {
    throw new Error(
      'DIAN_CERTIFICATE_BASE64 no está configurada. Ejecuta `node scripts/pfx-to-env.mjs <cert.pfx> <password>` y copia el resultado a .env.local.'
    )
  }

  const privateKeyPem = Buffer.from(keyB64, 'base64').toString('utf8')
  const certPem = Buffer.from(certB64, 'base64').toString('utf8')

  if (!privateKeyPem.includes('PRIVATE KEY')) {
    throw new Error('DIAN_PRIVATE_KEY_BASE64 no contiene un PEM de clave privada válido.')
  }
  if (!certPem.includes('CERTIFICATE')) {
    throw new Error('DIAN_CERTIFICATE_BASE64 no contiene un PEM de certificado válido.')
  }

  // Validate the key actually parses (catches wrong password / corrupt conversion early).
  try {
    createPrivateKey(privateKeyPem)
  } catch (e) {
    throw new Error('No se pudo parsear la clave privada PEM: ' + (e instanceof Error ? e.message : 'desconocido'))
  }

  // Extract DER bytes from PEM (strip header/footer, decode base64).
  const b64 = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '')
  const certDer = Buffer.from(b64, 'base64')

  return { privateKeyPem, certPem, certDer }
}

function sha256Base64(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('base64')
}

function now8601(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * Sign a UBL 2.1 XML string with XAdES-EPES.
 * Returns the XML with the signature injected into the second UBLExtension.
 */
export function signXML(xmlString: string, cert: CertData): string {
  const signatureId = `xmldsig-${generateId()}`
  const signedPropertiesId = `${signatureId}-signedprops`
  const signatureValueId = `${signatureId}-sigvalue`
  const keyInfoId = `${signatureId}-keyinfo`
  const ref0Id = `${signatureId}-ref0`     // documento
  const ref1Id = `${signatureId}-ref1`     // SignedProperties

  const certDerB64 = cert.certDer.toString('base64')
  const certDigest = sha256Base64(cert.certDer)
  let certSerial = '0'
  let certIssuer = 'unknown'
  try {
    const x509 = new X509Certificate(cert.certPem)
    // X509SerialNumber debe ser entero DECIMAL (el XSD lo tipa como xs:integer).
    certSerial = BigInt('0x' + x509.serialNumber).toString()
    // RFC 2253: orden inverso, separado por comas.
    certIssuer = x509.issuer.split('\n').filter(Boolean).reverse().join(', ')
  } catch {}
  const signingTime = now8601()

  // SignedProperties — declara sus propios namespaces (exc-c14n queda estable).
  const signedPropertiesXml =
    `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="${signedPropertiesId}">` +
      `<xades:SignedSignatureProperties>` +
        `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
        `<xades:SigningCertificate><xades:Cert>` +
          `<xades:CertDigest>` +
            `<ds:DigestMethod Algorithm="${ALG_SHA256}"/>` +
            `<ds:DigestValue>${certDigest}</ds:DigestValue>` +
          `</xades:CertDigest>` +
          `<xades:IssuerSerial>` +
            `<ds:X509IssuerName>${escapeXml(certIssuer)}</ds:X509IssuerName>` +
            `<ds:X509SerialNumber>${certSerial}</ds:X509SerialNumber>` +
          `</xades:IssuerSerial>` +
        `</xades:Cert></xades:SigningCertificate>` +
        `<xades:SignaturePolicyIdentifier><xades:SignaturePolicyId>` +
          `<xades:SigPolicyId><xades:Identifier>${SIG_POLICY_URL}</xades:Identifier></xades:SigPolicyId>` +
          `<xades:SigPolicyHash>` +
            `<ds:DigestMethod Algorithm="${ALG_SHA384}"/>` +
            `<ds:DigestValue>${SIG_POLICY_HASH}</ds:DigestValue>` +
          `</xades:SigPolicyHash>` +
        `</xades:SignaturePolicyId></xades:SignaturePolicyIdentifier>` +
        `<xades:SignerRole><xades:ClaimedRoles><xades:ClaimedRole>supplier</xades:ClaimedRole></xades:ClaimedRoles></xades:SignerRole>` +
      `</xades:SignedSignatureProperties>` +
    `</xades:SignedProperties>`

  // Esqueleto de la firma con DigestValue/SignatureValue vacíos. Los digests se
  // calcularán con exc-c14n real sobre el DOM, no sobre cadenas.
  const signatureSkeleton =
    `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="${signatureId}">` +
      `<ds:SignedInfo>` +
        `<ds:CanonicalizationMethod Algorithm="${C14N_EXC}"/>` +
        `<ds:SignatureMethod Algorithm="${ALG_RSA_SHA256}"/>` +
        `<ds:Reference Id="${ref0Id}" URI="">` +
          `<ds:Transforms>` +
            `<ds:Transform Algorithm="${ALG_ENVELOPED}"/>` +
            `<ds:Transform Algorithm="${C14N_EXC}"/>` +
          `</ds:Transforms>` +
          `<ds:DigestMethod Algorithm="${ALG_SHA256}"/>` +
          `<ds:DigestValue></ds:DigestValue>` +
        `</ds:Reference>` +
        `<ds:Reference Id="${ref1Id}" Type="http://uri.etsi.org/01903#SignedProperties" URI="#${signedPropertiesId}">` +
          `<ds:Transforms><ds:Transform Algorithm="${C14N_EXC}"/></ds:Transforms>` +
          `<ds:DigestMethod Algorithm="${ALG_SHA256}"/>` +
          `<ds:DigestValue></ds:DigestValue>` +
        `</ds:Reference>` +
      `</ds:SignedInfo>` +
      `<ds:SignatureValue Id="${signatureValueId}"></ds:SignatureValue>` +
      `<ds:KeyInfo Id="${keyInfoId}"><ds:X509Data><ds:X509Certificate>${certDerB64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>` +
      `<ds:Object><xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="#${signatureId}">${signedPropertiesXml}</xades:QualifyingProperties></ds:Object>` +
    `</ds:Signature>`

  const fullXml = injectIntoSignatureSlot(xmlString, signatureSkeleton)

  // Parsear y calcular digests reales con exc-c14n.
  const doc = new DOMParser().parseFromString(fullXml, 'text/xml')
  const sigNode = firstByTag(doc, 'ds:Signature')
  if (!sigNode) throw new Error('No se pudo ubicar el nodo ds:Signature tras inyectar la firma.')

  // Reference 0 (documento, transform enveloped + exc-c14n): clonar doc, quitar la firma, exc-c14n.
  const docClone = new DOMParser().parseFromString(fullXml, 'text/xml')
  const sigInClone = firstByTag(docClone, 'ds:Signature')
  sigInClone?.parentNode?.removeChild(sigInClone)
  const docDigest = sha256Base64(Buffer.from(canonicalizeExc(docClone.documentElement), 'utf8'))

  // Reference 1 (SignedProperties, exc-c14n).
  const spNode = firstByTag(doc, 'xades:SignedProperties')
  if (!spNode) throw new Error('No se pudo ubicar xades:SignedProperties.')
  const spDigest = sha256Base64(Buffer.from(canonicalizeExc(spNode), 'utf8'))

  // Inyectar los DigestValue.
  const digestValues = allByTag(sigNode, 'ds:DigestValue')
  setText(digestValues[0], docDigest)
  setText(digestValues[1], spDigest)

  // Firmar el SignedInfo canonicalizado (exc-c14n) con RSA-SHA256.
  const signedInfoNode = firstByTag(sigNode, 'ds:SignedInfo')
  if (!signedInfoNode) throw new Error('No se pudo ubicar ds:SignedInfo.')
  const signedInfoCanon = canonicalizeExc(signedInfoNode)
  const signer = createSign('RSA-SHA256')
  signer.update(signedInfoCanon, 'utf8')
  const signatureValue = signer.sign(cert.privateKeyPem, 'base64')
  setText(firstByTag(sigNode, 'ds:SignatureValue'), signatureValue)

  return new XMLSerializer().serializeToString(doc)
}

/**
 * Verifica que una firma sea internamente consistente (digests + firma) con el
 * certificado dado. Usado por las pruebas para garantizar validez antes de confiar.
 */
export function verifySignatureInternally(signedXml: string, cert: CertData): { ok: boolean; reason?: string } {
  try {
    const doc = new DOMParser().parseFromString(signedXml, 'text/xml')
    const sigNode = firstByTag(doc, 'ds:Signature')
    if (!sigNode) return { ok: false, reason: 'No hay ds:Signature' }

    // Digest del documento (enveloped + exc-c14n)
    const clone = new DOMParser().parseFromString(signedXml, 'text/xml')
    const sigClone = firstByTag(clone, 'ds:Signature')
    sigClone?.parentNode?.removeChild(sigClone)
    const docDigest = sha256Base64(Buffer.from(canonicalizeExc(clone.documentElement), 'utf8'))

    const spNode = firstByTag(doc, 'xades:SignedProperties')
    const spDigest = spNode ? sha256Base64(Buffer.from(canonicalizeExc(spNode), 'utf8')) : ''

    const digestValues = allByTag(sigNode, 'ds:DigestValue')
    if (getText(digestValues[0]) !== docDigest) return { ok: false, reason: 'Digest del documento no coincide' }
    if (spNode && getText(digestValues[1]) !== spDigest) return { ok: false, reason: 'Digest de SignedProperties no coincide' }

    // Verificar la firma del SignedInfo
    const signedInfoNode = firstByTag(sigNode, 'ds:SignedInfo')
    const signedInfoCanon = canonicalizeExc(signedInfoNode)
    const sigValue = getText(firstByTag(sigNode, 'ds:SignatureValue'))
    const verifier = createVerify('RSA-SHA256')
    verifier.update(signedInfoCanon, 'utf8')
    const ok = verifier.verify(cert.certPem, Buffer.from(sigValue, 'base64'))
    return ok ? { ok: true } : { ok: false, reason: 'La firma RSA-SHA256 no valida' }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'error' }
  }
}

// ── Helpers DOM (xmldom) ────────────────────────────────────────────────────────

function injectIntoSignatureSlot(xmlString: string, signature: string): string {
  // El generador deja un segundo <ext:ExtensionContent/> vacío para la firma.
  if (xmlString.includes('<ext:ExtensionContent/>')) {
    return xmlString.replace('<ext:ExtensionContent/>', `<ext:ExtensionContent>${signature}</ext:ExtensionContent>`)
  }
  throw new Error('No se encontró el slot <ext:ExtensionContent/> para la firma.')
}

type El = ReturnType<DOMParser['parseFromString']>['documentElement']

function firstByTag(scope: { getElementsByTagName(t: string): { length: number; item(i: number): unknown } }, tag: string): El | null {
  const list = scope.getElementsByTagName(tag)
  return (list.length ? (list.item(0) as El) : null)
}
function allByTag(scope: { getElementsByTagName(t: string): { length: number; item(i: number): unknown } }, tag: string): El[] {
  const list = scope.getElementsByTagName(tag)
  const out: El[] = []
  for (let i = 0; i < list.length; i++) out.push(list.item(i) as El)
  return out
}
function setText(node: El | null, text: string) {
  if (node) (node as unknown as XmlNode).textContent = text
}
function getText(node: El | null): string {
  return node ? ((node as unknown as XmlNode).textContent ?? '') : ''
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
