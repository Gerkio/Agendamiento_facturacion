import { createHash } from 'crypto'

function pad2(n: number) { return String(n).padStart(2, '0') }

/**
 * CUDE — Código Único de Documento Electrónico (notas crédito/débito).
 * Idéntico al CUFE (Anexo Técnico 1.9) salvo que el penúltimo campo es el
 * PIN del software (PINSW) en lugar de la clave técnica de la resolución.
 *
 * ⚠️ VERIFICAR contra un vector oficial del Anexo 1.9 antes de producción,
 * igual que se verificó el CUFE. La fórmula aquí sigue el Anexo, pero no se ha
 * comprobado en esta sesión contra una nota crédito real aceptada.
 */
export interface CudeInput {
  noteNumber: string      // NumNC
  issueDate: Date         // FecNC + HorNC
  taxableBase: number     // ValNC (base antes de impuestos)
  taxAmount01: number     // ValImp1 (IVA 01)
  taxAmount04: number     // ValImp2 (ICA 04)
  taxAmount03: number     // ValImp3 (consumo 03)
  totalAmount: number     // ValTotNC
  supplierNit: string     // NitOfe
  customerDoc: string     // DocAdq
  softwarePin: string     // PINSW (PIN del software, NO la clave técnica)
  environment: '1' | '2' // TipoAmb
}

export function calculateCUDE(input: CudeInput): string {
  // FecNC/HorNC en hora legal de Colombia (UTC-5), igual que el CUFE.
  const d = new Date(input.issueDate.getTime() - 5 * 3600_000)
  const FecNC = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
  const HorNC = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}-05:00`

  // Decimales TRUNCADOS a 2 (no redondeados), igual que el CUFE.
  const fmt = (n: number) => (Math.floor(Math.abs(n) * 100 + 1e-6) / 100 * Math.sign(n || 1)).toFixed(2)

  // NumNC+FecNC+HorNC+ValNC+CodImp1+ValImp1+CodImp2+ValImp2+CodImp3+ValImp3+ValTotNC+NitOFE+NumAdq+PINSW+TipoAmbiente
  const chain = [
    input.noteNumber,
    FecNC,
    HorNC,
    fmt(input.taxableBase),
    '01', fmt(input.taxAmount01),
    '04', fmt(input.taxAmount04),
    '03', fmt(input.taxAmount03),
    fmt(input.totalAmount),
    input.supplierNit,
    input.customerDoc,
    input.softwarePin,
    input.environment,
  ].join('')

  return createHash('sha384').update(chain, 'utf8').digest('hex')
}
