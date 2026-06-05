/**
 * HTTP client for DIAN Web Services.
 * Sends the SOAP envelope and parses the XML response.
 */

export interface DianResponse {
  isValid: boolean
  statusCode: string
  statusDescription: string
  statusMessage: string
  cufe: string
  raw: string
}

const ENDPOINTS = {
  '1': 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc',
  '2': 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc',
} as const

export async function sendToDian(
  soapEnvelope: string,
  environment: '1' | '2' = '2'
): Promise<DianResponse> {
  const endpoint = ENDPOINTS[environment]

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/soap+xml;charset=UTF-8;action="http://wcf.dian.colombia/IWcfDianCustomerServices/SendBillSync"',
      'Accept': 'application/soap+xml',
    },
    body: soapEnvelope,
  })

  const raw = await response.text()

  if (!response.ok && !raw.includes('IsValid')) {
    throw new Error(`DIAN HTTP ${response.status}: ${raw.slice(0, 500)}`)
  }

  return parseDianResponse(raw)
}

// Escapa metacaracteres antes de incrustar un string en una RegExp. Prefiere el
// RegExp.escape nativo (Node 24) y cae a la versión manual si no está disponible.
const reEsc = (s: string): string => {
  const fn = (RegExp as unknown as { escape?: (s: string) => string }).escape
  return fn ? fn(s) : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractTag(xml: string, tag: string): string {
  const t = reEsc(tag)
  const patterns = [
    new RegExp(`<[^>]*:${t}[^>]*>([\\s\\S]*?)<\/[^>]*:${t}>`, 'i'),
    new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\/${t}>`, 'i'),
    new RegExp(`<b:${t}[^>]*>([\\s\\S]*?)<\/b:${t}>`, 'i'),
  ]
  for (const p of patterns) {
    const m = xml.match(p)
    if (m) return m[1].trim()
  }
  return ''
}

function parseDianResponse(raw: string): DianResponse {
  const isValidStr = extractTag(raw, 'IsValid')
  const isValid = isValidStr.toLowerCase() === 'true'
  const statusCode = extractTag(raw, 'StatusCode')
  const statusDescription = extractTag(raw, 'StatusDescription')
  const statusMessage = extractTag(raw, 'StatusMessage')
  const cufe = extractTag(raw, 'XmlDocumentKey')

  return { isValid, statusCode, statusDescription, statusMessage, cufe, raw }
}
