import { createHash } from 'crypto'

function pad2(n: number) { return String(n).padStart(2, '0') }

export interface CufeInput {
  invoiceNumber: string   // NumFac
  issueDate: Date         // FecFac + HorFac
  taxableBase: number     // ValFac (base antes de impuestos)
  taxAmount01: number     // ValImp1 (IVA 01)
  taxAmount04: number     // ValImp2 (ICA 04)
  taxAmount03: number     // ValImp3 (consumo 03)
  totalAmount: number     // ValTot
  supplierNit: string     // NitOfe
  customerDoc: string     // DocAdq
  technicalKey: string    // ClvTec (clave técnica de la resolución)
  environment: '1' | '2' // TipoAmb
}

export function calculateCUFE(input: CufeInput): string {
  // FecFac/HorFac en hora LEGAL de Colombia (UTC-5). Se desplaza el instante −5h y se
  // leen los componentes UTC, de modo que el sello sea correcto aunque el servidor
  // corra en UTC (Vercel). Esta marca entra al hash, así que el XML usa la misma.
  const d = new Date(input.issueDate.getTime() - 5 * 3600_000)
  const FecFac = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
  const HorFac = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}-05:00`

  // Anexo Técnico 1.9 (§11.2): decimales TRUNCADOS a 2 dígitos (NO redondeados),
  // punto decimal, sin separador de miles ni símbolo. El +1e-6 evita el error de
  // coma flotante (p.ej. 1785000.00*100 → 178499999.9999) sin alterar el truncado.
  const fmt = (n: number) => (Math.floor(Math.abs(n) * 100 + 1e-6) / 100 * Math.sign(n || 1)).toFixed(2)

  // Concatenación exacta del Anexo 1.9 §11.2 — sin espacios:
  // NumFac+FecFac+HorFac+ValFac+CodImp1+ValImp1+CodImp2+ValImp2+CodImp3+ValImp3+ValTot+NitOFE+NumAdq+ClTec+TipoAmbiente
  const chain = [
    input.invoiceNumber,  // NumFac
    FecFac,               // FecFac
    HorFac,               // HorFac
    fmt(input.taxableBase), // ValFac
    '01',                 // CodImp1
    fmt(input.taxAmount01), // ValImp1
    '04',                 // CodImp2
    fmt(input.taxAmount04), // ValImp2
    '03',                 // CodImp3
    fmt(input.taxAmount03), // ValImp3
    fmt(input.totalAmount), // ValTot
    input.supplierNit,    // NitOfe
    input.customerDoc,    // DocAdq
    input.technicalKey,   // ClvTec
    input.environment,    // TipoAmb
  ].join('')

  return createHash('sha384').update(chain, 'utf8').digest('hex')
}
