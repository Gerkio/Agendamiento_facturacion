/**
 * HTTP client for DIAN Web Services.
 * Sends the SOAP envelope and parses the XML response.
 */

import { DOMParser } from '@xmldom/xmldom'

export interface DianResponse {
  isValid: boolean
  statusCode: string
  statusDescription: string
  statusMessage: string
  cufe: string
  raw: string
}

/**
 * Error TÉCNICO/transitorio de transporte con la DIAN (red caída, SOAP Fault,
 * HTTP 5xx sin cuerpo de negocio). Es distinto de un RECHAZO de negocio (la DIAN
 * respondió con IsValid=false): un error técnico NO debe marcar la factura como
 * 'rejected' ni quemar el consecutivo — el documento puede reintentarse.
 */
export class DianTechnicalError extends Error {
  readonly httpStatus: number
  constructor(message: string, httpStatus = 0) {
    super(message)
    this.name = 'DianTechnicalError'
    this.httpStatus = httpStatus
  }
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

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml;charset=UTF-8;action="http://wcf.dian.colombia/IWcfDianCustomerServices/SendBillSync"',
        'Accept': 'application/soap+xml',
      },
      body: soapEnvelope,
    })
  } catch (e) {
    // Fallo de red/transporte: técnico, reintentable.
    throw new DianTechnicalError('No se pudo conectar con la DIAN: ' + (e instanceof Error ? e.message : 'error de red'))
  }

  const raw = await response.text()

  // SOAP Fault = error técnico del servicio, NO un rechazo de negocio del documento.
  if (/<(?:\w+:)?Fault[\s>]/i.test(raw) || /faultstring/i.test(raw)) {
    const reason = getElementText(raw, 'faultstring') || getElementText(raw, 'Text') || getElementText(raw, 'Reason')
    throw new DianTechnicalError('SOAP Fault de la DIAN: ' + (reason || `HTTP ${response.status}`), response.status)
  }

  // HTTP no-ok sin cuerpo de negocio válido = error de transporte (reintentable).
  if (!response.ok && !raw.includes('IsValid')) {
    throw new DianTechnicalError(`DIAN HTTP ${response.status}: ${raw.slice(0, 300)}`, response.status)
  }

  return parseDianResponse(raw)
}

function getElementText(xml: string, localName: string): string {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const nodes = doc.getElementsByTagName('*')
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes.item(i)
    if (node?.localName === localName) {
      return String(node.textContent ?? '').trim()
    }
  }
  return ''
}

function parseDianResponse(raw: string): DianResponse {
  const isValidStr = getElementText(raw, 'IsValid')
  const isValid = isValidStr.toLowerCase() === 'true'
  const statusCode = getElementText(raw, 'StatusCode')
  const statusDescription = getElementText(raw, 'StatusDescription')
  const statusMessage = getElementText(raw, 'StatusMessage')
  const cufe = getElementText(raw, 'XmlDocumentKey')

  return { isValid, statusCode, statusDescription, statusMessage, cufe, raw }
}
