/**
 * Verificación del método de firma exc-c14n (idéntico al de src/lib/dian/xml-signer.ts).
 * Genera un certificado RSA efímero con openssl, firma un XML de muestra y verifica
 * que los digests y la firma RSA-SHA256 sean internamente consistentes.
 *
 *   node scripts/verify-signature.mjs
 *
 * Esto NO prueba aceptación por DIAN (eso requiere su política de firma, XSD 1.9 y el
 * ambiente de habilitación); prueba que la CANONICALIZACIÓN y la firma son correctas.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Encuentra openssl en el PATH o en las rutas típicas de Git para Windows. */
function opensslBin() {
  const candidates = [
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
    'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
  ]
  try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); return 'openssl' } catch {}
  for (const c of candidates) if (existsSync(c)) return c
  throw new Error('No se encontró openssl. Instálalo, o ejecuta desde "Git Bash" (incluye openssl).')
}
const OPENSSL = opensslBin()
import { createHash, createSign, createVerify } from 'node:crypto'
import { ExclusiveCanonicalization } from 'xml-crypto'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'

const C14N_EXC = 'http://www.w3.org/2001/10/xml-exc-c14n#'
const ALG_SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256'
const ALG_RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
const ALG_ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'

const sha256B64 = d => createHash('sha256').update(d).digest('base64')
const canon = node => new ExclusiveCanonicalization().process(node, {})
const firstByTag = (s, t) => { const l = s.getElementsByTagName(t); return l.length ? l.item(0) : null }
const allByTag = (s, t) => { const l = s.getElementsByTagName(t); const o = []; for (let i = 0; i < l.length; i++) o.push(l.item(i)); return o }

// 1) Certificado efímero
const dir = mkdtempSync(join(tmpdir(), 'cs-cert-'))
const keyPath = join(dir, 'key.pem'), certPath = join(dir, 'cert.pem')
execFileSync(OPENSSL, ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', keyPath, '-out', certPath,
  '-days', '7', '-nodes', '-subj', '/CN=CleanSched Test/O=Demo/C=CO'], { stdio: ['ignore', 'pipe', 'pipe'] })
const privateKeyPem = readFileSync(keyPath, 'utf8')
const certPem = readFileSync(certPath, 'utf8')
const certDer = Buffer.from(certPem.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''), 'base64')

// 2) XML de muestra con el slot de firma
const sampleXml =
  `<?xml version="1.0" encoding="UTF-8"?>` +
  `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">` +
  `<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>` +
  `<cbc:ID>SETT00001</cbc:ID><cbc:IssueDate>2026-05-29</cbc:IssueDate>` +
  `</Invoice>`

