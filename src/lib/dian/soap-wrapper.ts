/**
 * SOAP 1.2 + WS-Security wrapper for DIAN SendBillSync.
 * Compresses the signed XML with zlib (deflate → ZIP), base64-encodes it,
 * and wraps it in a SOAP envelope with a WSS security header.
 */

import { deflateSync } from 'zlib'
import { createHash, randomBytes } from 'crypto'

export interface SoapOptions {
  signedXml: string
  fileName: string       // e.g. "SETT101.xml"
  certDerB64: string     // base64 DER cert for BinarySecurityToken
}

function now8601(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function addSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function computePasswordDigest(nonce: Buffer, created: string, password: string): string {
  return createHash('sha1')
    .update(Buffer.concat([nonce, Buffer.from(created, 'utf8'), Buffer.from(password, 'utf8')]))
    .digest('base64')
}

/** Zip the XML string and return a base64 string of the ZIP archive */
function zipXmlToBase64(xmlString: string, fileName: string): string {
  // Build a minimal ZIP archive manually (no extra library needed)
  // ZIP local file header + deflated data + central directory + EOCD
  const fileNameBuf = Buffer.from(fileName, 'utf8')
  const xmlBuf = Buffer.from(xmlString, 'utf8')

  const deflated = deflateSync(xmlBuf, { level: 9 })

  const crc32 = computeCRC32(xmlBuf)
  const dosTime = getDosTime(new Date())

  // Local file header (30 + fileNameLen bytes)
  const localHeader = Buffer.alloc(30 + fileNameBuf.length)
  localHeader.writeUInt32LE(0x04034b50, 0)   // signature
  localHeader.writeUInt16LE(20, 4)            // version needed
  localHeader.writeUInt16LE(0, 6)             // flags
  localHeader.writeUInt16LE(8, 8)             // compression: deflate
  localHeader.writeUInt16LE(dosTime.time, 10)
  localHeader.writeUInt16LE(dosTime.date, 12)
  localHeader.writeUInt32LE(crc32, 14)        // CRC-32
  localHeader.writeUInt32LE(deflated.length, 18) // compressed size
  localHeader.writeUInt32LE(xmlBuf.length, 22)   // uncompressed size
  localHeader.writeUInt16LE(fileNameBuf.length, 26)
  localHeader.writeUInt16LE(0, 28)            // extra length
  fileNameBuf.copy(localHeader, 30)

  const localOffset = 0

  // Central directory entry
  const cdEntry = Buffer.alloc(46 + fileNameBuf.length)
  cdEntry.writeUInt32LE(0x02014b50, 0)   // signature
  cdEntry.writeUInt16LE(20, 4)           // version made by
  cdEntry.writeUInt16LE(20, 6)           // version needed
  cdEntry.writeUInt16LE(0, 8)            // flags
  cdEntry.writeUInt16LE(8, 10)           // compression
  cdEntry.writeUInt16LE(dosTime.time, 12)
  cdEntry.writeUInt16LE(dosTime.date, 14)
  cdEntry.writeUInt32LE(crc32, 16)
  cdEntry.writeUInt32LE(deflated.length, 20)
  cdEntry.writeUInt32LE(xmlBuf.length, 24)
  cdEntry.writeUInt16LE(fileNameBuf.length, 28)
  cdEntry.writeUInt16LE(0, 30)  // extra
  cdEntry.writeUInt16LE(0, 32)  // comment
  cdEntry.writeUInt16LE(0, 34)  // disk start
  cdEntry.writeUInt16LE(0, 36)  // int attrs
  cdEntry.writeUInt32LE(0, 38)  // ext attrs
  cdEntry.writeUInt32LE(localOffset, 42) // local header offset
  fileNameBuf.copy(cdEntry, 46)

  const cdOffset = localHeader.length + deflated.length
  const cdSize = cdEntry.length

  // End of central directory
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)   // disk number
  eocd.writeUInt16LE(0, 6)   // disk with start of CD
  eocd.writeUInt16LE(1, 8)   // entries on disk
  eocd.writeUInt16LE(1, 10)  // total entries
  eocd.writeUInt32LE(cdSize, 12)
  eocd.writeUInt32LE(cdOffset, 16)
  eocd.writeUInt16LE(0, 20)  // comment length

  const zip = Buffer.concat([localHeader, deflated, cdEntry, eocd])
  return zip.toString('base64')
}

/** Build the SOAP envelope with WSS security header */
export function buildSoapEnvelope(opts: SoapOptions): string {
  const { signedXml, fileName, certDerB64 } = opts
  const zipB64 = zipXmlToBase64(signedXml, fileName)

  const created = now8601()
  const expires = addSeconds(3600) // 1 hora (3600 s). Antes 60000 s (~16 h), fuera del TTL típico.
  const nonceBytes = randomBytes(22)
  const nonce = nonceBytes.toString('base64')
  const password = process.env.DIAN_SOFTWARE_PIN ?? ''
  const nonceDigest = computePasswordDigest(nonceBytes, created, password)

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
  xmlns:wcf="http://wcf.dian.colombia">
  <soap:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
      xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"
      soap:mustUnderstand="1">
      <wsse:BinarySecurityToken
        EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary"
        ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"
        wsu:Id="X509-Token">${certDerB64}</wsse:BinarySecurityToken>
      <wsu:Timestamp wsu:Id="TS-${randomBytes(4).toString('hex')}">
        <wsu:Created>${created}</wsu:Created>
        <wsu:Expires>${expires}</wsu:Expires>
      </wsu:Timestamp>
      <wsse:UsernameToken>
        <wsse:Username>${process.env.COMPANY_NIT}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${nonceDigest}</wsse:Password>
        <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce}</wsse:Nonce>
        <wsu:Created>${created}</wsu:Created>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    <wcf:SendBillSync>
      <wcf:fileName>${fileName.replace('.xml', '.zip')}</wcf:fileName>
      <wcf:contentFile>${zipB64}</wcf:contentFile>
    </wcf:SendBillSync>
  </soap:Body>
</soap:Envelope>`
}

// ── ZIP helpers ────────────────────────────────────────────────────────────────

function getDosTime(d: Date): { time: number; date: number } {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { time, date }
}

function computeCRC32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}
