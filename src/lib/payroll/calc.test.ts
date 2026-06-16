import { describe, it, expect } from 'vitest'
import { calcDesprendible, type PayrollParams, type ContractInput } from './calc'

const P: PayrollParams = {
  smmlv: 1423500, transportAllowance: 200000,
  healthEmployer: 0.085, healthEmployee: 0.04, pensionEmployer: 0.12, pensionEmployee: 0.04,
  ccfRate: 0.04, icbfRate: 0.03, senaRate: 0.02,
  cesantiasRate: 0.0833, interesesCesantiasRate: 0.12, primaRate: 0.0833, vacacionesRate: 0.0417,
  ibcMinSmmlv: 1, ibcMaxSmmlv: 25, transportMaxSmmlv: 2, exonerationThresholdSmmlv: 10, fspMinSmmlv: 4,
  fspBrackets: [{ from: 4, to: 16, rate: 0.01 }, { from: 16, to: 9999, rate: 0.02 }],
  arlRates: { I: 0.00522, II: 0.01044, III: 0.02436, IV: 0.0435, V: 0.0696 },
  exonerationEligible: false,
}

const minimo: ContractInput = { baseSalary: 1423500, salaryType: 'ordinario', arlRisk: 'III', hasTransport: true }

describe('calcDesprendible — salario mínimo 2025, mes completo', () => {
  const d = calcDesprendible(minimo, P, { workedDays: 30 })

  it('devengado = salario + auxilio de transporte', () => {
    expect(d.salaryEarned).toBe(1423500)
    expect(d.transport).toBe(200000)
    expect(d.totalDevengado).toBe(1623500)
  })

  it('deducciones: salud 4% + pensión 4%, sin FSP (IBC < 4 SMMLV)', () => {
    expect(d.healthEmployee).toBe(56940)
    expect(d.pensionEmployee).toBe(56940)
    expect(d.fsp).toBe(0)
    expect(d.totalDeducciones).toBe(113880)
    expect(d.netoPagar).toBe(1509620)
  })

  it('sin exoneración, paga aportes patronales completos', () => {
    expect(d.exonerated).toBe(false)
    expect(d.pensionEmployer).toBe(170820) // 12%
    expect(d.ccf).toBe(56940) // 4%
  })
})

describe('exoneración art. 114-1 (empresa elegible, salario < 10 SMMLV)', () => {
  const d = calcDesprendible(minimo, { ...P, exonerationEligible: true }, { workedDays: 30 })

  it('exonera salud patronal, ICBF y SENA (no pensión ni caja)', () => {
    expect(d.exonerated).toBe(true)
    expect(d.healthEmployer).toBe(0)
    expect(d.icbf).toBe(0)
    expect(d.sena).toBe(0)
    expect(d.pensionEmployer).toBe(170820)
    expect(d.ccf).toBe(56940)
  })
})

describe('media jornada (15 días) escala proporcionalmente', () => {
  it('salario y transporte se reducen a la mitad', () => {
    const d = calcDesprendible(minimo, P, { workedDays: 15 })
    expect(d.salaryEarned).toBe(711750)
    expect(d.transport).toBe(100000)
  })
})