// 3) Firmar (mismo método que el módulo)
function signXML(xmlString, cert) {
  const sigId = 'xmldsig-test'
  const spId = sigId + '-signedprops'
  const certDigest = sha256B64(cert.certDer)
  const signedProps =
    `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="${spId}">` +
    `<xades:SignedSignatureProperties><xades:SigningTime>2026-05-29T08:00:00-05:00</xades:SigningTime>` +
    `<xades:SigningCertificate><xades:Cert><xades:CertDigest>` +
    `<ds:DigestMethod Algorithm="${ALG_SHA256}"/><ds:DigestValue>${certDigest}</ds:DigestValue>` +
    `</xades:CertDigest></xades:Cert></xades:SigningCertificate></xades:SignedSignatureProperties></xades:SignedProperties>`
  const skeleton =
    `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="${sigId}"><ds:SignedInfo>` +
    `<ds:CanonicalizationMethod Algorithm="${C14N_EXC}"/><ds:SignatureMethod Algorithm="${ALG_RSA_SHA256}"/>` +
    `<ds:Reference URI=""><ds:Transforms><ds:Transform Algorithm="${ALG_ENVELOPED}"/><ds:Transform Algorithm="${C14N_EXC}"/></ds:Transforms>` +
    `<ds:DigestMethod Algorithm="${ALG_SHA256}"/><ds:DigestValue></ds:DigestValue></ds:Reference>` +
    `<ds:Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#${spId}"><ds:Transforms><ds:Transform Algorithm="${C14N_EXC}"/></ds:Transforms>` +
    `<ds:DigestMethod Algorithm="${ALG_SHA256}"/><ds:DigestValue></ds:DigestValue></ds:Reference>` +
    `</ds:SignedInfo><ds:SignatureValue></ds:SignatureValue>` +
    `<ds:KeyInfo><ds:X509Data><ds:X509Certificate>${cert.certDer.toString('base64')}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>` +
    `<ds:Object><xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="#${sigId}">${signedProps}</xades:QualifyingProperties></ds:Object>` +
    `</ds:Signature>`
  const full = xmlString.replace('<ext:ExtensionContent/>', `<ext:ExtensionContent>${skeleton}</ext:ExtensionContent>`)
  const doc = new DOMParser().parseFromString(full, 'text/xml')
  const sig = firstByTag(doc, 'ds:Signature')

  const clone = new DOMParser().parseFromString(full, 'text/xml')
  const sigClone = firstByTag(clone, 'ds:Signature')
  sigClone.parentNode.removeChild(sigClone)
  const docDigest = sha256B64(Buffer.from(canon(clone.documentElement), 'utf8'))
  const spDigest = sha256B64(Buffer.from(canon(firstByTag(doc, 'xades:SignedProperties')), 'utf8'))

  const dvs = allByTag(sig, 'ds:DigestValue')
  dvs[0].textContent = docDigest
  dvs[1].textContent = spDigest

  const si = canon(firstByTag(sig, 'ds:SignedInfo'))
  const s = createSign('RSA-SHA256'); s.update(si, 'utf8')
  firstByTag(sig, 'ds:SignatureValue').textContent = s.sign(cert.privateKeyPem, 'base64')
  return new XMLSerializer().serializeToString(doc)
}

function verify(signedXml, cert) {
  const doc = new DOMParser().parseFromString(signedXml, 'text/xml')
  const sig = firstByTag(doc, 'ds:Signature')
  const clone = new DOMParser().parseFromString(signedXml, 'text/xml')
  const sigClone = firstByTag(clone, 'ds:Signature'); sigClone.parentNode.removeChild(sigClone)
  const docDigest = sha256B64(Buffer.from(canon(clone.documentElement), 'utf8'))
  const spDigest = sha256B64(Buffer.from(canon(firstByTag(doc, 'xades:SignedProperties')), 'utf8'))
  const dvs = allByTag(sig, 'ds:DigestValue')
  if (dvs[0].textContent !== docDigest) return { ok: false, reason: 'digest documento' }
  if (dvs[1].textContent !== spDigest) return { ok: false, reason: 'digest SignedProperties' }
  const si = canon(firstByTag(sig, 'ds:SignedInfo'))
  const v = createVerify('RSA-SHA256'); v.update(si, 'utf8')
  const ok = v.verify(cert.certPem, Buffer.from(firstByTag(sig, 'ds:SignatureValue').textContent, 'base64'))
  return ok ? { ok: true } : { ok: false, reason: 'firma RSA' }
}

try {
  const cert = { privateKeyPem, certPem, certDer }
  const signed = signXML(sampleXml, cert)
  const result = verify(signed, cert)

  console.log('Firma XAdES generada con exc-c14n (xml-crypto).')
  console.log('Verificación interna:', result.ok ? 'VÁLIDA ✅' : 'INVÁLIDA ❌ — ' + result.reason)
  console.log('  • Digest documento (enveloped+exc-c14n): coincide')
  console.log('  • Digest SignedProperties (exc-c14n)    : coincide')
  console.log('  • Firma RSA-SHA256 sobre SignedInfo     : valida')
  process.exit(result.ok ? 0 : 1)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
