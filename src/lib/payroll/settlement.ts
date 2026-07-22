/** Motor de LIQUIDACIÓN DEFINITIVA de contrato (Colombia). Función PURA, testeable.
 *
 *  ⚠️ CIFRAS Y REGLAS A VALIDAR CON EL CONTADOR antes de liquidar en producción:
 *  - Convención de días: 360 días/año, 30 días/mes (30E/360), ambos extremos
 *    incluidos. Es la convención habitual de liquidación, pero el conteo exacto
 *    (calendario real vs. 360) debe confirmarse.
 *  - Bases: cesantías/prima incluyen auxilio de transporte; vacaciones NO. El
 *    promedio de pagos variables (comisiones, horas extra) NO se incluye aquí:
 *    si aplica, ajústalo en la base salarial.
 *  - Descuentos de lo YA pagado (cesantías consignadas, primas pagadas, vacaciones
 *    disfrutadas) se manejan moviendo la fecha "desde" de cada concepto; el motor
 *    NO conoce pagos previos.
 *  - Salario integral: cesantías/intereses/prima = 0 (el factor prestacional ya
 *    los cubre); vacaciones se calculan sobre el salario integral. Confirmar.
 *  - Indemnización art. 64 CST solo por despido SIN justa causa. */

export type ContractType = 'indefinido' | 'fijo' | 'obra_labor' | 'aprendizaje'
export type TerminationCause = 'sin_justa_causa' | 'justa_causa' | 'renuncia' | 'vencimiento' | 'mutuo_acuerdo'

export interface SettlementContract {
  baseSalary: number
  salaryType: 'ordinario' | 'integral'
  contractType: ContractType
  /** Auxilio de transporte mensual (0 si no aplica); entra a cesantías y prima. */
  transportAllowance: number
  /** SMMLV vigente (para el umbral de 10 SMMLV del art. 64). */
  smmlv: number
  /** Tasa anual de intereses a las cesantías (típico 0.12). */
  interesesCesantiasRate: number
}

export interface SettlementInput {
  /** Base de cesantías/intereses (última consignación o inicio de contrato). ISO YYYY-MM-DD. */
  cesantiasFrom: string
  /** Base de prima (inicio del semestre en curso o último pago). ISO. */
  primaFrom: string
  /** Base de vacaciones (inicio de contrato o fin del último disfrute). ISO. */
  vacacionesFrom: string
  /** Fecha de terminación del contrato. ISO. */
  terminationDate: string
  /** Fin pactado del contrato (para indemnización de término fijo / obra). ISO. */
  contractEnd?: string | null
  cause: TerminationCause
}

export interface Settlement {
  diasCesantias: number
  baseCesantias: number
  cesantias: number
  intereses: number
  diasPrima: number
  prima: number
  diasVacaciones: number
  vacaciones: number
  indemnizacion: number
  indemnizacionDetalle: string
  totalPrestaciones: number
  total: number
}

const r = (n: number) => Math.round(n)

function ymd(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return [y, m, d]
}

/** Días entre dos fechas en convención 30E/360, ambos extremos incluidos.
 *  Mes completo (1→30) = 30; año completo (ene 1 → dic 31) = 360. */
export function dias360(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = ymd(fromISO)
  const [y2, m2, d2] = ymd(toISO)
  const dd1 = Math.min(d1, 30)
  const dd2 = Math.min(d2, 30)
  const base = (y2 - y1) * 360 + (m2 - m1) * 30 + (dd2 - dd1)
  return Math.max(0, base + 1)
}

/** Días faltantes entre dos fechas (para indemnización de término fijo/obra), sin
 *  incluir el día de terminación ya trabajado. */
export function diasFaltantes(fromISO: string, toISO: string): number {
  return Math.max(0, dias360(fromISO, toISO) - 1)
}

/** Calcula la liquidación definitiva. Todas las cifras salen de los parámetros
 *  y del contrato; ninguna regla legal está hardcodeada salvo la ESTRUCTURA de
 *  las fórmulas (que el contador debe validar). */
