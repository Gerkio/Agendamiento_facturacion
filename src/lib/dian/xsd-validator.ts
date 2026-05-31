import 'server-only'
import { validateXML } from 'xmllint-wasm'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

/**
 * Validación estructural XSD previa al envío (directriz #5).
 *
 * Usa el set XSD OFICIAL de la DIAN (Caja de Herramientas 1.9) en `dian/xsd/`,
 * verificado contra los ejemplos firmados oficiales. Valida la envoltura UBL 2.1
 * (orden, cardinalidad, tipos) con las restricciones propias de la DIAN, tanto
 * para Factura (UBL-Invoice) como para Nota Crédito (UBL-CreditNote).
 */

let commonCache: { fileName: string; contents: string }[] | null = null
const mainCache: Record<string, string> = {}

function xsdRoot() { return join(process.cwd(), 'dian', 'xsd') }

function loadCommon(): { fileName: string; contents: string }[] {
  if (commonCache) return commonCache
  commonCache = readdirSync(join(xsdRoot(), 'common'))
    .filter(f => f.endsWith('.xsd'))
    .map(f => ({ fileName: f, contents: readFileSync(join(xsdRoot(), 'common', f), 'utf8') }))
  return commonCache
}

function loadMain(fileName: string): string {
  if (mainCache[fileName]) return mainCache[fileName]
  // xmllint-wasm usa un FS plano: se quita el prefijo ../common/ del maindoc.
  mainCache[fileName] = readFileSync(join(xsdRoot(), 'maindoc', fileName), 'utf8').replace(/\.\.\/common\//g, '')
  return mainCache[fileName]
}

export interface XsdResult {
  valid: boolean
  errors: string[]
}

async function validateAgainst(xml: string, mainFile: string): Promise<XsdResult> {
  const main = loadMain(mainFile)
  const res = await validateXML({
    xml: [{ fileName: 'doc.xml', contents: xml }],
    schema: [{ fileName: mainFile, contents: main }],
    preload: loadCommon(),
  })
  const errors = (res.errors ?? []).map(e =>
    typeof e === 'string' ? e : (e as { message?: string }).message ?? JSON.stringify(e)
  )
  return { valid: res.valid, errors }
}

/** Valida un XML de factura contra el esquema OASIS UBL 2.1 (Invoice). */
export function validateInvoiceXsd(xml: string): Promise<XsdResult> {
  return validateAgainst(xml, 'UBL-Invoice-2.1.xsd')
}

/** Valida un XML de nota crédito contra el esquema OASIS UBL 2.1 (CreditNote). */
export function validateCreditNoteXsd(xml: string): Promise<XsdResult> {
  return validateAgainst(xml, 'UBL-CreditNote-2.1.xsd')
}
