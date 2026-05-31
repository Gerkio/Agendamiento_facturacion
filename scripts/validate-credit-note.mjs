/**
 * Valida el generador de NOTA CRÉDITO contra el XSD oficial (UBL-CreditNote-2.1)
 * y el Schematron oficial de la DIAN. Genera una NC con el generador REAL, la
 * firma con un cert efímero, y reporta cualquier regla incumplida.
 *
 *   node --conditions=react-server scripts/validate-credit-note.mjs
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function opensslBin() {
  const candidates = [
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
    'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
  ]
  try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); return 'openssl' } catch {}
  for (const c of candidates) if (existsSync(c)) return c
  throw new Error('No se encontró openssl. Ejecuta desde "Git Bash".')
}
const OPENSSL = opensslBin()

Object.assign(process.env, {
  COMPANY_NIT: '900123456', COMPANY_DV: '8', COMPANY_NAME: 'Empresa de Aseo SAS',
  COMPANY_ADDRESS: 'Cra 7 71 21', COMPANY_CITY_CODE: '11001', COMPANY_EMAIL: 'fe@empresa.com',
  COMPANY_PHONE: '6011112233', COMPANY_TAX_SCHEME: '01', COMPANY_FISCAL_REGIMEN: 'O-13',
  INVOICE_PREFIX: 'SETP', DIAN_SOFTWARE_ID: '00000000-0000-0000-0000-000000000000',
  DIAN_SOFTWARE_PIN: '12345', DIAN_ENVIRONMENT: '2',
})

const { generateCreditNoteXML } = await import('../src/lib/dian/credit-note-generator.ts')
const { calculateCUDE } = await import('../src/lib/dian/cude-calculator.ts')
const { signXML } = await import('../src/lib/dian/xml-signer.ts')
const { validateBusinessRules } = await import('../src/lib/dian/schematron-validator.ts')
const { validateCreditNoteXsd } = await import('../src/lib/dian/xsd-validator.ts')

const now = new Date()
const client = {
  id: 'c1', company_name: 'Cliente Demo SAS', nit_cedula: '800199436', dv: '5',
  email: 'cliente@demo.com', phone: '6017654321', address: 'Cl 50 10 20',
  city_code: '11001', tax_scheme: '01', fiscal_regimen: 'R-99-PN', created_at: now.toISOString(),
}
const services = [{
  id: 's1', client_id: 'c1', cleaner_id: 'cl1', start_time: now.toISOString(), end_time: now.toISOString(),
  status: 'completed', is_recurring: false, recurrence_group_id: null, invoice_id: null,
  price_cop: 150000, created_at: now.toISOString(),
}]
const taxableBase = 150000, taxAmount = 0, totalAmount = 150000
const noteNumber = 'NC1'
const cude = calculateCUDE({
  noteNumber, issueDate: now, taxableBase, taxAmount01: taxAmount, taxAmount04: 0, taxAmount03: 0,
  totalAmount, supplierNit: '900123456', customerDoc: client.nit_cedula, softwarePin: process.env.DIAN_SOFTWARE_PIN, environment: '2',
})
const xml = generateCreditNoteXML({
  noteNumber, issueDate: now, client, services, totalAmount, taxAmount, taxableBase, taxRate: 0, cude, environment: '2',
  original: { number: 'SETP1', cufe: 'a'.repeat(96), issueDate: '2024-06-01' },
  concept: { code: '2', description: 'Anulación de factura electrónica' },
})

const dir = mkdtempSync(join(tmpdir(), 'cs-'))
execFileSync(OPENSSL, ['req','-x509','-newkey','rsa:2048','-keyout',join(dir,'k.pem'),'-out',join(dir,'c.pem'),'-days','30','-nodes','-subj','/CN=Test/O=Demo/C=CO'], { stdio:['ignore','pipe','pipe'] })
const certPem = readFileSync(join(dir,'c.pem'),'utf8')
const cert = {
  privateKeyPem: readFileSync(join(dir,'k.pem'),'utf8'), certPem,
  certDer: Buffer.from(certPem.replace(/-----[^-]+-----/g,'').replace(/\s/g,''),'base64'),
}
const signed = signXML(xml, cert)
rmSync(dir, { recursive: true, force: true })

const xsd = await validateCreditNoteXsd(signed)
console.log('\n=== XSD (UBL-CreditNote-2.1 DIAN) ===')
console.log('válido:', xsd.valid)
if (!xsd.valid) xsd.errors.slice(0,12).forEach(e => console.log('  •', e))

const sch = await validateBusinessRules(signed)
console.log('\n=== Schematron (reglas de negocio) ===')
console.log('VÁLIDO:', sch.valid, '| relevantes:', sch.findings.length, '| ignoradas:', sch.ignored.length)
for (const f of sch.findings) console.log(`  ❌ [${f.id}] ${f.text}`)
for (const f of sch.ignored) console.log(`  ⚪ [${f.id}] (ignorada)`)
