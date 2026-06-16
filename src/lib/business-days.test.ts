import { describe, it, expect } from 'vitest'
import { isBusinessDay, addBusinessDays, businessDaysBetween } from './business-days'

describe('business-days — festivos de Colombia (Ley 51/1983 + Emiliani)', () => {
  it('Año Nuevo y Navidad no son hábiles', () => {
    expect(isBusinessDay('2025-01-01')).toBe(false)
    expect(isBusinessDay('2025-12-25')).toBe(false)
  })

  it('Viernes Santo 2025 (18-abr) no es hábil', () => {
    expect(isBusinessDay('2025-04-18')).toBe(false)
  })

  it('Reyes Magos (Emiliani): el lunes 6-ene-2025 es festivo', () => {
    expect(isBusinessDay('2025-01-06')).toBe(false)
  })

  it('un miércoles ordinario sí es hábil', () => {
    expect(isBusinessDay('2025-06-18')).toBe(true)
  })

  it('addBusinessDays salta fin de semana y festivo: 24-dic-2025 + 1 = 26-dic (25 es Navidad)', () => {
    expect(addBusinessDays('2025-12-24', 1)).toBe('2025-12-26')
  })

  it('businessDaysBetween cuenta solo días hábiles', () => {
    expect(businessDaysBetween('2025-07-07', '2025-07-10')).toBe(3) // 8, 9, 10
  })
})
