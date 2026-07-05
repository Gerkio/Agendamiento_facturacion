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
