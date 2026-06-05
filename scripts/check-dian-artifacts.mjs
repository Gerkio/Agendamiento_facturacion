/**
 * Preflight de cumplimiento DIAN: verifica que los artefactos oficiales existan
 * localmente (directriz #8). Falla (exit 1) si falta algún artefacto BLOQUEANTE.
 *
 *   node scripts/check-dian-artifacts.mjs
 */
import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { styleText } from 'node:util'

const ROOT = process.cwd()

// [etiqueta, ruta, ¿bloqueante para producción?, validador opcional]
const CHECKS = [
  ['Anexo Técnico 1.9 (PDF)', 'dian/anexo-1.9', true, hasPdf],
  ['Resolución 000165/2023', 'dian/resoluciones', false, hasAny],
  ['XSD oficiales DIAN (maindoc)', 'dian/xsd/maindoc', true, hasXsd],
  ['Catálogos / tablas', 'dian/catalogos', false, hasAny],
  ['Ejemplos XML oficiales', 'dian/ejemplos-xml', false, hasXml],
  ['WSDL Web Services DIAN', 'dian/wsdl', true, hasAny],
  ['Ejemplos SOAP / WSS', 'dian/soap', false, hasAny],
  ['Tablas referenciadas', 'dian/tablas-referenciadas', false, hasAny],
  ['UBL Invoice XSD (DIAN)', 'dian/xsd/maindoc/UBL-Invoice-2.1.xsd', true, existsFile],
  ['DianExtensions XSD', 'dian/xsd/maindoc/DIAN_UBL_Structures.xsd', true, existsFile],
  ['XAdES XSD', 'dian/xsd/common/UBL-XAdESv132-2.1.xsd', true, existsFile],
  ['xmldsig core XSD', 'dian/xsd/common/UBL-xmldsig-core-schema-2.1.xsd', true, existsFile],
  ['Schematron compilado (SEF)', 'dian/schematron/dian-structure-validator.sef.json', false, existsFile],
]

function existsFile(p) { return existsSync(join(ROOT, p)) }
function listFiles(p) {
  const abs = join(ROOT, p)
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return []
  return readdirSync(abs).filter(f => f !== '.gitkeep')
}
function hasAny(p) { return listFiles(p).length > 0 }
function hasPdf(p) { return listFiles(p).some(f => f.toLowerCase().endsWith('.pdf')) }
function hasXsd(p) { return listFiles(p).some(f => f.toLowerCase().endsWith('.xsd')) }
function hasXml(p) { return listFiles(p).some(f => f.toLowerCase().endsWith('.xml')) }

let missingBlocking = 0
const rows = CHECKS.map(([label, path, blocking, fn]) => {
  const ok = fn(path)
  if (!ok && blocking) missingBlocking++
  return { label, ok, blocking }
})

console.log('\n  Preflight de artefactos DIAN (Anexo 1.9)\n  ' + '─'.repeat(56))
for (const r of rows) {
  const icon = r.ok ? '✅' : (r.blocking ? '⛔' : '⬜')
  const tag = r.ok ? styleText('green', 'presente') : (r.blocking ? styleText('red', 'FALTA (bloqueante)') : styleText('dim', 'pendiente'))
  console.log(`  ${icon}  ${r.label.padEnd(38)} ${tag}`)
}
console.log('  ' + '─'.repeat(56))

if (missingBlocking > 0) {
  console.log(styleText('red', `\n  ${missingBlocking} artefacto(s) BLOQUEANTE(S) faltante(s).`) + ' Descárgalos de la')
  console.log('  Caja de Herramientas 1.9 y colócalos según dian/README.md.\n')
  process.exit(1)
} else {
  console.log(styleText('green', '\n  Todos los artefactos bloqueantes están presentes. ✅\n'))
}
