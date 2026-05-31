/**
 * Compila el Schematron oficial DIAN a un validador ejecutable (SEF para SaxonJS).
 * Build-time (requiere Java + Saxon-HE 9.9 en tools/). El runtime NO necesita Java.
 *
 *   node scripts/build-schematron.mjs
 *
 * Pipeline ISO Schematron:
 *   entry-structure.sch --(dsdl_include)--> _s1 --(abstract_expand)--> _s2
 *     --(svrl_for_xslt2)--> dian-structure-validator.xsl --(SaxonJS export)--> .sef.json
 *
 * DEVIACIONES DOCUMENTADAS (directriz #10):
 *  - listacodigos EXCLUIDO: su expansión (miles de códigos) agota el heap; se valida aparte.
 *  - queryBinding xslt3 -> xslt2: el skeleton ISO no soporta xslt3; las reglas DIAN son XPath 2.0.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const SAXON = 'tools/Saxon-HE-9.9.jar'
const ISO = 'tools/iso-schematron'
const SCH = 'dian/schematron'

for (const f of [SAXON, `${ISO}/iso_dsdl_include.xsl`, `${ISO}/iso_abstract_expand.xsl`, `${ISO}/iso_svrl_for_xslt2.xsl`, `${SCH}/entry-structure.sch`]) {
  if (!existsSync(join(process.cwd(), f))) {
    console.error(`Falta: ${f}. Ver dian/README.md (requiere Saxon-HE 9.9 y esqueletos ISO en tools/).`)
    process.exit(1)
  }
}

const saxon = (xsl, src, out, extra = []) =>
  execFileSync('java', ['-Xmx2g', '-jar', SAXON, `-xsl:${xsl}`, `-s:${src}`, `-o:${out}`, ...extra],
    { stdio: ['ignore', 'inherit', 'inherit'] })

try {
  console.log('A) dsdl_include …')
  saxon(`${ISO}/iso_dsdl_include.xsl`, `${SCH}/entry-structure.sch`, `${SCH}/_s1.sch`)
  console.log('B) abstract_expand …')
  saxon(`${ISO}/iso_abstract_expand.xsl`, `${SCH}/_s1.sch`, `${SCH}/_s2.sch`)
  // El skeleton solo acepta xslt2:
  execFileSync('node', ['-e', `const fs=require('fs');const p='${SCH}/_s2.sch';fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('queryBinding="xslt3"','queryBinding="xslt2"'))`])
  console.log('C) svrl_for_xslt2 …')
  saxon(`${ISO}/iso_svrl_for_xslt2.xsl`, `${SCH}/_s2.sch`, `${SCH}/dian-structure-validator.xsl`)
  console.log('D) export SEF (SaxonJS) …')
  execFileSync('npx', ['xslt3', `-xsl:${SCH}/dian-structure-validator.xsl`, `-export:${SCH}/dian-structure-validator.sef.json`, '-nogo'],
    { stdio: ['ignore', 'inherit', 'inherit'], shell: process.platform === 'win32' })
  execFileSync('node', ['-e', `require('fs').rmSync('${SCH}/_s1.sch');require('fs').rmSync('${SCH}/_s2.sch')`])
  console.log('\n✅ Schematron compilado: dian/schematron/dian-structure-validator.sef.json')
} catch (e) {
  console.error('\n❌ Falló la compilación:', e.message)
  process.exit(1)
}