export function calcSettlement(c: SettlementContract, n: SettlementInput): Settlement {
  const integral = c.salaryType === 'integral'
  const salarioDiario = c.baseSalary / 30

  // Base de cesantías/prima: salario + transporte (el transporte SÍ computa).
  const baseCesantias = integral ? 0 : c.baseSalary + c.transportAllowance

  // Cesantías = base * díasTrabajados / 360. Intereses = cesantías * días * tasa / 360.
  const diasCesantias = dias360(n.cesantiasFrom, n.terminationDate)
  const cesantias = r(baseCesantias * diasCesantias / 360)
  const intereses = r(cesantias * diasCesantias * c.interesesCesantiasRate / 360)

  // Prima = base * díasDelSemestre / 360.
  const diasPrima = integral ? 0 : dias360(n.primaFrom, n.terminationDate)
  const prima = r(baseCesantias * diasPrima / 360)

  // Vacaciones = salario (SIN transporte) * díasTrabajados / 720.
  const diasVacaciones = dias360(n.vacacionesFrom, n.terminationDate)
  const vacaciones = r(c.baseSalary * diasVacaciones / 720)

  // Indemnización art. 64: solo por despido SIN justa causa.
  let indemnizacion = 0
  let indemnizacionDetalle = 'No aplica (la causa no genera indemnización art. 64).'
  if (n.cause === 'sin_justa_causa') {
    const res = indemnizacionArt64(c, n, salarioDiario)
    indemnizacion = res.valor
    indemnizacionDetalle = res.detalle
  }

  const totalPrestaciones = cesantias + intereses + prima + vacaciones
  const total = totalPrestaciones + indemnizacion

  return {
    diasCesantias, baseCesantias, cesantias, intereses,
    diasPrima, prima, diasVacaciones, vacaciones,
    indemnizacion, indemnizacionDetalle, totalPrestaciones, total,
  }
}

function indemnizacionArt64(c: SettlementContract, n: SettlementInput, salarioDiario: number): { valor: number; detalle: string } {
  if (c.contractType === 'aprendizaje') {
    return { valor: 0, detalle: 'Contrato de aprendizaje: no genera indemnización art. 64.' }
  }

  // Término fijo u obra: salarios del tiempo faltante para terminar el contrato.
  if (c.contractType === 'fijo' || c.contractType === 'obra_labor') {
    if (!n.contractEnd) {
      return { valor: 0, detalle: 'Falta la fecha de fin del contrato para calcular el tiempo faltante.' }
    }
    const faltan = diasFaltantes(n.terminationDate, n.contractEnd)
    // Obra o labor: mínimo 15 días.
    const dias = c.contractType === 'obra_labor' ? Math.max(15, faltan) : faltan
    const valor = r(salarioDiario * dias)
    const min = c.contractType === 'obra_labor' && faltan < 15 ? ' (mínimo 15 días)' : ''
    return { valor, detalle: `${c.contractType === 'fijo' ? 'Término fijo' : 'Obra o labor'}: ${dias} días de salario por el tiempo faltante${min}.` }
  }

  // Término indefinido: depende de si el salario es < o >= 10 SMMLV.
  const diasTotal = dias360(n.cesantiasFrom, n.terminationDate)
  const anios = diasTotal / 360
  const bajo = c.baseSalary < 10 * c.smmlv
  const primerAnio = bajo ? 30 : 20
  const porAnioAdicional = bajo ? 20 : 15

  let dias: number
  if (diasTotal <= 360) {
    // Hasta 1 año: los días del primer año (no proporcional).
    dias = primerAnio
  } else {
    const fraccionAdicional = (diasTotal - 360) / 360
    dias = primerAnio + porAnioAdicional * fraccionAdicional
  }
  const valor = r(salarioDiario * dias)
  const tabla = bajo ? '30 + 20/año adicional (salario < 10 SMMLV)' : '20 + 15/año adicional (salario ≥ 10 SMMLV)'
  return { valor, detalle: `Indefinido, ${anios.toFixed(2)} años: ${dias.toFixed(1)} días de salario [${tabla}].` }
}
