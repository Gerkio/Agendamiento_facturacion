import 'server-only'
import { readFileSync } from 'fs'
import { join } from 'path'
// @ts-expect-error saxon-js no trae tipos
import SaxonJS from 'saxon-js'

/**
 * Validación de REGLAS DE NEGOCIO (capa 2) con el Schematron OFICIAL de la DIAN
 * (`DIAN-UBL21-model.sch` + estructuras UBL21). Compilado offline con Java Saxon a
 * un SEF que SaxonJS ejecuta en runtime (portable a serverless).
 *
 * Alcance actual: reglas ESTRUCTURALES (totales, CUFE, campos obligatorios, formatos).
 * NO incluye `listacodigos` (validación de pertenencia a catálogos), que se compila
 * aparte por su tamaño. Ver dian/README.md.
 */

interface SefBundle {
  stylesheetInternal: unknown
}

let sef: SefBundle | null = null

function loadSef(): SefBundle {
  if (sef) return sef
  const p = join(process.cwd(), 'dian', 'schematron', 'dian-structure-validator.sef.json')
  sef = { stylesheetInternal: JSON.parse(readFileSync(p, 'utf8')) }
  return sef
}

export interface SchematronFinding {
  id: string          // código de regla, p.ej. "AA07"
  text: string        // mensaje de la DIAN
  location: string    // XPath del nodo que falló
}

export interface SchematronResult {
  valid: boolean                  // true si no hay fallos fuera del allowlist
  findings: SchematronFinding[]   // fallos relevantes (a corregir)
  ignored: SchematronFinding[]    // fallos de reglas obsoletas/inconsistentes conocidas
}

/**
 * Reglas del Schematron de la Caja 1.9 INCONSISTENTES con el XSD/Anexo oficiales
 * (los propios ejemplos oficiales de la DIAN las fallan). Verificado contra el XSD:
 *  - DA24: exige <sts:SoftwareIDs> (plural); el XSD oficial define <SoftwareID> (singular).
 *  - AA07: exige ProfileID = 'DIAN 2.0'; el Anexo 1.9 exige 'DIAN 2.1: Factura Electrónica de Venta'.
 * Se pueden añadir más vía DIAN_SCHEMATRON_IGNORE (coma-separado).
 */
function ignoredRuleIds(): Set<string> {
  const base = ['DA24', 'AA07']
  const extra = (process.env.DIAN_SCHEMATRON_IGNORE ?? '').split(',').map(s => s.trim()).filter(Boolean)
  return new Set([...base, ...extra])
}

/** Ejecuta el Schematron sobre un XML de factura y devuelve las aserciones fallidas. */
export async function validateBusinessRules(xml: string): Promise<SchematronResult> {
  const { stylesheetInternal } = loadSef()
  const out = await SaxonJS.transform(
    { stylesheetInternal, sourceText: xml, destination: 'serialized' },
    'async'
  )
  const svrl: string = out.principalResult ?? ''
  const all = parseSvrl(svrl)
  const ignore = ignoredRuleIds()
  const findings = all.filter(f => !ignore.has(f.id))
  const ignored = all.filter(f => ignore.has(f.id))
  return { valid: findings.length === 0, findings, ignored }
}

/** Extrae las aserciones fallidas del reporte SVRL. */
function parseSvrl(svrl: string): SchematronFinding[] {
  const findings: SchematronFinding[] = []
  const re = /<svrl:failed-assert\b[^>]*?(?:\blocation="([^"]*)")?[^>]*>[\s\S]*?<svrl:text>([\s\S]*?)<\/svrl:text>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(svrl)) !== null) {
    const location = m[1] ?? ''
    const text = m[2].replace(/\s+/g, ' ').trim()
    const idMatch = text.match(/^\[([^\]]+)\]/)
    findings.push({ id: idMatch ? idMatch[1] : '', text, location })
  }
  return findings
}
