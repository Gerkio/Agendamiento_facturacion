import { describe, it, expect } from 'vitest'
import { computeTax } from './tax'

describe('computeTax', () => {
  it('aplica IVA 19% sobre la base', () => {
    const r = computeTax([1000000], 19)
    expect(r.taxableBase).toBe(1000000)
    expect(r.taxAmount).toBe(190000)
    expect(r.total).toBe(1190000)
  })

  it('rate 0 = exento (total = base)', () => {
    const r = computeTax([1000000, 500000], 0)
    expect(r.taxAmount).toBe(0)
    expect(r.total).toBe(1500000)
  })
})
