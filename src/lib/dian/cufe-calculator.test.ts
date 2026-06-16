import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { calculateCUFE } from './cufe-calculator'

const fmt = (n: number) => (Math.floor(Math.abs(n) * 100 + 1e-6) / 100 * Math.sign(n || 1)).toFixed(2)
const cufeWith = (fec: string, hor: string) =>
  createHash('sha384').update(
    ['SETP990000001', fec, hor, fmt(100000), '01', fmt(0), '04', fmt(0), '03', fmt(0), fmt(100000), '900123456', '8001234567', 'CLAVE_TEC', '2'].join(''),
    'utf8',
  ).digest('hex')

// 2026-06-16T03:00:00Z = 2026-06-15 22:00:00 en Colombia (cruza medianoche).
const input = {
  invoiceNumber: 'SETP990000001',
  issueDate: new Date('2026-06-16T03:00:00Z'),
  taxableBase: 100000, taxAmount01: 0, taxAmount04: 0, taxAmount03: 0, totalAmount: 100000,
  supplierNit: '900123456', customerDoc: '8001234567', technicalKey: 'CLAVE_TEC', environment: '2' as const,
}

describe('calculateCUFE — sello en hora legal de Colombia (UTC-5)', () => {
  it('usa la fecha/hora colombiana, no la del servidor UTC', () => {
    expect(calculateCUFE(input)).toBe(cufeWith('2026-06-15', '22:00:00-05:00'))
  })

  it('regresión: NO usa los componentes UTC (bug de zona horaria)', () => {
    expect(calculateCUFE(input)).not.toBe(cufeWith('2026-06-16', '03:00:00-05:00'))
  })
})
