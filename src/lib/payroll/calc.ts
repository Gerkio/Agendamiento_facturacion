/** Motor de cálculo de nómina (Colombia). Función PURA, sin IO, testeable.
 *  Todas las tasas y topes vienen de payroll_parameters (configurables por el
 *  contador) — aquí no hay cifras legales hardcodeadas. Convención de 30 días/mes.
 *
 *  ⚠️ Las cifras y reglas (SMMLV, FSP, ARL, exoneración art. 114-1, provisiones)
 *  deben validarse con el contador antes de liquidar en producción. */

export interface PayrollParams {
  smmlv: number
  transportAllowance: number
  healthEmployer: number
  healthEmployee: number
  pensionEmployer: number
  pensionEmployee: number
  ccfRate: number
  icbfRate: number
  senaRate: number
  cesantiasRate: number
  interesesCesantiasRate: number
  primaRate: number
  vacacionesRate: number
  ibcMinSmmlv: number
  ibcMaxSmmlv: number
  transportMaxSmmlv: number
  exonerationThresholdSmmlv: number
  fspMinSmmlv: number
  fspBrackets: { from: number; to: number; rate: number }[]
  arlRates: Record<string, number>
  exonerationEligible: boolean
}

export interface ContractInput {
  baseSalary: number
  salaryType: 'ordinario' | 'integral'
  arlRisk: string
  hasTransport: boolean
}

export interface PeriodInput {
  /** Días del periodo a liquidar (0..30). */
  workedDays: number
  extraDevengadoSalarial?: number
  extraDevengadoNoSalarial?: number
  extraDeduccion?: number
}

export interface Desprendible {
  ibc: number
  salaryEarned: number
  transport: number
  totalDevengado: number
  healthEmployee: number
  pensionEmployee: number
  fsp: number
  totalDeducciones: number
  netoPagar: number
  exonerated: boolean
  healthEmployer: number
  pensionEmployer: number
  arl: number
  ccf: number
  icbf: number
  sena: number
  totalAportes: number
  provCesantias: number
  provIntereses: number
  provPrima: number
  provVacaciones: number
  totalProvisiones: number
  costoEmpleador: number
}

const r = (n: number) => Math.round(n)
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** Tasa del Fondo de Solidaridad Pensional según el IBC (en SMMLV). */
export function fspRate(ibc: number, p: PayrollParams): number {
  const n = ibc / p.smmlv
  for (const b of p.fspBrackets) if (n >= b.from && n <= b.to) return b.rate
  return 0
}

