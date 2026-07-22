import { describe, it, expect } from 'vitest'
import { calcSettlement, dias360, diasFaltantes, type SettlementContract } from './settlement'

const base: SettlementContract = {
  baseSalary: 1423500,
  salaryType: 'ordinario',
  contractType: 'indefinido',
  transportAllowance: 200000,
  smmlv: 1423500,
  interesesCesantiasRate: 0.12,
}

describe('dias360 (30E/360, extremos incluidos)', () => {
  it('mes completo = 30 días', () => {
    expect(dias360('2025-03-01', '2025-03-30')).toBe(30)
  })
  it('año completo = 360 días', () => {
    expect(dias360('2024-01-01', '2024-12-31')).toBe(360)
  })
  it('diasFaltantes excluye el día ya trabajado', () => {
    expect(diasFaltantes('2025-01-31', '2025-06-30')).toBe(150)
  })
})

describe('liquidación ordinario, 1 año exacto, despido sin justa causa', () => {
  const s = calcSettlement(base, {
    cesantiasFrom: '2024-01-01',
    primaFrom: '2024-07-01',
    vacacionesFrom: '2024-01-01',
    terminationDate: '2024-12-31',
    cause: 'sin_justa_causa',
  })

  it('cesantías = (salario + transporte) por 1 año', () => {
    expect(s.baseCesantias).toBe(1623500)
    expect(s.diasCesantias).toBe(360)
    expect(s.cesantias).toBe(1623500)
  })
  it('intereses a las cesantías = 12%', () => {
    expect(s.intereses).toBe(194820)
  })
  it('prima del semestre (jul-dic) = 180 días', () => {
    expect(s.diasPrima).toBe(180)
    expect(s.prima).toBe(811750)
  })
  it('vacaciones = salario (sin transporte) por días/720', () => {
    expect(s.diasVacaciones).toBe(360)
    expect(s.vacaciones).toBe(711750)
  })
  it('indemnización indefinido <10 SMMLV, 1 año = 30 días de salario', () => {
    expect(s.indemnizacion).toBe(1423500) // 47450/día * 30
    expect(s.total).toBe(1623500 + 194820 + 811750 + 711750 + 1423500)
  })
})

describe('salario integral: no cesantías/intereses/prima; sí vacaciones', () => {
  const s = calcSettlement({ ...base, salaryType: 'integral' }, {
    cesantiasFrom: '2024-01-01', primaFrom: '2024-07-01', vacacionesFrom: '2024-01-01',
    terminationDate: '2024-12-31', cause: 'renuncia',
  })
  it('cesantías/intereses/prima en 0', () => {
    expect(s.cesantias).toBe(0)
    expect(s.intereses).toBe(0)
    expect(s.prima).toBe(0)
  })
  it('vacaciones sobre el salario integral', () => {
    expect(s.vacaciones).toBe(711750)
  })
})

describe('indemnización por tipo de contrato', () => {
  it('término fijo: salarios del tiempo faltante', () => {
    const s = calcSettlement({ ...base, contractType: 'fijo' }, {
      cesantiasFrom: '2025-01-01', primaFrom: '2025-01-01', vacacionesFrom: '2025-01-01',
      terminationDate: '2025-01-31', contractEnd: '2025-06-30', cause: 'sin_justa_causa',
    })
    expect(s.indemnizacion).toBe(Math.round(1423500 / 30 * 150)) // 150 días faltantes
  })
  it('obra o labor: mínimo 15 días', () => {
    const s = calcSettlement({ ...base, contractType: 'obra_labor' }, {
      cesantiasFrom: '2025-01-01', primaFrom: '2025-01-01', vacacionesFrom: '2025-01-01',
      terminationDate: '2025-01-20', contractEnd: '2025-01-25', cause: 'sin_justa_causa',
    })
    expect(s.indemnizacion).toBe(Math.round(1423500 / 30 * 15))
  })
  it('indefinido ≥10 SMMLV, 2 años = 20 + 15 = 35 días', () => {
    const s = calcSettlement({ ...base, baseSalary: 15000000 }, {
      cesantiasFrom: '2023-01-01', primaFrom: '2024-07-01', vacacionesFrom: '2023-01-01',
      terminationDate: '2024-12-31', cause: 'sin_justa_causa',
    })
    // diasTotal = 720 → 20 + 15*((720-360)/360) = 35; salarioDiario = 500000
    expect(s.indemnizacion).toBe(17500000)
  })
  it('renuncia no genera indemnización', () => {
    const s = calcSettlement(base, {
      cesantiasFrom: '2024-01-01', primaFrom: '2024-07-01', vacacionesFrom: '2024-01-01',
      terminationDate: '2024-12-31', cause: 'renuncia',
    })
    expect(s.indemnizacion).toBe(0)
  })
})
