/**
 * Alineación del xml-generator contra el Schematron oficial DIAN.
 * Genera una factura con el generador REAL, la firma con un cert efímero, y la
 * valida con el Schematron → lista de reglas fallidas para corregir el generador.
 *
 *   node --conditions=react-server scripts/align-generator.mjs
 */
import { execFileSync } from 'node:child_process'
import { styleText } from 'node:util'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Encuentra openssl en el PATH o en las rutas típicas de Git para Windows. */
function opensslBin() {
  const candidates = [
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
    'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
  ]
  try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); return 'openssl' } catch {}
  for (const c of candidates) if (existsSync(c)) return c
  throw new Error('No se encontró openssl. Instálalo, o ejecuta este script desde "Git Bash" (incluye openssl).')
}
const OPENSSL = opensslBin()

// Variables de empresa/resolución (valores de prueba conformes en formato)
Object.assign(process.env, {
  COMPANY_NIT: '900123456', COMPANY_DV: '8', COMPANY_NAME: 'Empresa de Aseo SAS',
  COMPANY_ADDRESS: 'Cra 7 71 21', COMPANY_CITY_CODE: '11001', COMPANY_EMAIL: 'fe@empresa.com',
  COMPANY_PHONE: '6011112233', COMPANY_TAX_SCHEME: '01', COMPANY_FISCAL_REGIMEN: 'O-13',
  INVOICE_PREFIX: 'SETP', INVOICE_RESOLUTION_NUMBER: '18760000001', INVOICE_RESOLUTION_DATE: '2024-01-01',
  INVOICE_FROM_NUMBER: '1', INVOICE_TO_NUMBER: '5000',
  DIAN_SOFTWARE_ID: '00000000-0000-0000-0000-000000000000', DIAN_SOFTWARE_PIN: '12345',
  DIAN_TECHNICAL_KEY: 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c', DIAN_ENVIRONMENT: '2',
})

const { generateInvoiceXML } = await import('../src/lib/dian/xml-generator.ts')
const { calculateCUFE } = await import('../src/lib/dian/cufe-calculator.ts')
const { signXML } = await import('../src/lib/dian/xml-signer.ts')
const { validateBusinessRules } = await import('../src/lib/dian/schematron-validator.ts')
const { validateInvoiceXsd } = await import('../src/lib/dian/xsd-validator.ts')

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
const invoiceNumber = 'SETP1'
const cufe = calculateCUFE({
  invoiceNumber, issueDate: now, taxableBase, taxAmount01: taxAmount, taxAmount04: 0, taxAmount03: 0,
  totalAmount, supplierNit: '900123456', customerDoc: client.nit_cedula, technicalKey: process.env.DIAN_TECHNICAL_KEY, environment: '2',
})
const xml = generateInvoiceXML({ invoiceNumber, issueDate: now, client, services, totalAmount, taxAmount, taxableBase, taxRate: 0, cufe, environment: '2' })

// Cert efímero para firmar
const dir = mkdtempSync(join(tmpdir(), 'cs-'))
execFileSync(OPENSSL, ['req','-x509','-newkey','rsa:2048','-keyout',join(dir,'k.pem'),'-out',join(dir,'c.pem'),'-days','30','-nodes','-subj','/CN=Test/O=Demo/C=CO'], { stdio:['ignore','pipe','pipe'] })
const certPem = readFileSync(join(dir,'c.pem'),'utf8')
const cert = {
  privateKeyPem: readFileSync(join(dir,'k.pem'),'utf8'), certPem,
  certDer: Buffer.from(certPem.replace(/-----[^-]+-----/g,'').replace(/\s/g,''),'base64'),
}
const signed = signXML(xml, cert)
rmSync(dir, { recursive: true, force: true })

// XSD
const xsd = await validateInvoiceXsd(signed)
console.log('\n=== XSD (UBL 2.1 DIAN) ===')
console.log('válido:', xsd.valid ? styleText('green', 'true') : styleText('red', 'false'))
if (!xsd.valid) xsd.errors.slice(0,8).forEach(e => console.log('  •', styleText('red', e)))

// Schematron
const sch = await validateBusinessRules(signed)
console.log('\n=== Schematron (reglas de negocio) ===')
console.log('VÁLIDO:', sch.valid ? styleText('green', 'true') : styleText('red', 'false'), '| relevantes:', sch.findings.length, '| ignoradas (reglas obsoletas):', sch.ignored.length)
for (const f of sch.findings) console.log(styleText('red', `  ❌ [${f.id}] ${f.text}`))
for (const f of sch.ignored) console.log(styleText('dim', `  ⚪ [${f.id}] (regla obsoleta de la Caja, ignorada)`))