/** Calcula el desprendible de un auxiliar para un periodo. */
export function calcDesprendible(c: ContractInput, p: PayrollParams, n: PeriodInput): Desprendible {
  const days = clamp(n.workedDays, 0, 30)
  const factor = days / 30
  const extraSalarial = n.extraDevengadoSalarial ?? 0
  const extraNoSalarial = n.extraDevengadoNoSalarial ?? 0
  const extraDeduccion = n.extraDeduccion ?? 0

  // Devengado salarial proporcional a los días.
  const salaryEarned = r(c.baseSalary * factor)

  // IBC: salario que constituye base (integral = 70%), proporcional, con piso y techo.
  const ibcSalaryMonthly = c.salaryType === 'integral' ? c.baseSalary * 0.70 : c.baseSalary
  const ibc = clamp(
    r((ibcSalaryMonthly + extraSalarial) * factor),
    r(p.smmlv * p.ibcMinSmmlv * factor),
    r(p.smmlv * p.ibcMaxSmmlv),
  )

  // Auxilio de transporte: NO entra al IBC; solo si gana ≤ tope y es salario ordinario.
  const transport = (c.hasTransport && c.salaryType === 'ordinario' && c.baseSalary <= p.transportMaxSmmlv * p.smmlv)
    ? r(p.transportAllowance * factor) : 0

  // Deducciones del trabajador (siempre).
  const healthEmployee = r(ibc * p.healthEmployee)
  const pensionEmployee = r(ibc * p.pensionEmployee)
  const fsp = ibc >= p.fspMinSmmlv * p.smmlv ? r(ibc * fspRate(ibc, p)) : 0
  const totalDeducciones = healthEmployee + pensionEmployee + fsp + extraDeduccion

  const totalDevengado = salaryEarned + transport + extraSalarial + extraNoSalarial
  const netoPagar = totalDevengado - totalDeducciones

  // Aportes patronales. Exoneración art. 114-1 (salud emp, ICBF, SENA) solo si la
  // empresa es beneficiaria Y el salario base < umbral (10 SMMLV).
  const exonerated = p.exonerationEligible && c.baseSalary < p.exonerationThresholdSmmlv * p.smmlv
  const healthEmployer = exonerated ? 0 : r(ibc * p.healthEmployer)
  const icbf = exonerated ? 0 : r(ibc * p.icbfRate)
  const sena = exonerated ? 0 : r(ibc * p.senaRate)
  const pensionEmployer = r(ibc * p.pensionEmployer)
  const ccf = r(ibc * p.ccfRate)
  const arl = r(ibc * (p.arlRates[c.arlRisk] ?? 0))
  const totalAportes = healthEmployer + pensionEmployer + arl + ccf + icbf + sena

  // Provisiones de prestaciones (el integral no provisiona; incluye transporte salvo vacaciones).
  const basePrest = c.salaryType === 'integral' ? 0 : salaryEarned + transport
  const provCesantias = r(basePrest * p.cesantiasRate)
  const provIntereses = r(provCesantias * (p.interesesCesantiasRate / 12))
  const provPrima = r(basePrest * p.primaRate)
  const provVacaciones = r(salaryEarned * p.vacacionesRate)
  const totalProvisiones = provCesantias + provIntereses + provPrima + provVacaciones

  const costoEmpleador = totalDevengado + totalAportes + totalProvisiones

  return {
    ibc, salaryEarned, transport, totalDevengado,
    healthEmployee, pensionEmployee, fsp, totalDeducciones, netoPagar,
    exonerated, healthEmployer, pensionEmployer, arl, ccf, icbf, sena, totalAportes,
    provCesantias, provIntereses, provPrima, provVacaciones, totalProvisiones, costoEmpleador,
  }
}

/** Mapea una fila de payroll_parameters (snake_case, numeric como string) al tipo
 *  tipado del motor. */
export function fromParamsRow(row: Record<string, unknown>): PayrollParams {
  const num = (v: unknown) => Number(v)
  return {
    smmlv: num(row.smmlv),
    transportAllowance: num(row.transport_allowance),
    healthEmployer: num(row.health_employer),
    healthEmployee: num(row.health_employee),
    pensionEmployer: num(row.pension_employer),
    pensionEmployee: num(row.pension_employee),
    ccfRate: num(row.ccf_rate),
    icbfRate: num(row.icbf_rate),
    senaRate: num(row.sena_rate),
    cesantiasRate: num(row.cesantias_rate),
    interesesCesantiasRate: num(row.intereses_cesantias_rate),
    primaRate: num(row.prima_rate),
    vacacionesRate: num(row.vacaciones_rate),
    ibcMinSmmlv: num(row.ibc_min_smmlv),
    ibcMaxSmmlv: num(row.ibc_max_smmlv),
    transportMaxSmmlv: num(row.transport_max_smmlv),
    exonerationThresholdSmmlv: num(row.exoneration_threshold_smmlv),
    fspMinSmmlv: num(row.fsp_min_smmlv),
    fspBrackets: (row.fsp_brackets as { from: number; to: number; rate: number }[]) ?? [],
    arlRates: (row.arl_rates as Record<string, number>) ?? {},
    exonerationEligible: Boolean(row.exoneration_eligible),
  }
}
