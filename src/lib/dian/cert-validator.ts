import 'server-only'
import { X509Certificate, createPrivateKey, type KeyObject } from 'crypto'
import type { CertData } from './xml-signer'

export interface CertInfo {
  subject: string
  issuer: string
  validFrom: string
  validTo: string
  daysToExpiry: number
  keyType: string | undefined
  modulusLength: number | undefined
  keyMatchesCert: boolean
  /** true = verificada contra CA; false = falló; null = no se pudo verificar (sin CA bundle). */
  chainVerified: boolean | null
}

export interface CertValidation {
  /** false si hay algún fallo duro → NO se debe firmar. */
  ok: boolean
  hardFailures: string[]
  warnings: string[]
  info: CertInfo
}

const MIN_MODULUS = 2048
const EXPIRY_WARNING_DAYS = parseInt(process.env.DIAN_CERT_EXPIRY_WARNING_DAYS ?? '30', 10)

/**
 * Valida un certificado y su clave privada de forma nativa (sin terceros).
 * Directriz #1: expiración, integridad, algoritmo, correspondencia y alerta de vencimiento.
 */
export function validateCertificate(cert: CertData): CertValidation {
  const hardFailures: string[] = []
  const warnings: string[] = []

  let x509: X509Certificate
  try {
    x509 = new X509Certificate(cert.certPem)
  } catch {
    return {
      ok: false,
      hardFailures: ['El certificado no es un X.509 válido (no se pudo parsear).'],
      warnings: [],
      info: emptyInfo(),
    }
  }

  // Expiración / vigencia
  const now = Date.now()
  const validFrom = new Date(x509.validFrom)
  const validTo = new Date(x509.validTo)
  const daysToExpiry = Math.floor((validTo.getTime() - now) / 86_400_000)

  if (isNaN(validTo.getTime())) {
    hardFailures.push('No se pudo determinar la fecha de expiración del certificado.')
  } else if (validTo.getTime() < now) {
    hardFailures.push(`El certificado está VENCIDO desde ${validTo.toISOString()}.`)
  } else if (daysToExpiry <= EXPIRY_WARNING_DAYS) {
    warnings.push(`El certificado vence en ${daysToExpiry} día(s) (${validTo.toISOString()}). Programar renovación.`)
  }
  if (!isNaN(validFrom.getTime()) && validFrom.getTime() > now) {
    hardFailures.push(`El certificado aún no es válido (inicia ${validFrom.toISOString()}).`)
  }

  // Tipo y robustez de la clave pública
  const pub = x509.publicKey
  const keyType = pub.asymmetricKeyType
  const modulusLength = pub.asymmetricKeyDetails?.modulusLength
  if (keyType !== 'rsa') {
    hardFailures.push(`Algoritmo de clave no soportado para la firma DIAN: "${keyType}". Se requiere RSA.`)
  }
  if (modulusLength !== undefined && modulusLength < MIN_MODULUS) {
    hardFailures.push(`La clave RSA es de ${modulusLength} bits; el mínimo es ${MIN_MODULUS}.`)
  }

  // Correspondencia clave privada ↔ certificado (evita firmas inválidas)
  let keyMatchesCert = false
  try {
    const privKey: KeyObject = createPrivateKey(cert.privateKeyPem)
    keyMatchesCert = x509.checkPrivateKey(privKey)
    if (!keyMatchesCert) {
      hardFailures.push('La clave privada NO corresponde al certificado. La firma sería inválida.')
    }
  } catch (e) {
    hardFailures.push('No se pudo validar la clave privada: ' + (e instanceof Error ? e.message : 'desconocido'))
  }

  // Cadena de confianza — solo si se aporta el bundle de la Autoridad Certificadora.
  const chainVerified = verifyChain(x509, warnings)

  return {
    ok: hardFailures.length === 0,
    hardFailures,
    warnings,
    info: {
      subject: x509.subject,
      issuer: x509.issuer,
      validFrom: x509.validFrom,
      validTo: x509.validTo,
      daysToExpiry,
      keyType,
      modulusLength,
      keyMatchesCert,
      chainVerified,
    },
  }
}

/**
 * Verifica que el certificado esté firmado por alguna AC del bundle
 * `DIAN_CA_BUNDLE_BASE64` (PEM concatenados, base64). Sin bundle → null (no verificada).
 * No se fabrica una validación de cadena completa: se reporta honestamente el estado.
 */
function verifyChain(leaf: X509Certificate, warnings: string[]): boolean | null {
  const caB64 = process.env.DIAN_CA_BUNDLE_BASE64
  if (!caB64) {
    warnings.push('Cadena de confianza NO verificada: falta DIAN_CA_BUNDLE_BASE64 (raíz/intermedios de la AC autorizada).')
    return null
  }
  try {
    const pem = Buffer.from(caB64, 'base64').toString('utf8')
    const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? []
    if (blocks.length === 0) {
      warnings.push('DIAN_CA_BUNDLE_BASE64 no contiene certificados PEM válidos.')
      return false
    }
    const signedBySomeCA = blocks.some(b => {
      try {
        const ca = new X509Certificate(b)
        return leaf.verify(ca.publicKey) && new Date(ca.validTo).getTime() > Date.now()
      } catch {
        return false
      }
    })
    if (!signedBySomeCA) {
      warnings.push('El certificado no fue firmado por ninguna AC vigente del bundle provisto.')
    }
    return signedBySomeCA
  } catch (e) {
    warnings.push('No se pudo verificar la cadena: ' + (e instanceof Error ? e.message : 'desconocido'))
    return false
  }
}

/** Lanza si el certificado no es utilizable (Secure by Default: no firmar con cert inválido). */
export function assertCertUsable(cert: CertData): CertValidation {
  const result = validateCertificate(cert)
  if (!result.ok) {
    throw new Error('Certificado no utilizable: ' + result.hardFailures.join(' '))
  }
  return result
}

function emptyInfo(): CertInfo {
  return {
    subject: '', issuer: '', validFrom: '', validTo: '', daysToExpiry: 0,
    keyType: undefined, modulusLength: undefined, keyMatchesCert: false, chainVerified: null,
  }
}
