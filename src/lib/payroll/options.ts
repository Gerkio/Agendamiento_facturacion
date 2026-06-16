/** Opciones y etiquetas del módulo de nómina (UI). */

export const CONTRACT_TYPES = [
  { value: 'indefinido', label: 'Término indefinido' },
  { value: 'fijo', label: 'Término fijo' },
  { value: 'obra_labor', label: 'Obra o labor' },
  { value: 'aprendizaje', label: 'Aprendizaje' },
]
export const SALARY_TYPES = [
  { value: 'ordinario', label: 'Ordinario' },
  { value: 'integral', label: 'Integral' },
]
export const ARL_LEVELS = [
  { value: 'I', label: 'I — Mínimo (0,522%)' },
  { value: 'II', label: 'II — Bajo (1,044%)' },
  { value: 'III', label: 'III — Medio (2,436%)' },
  { value: 'IV', label: 'IV — Alto (4,350%)' },
  { value: 'V', label: 'V — Máximo (6,960%)' },
]
export const PERIODICITIES = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'quincenal', label: 'Quincenal' },
]
export const ACCOUNT_TYPES = [
  { value: 'ahorros', label: 'Ahorros' },
  { value: 'corriente', label: 'Corriente' },
]

const labelOf = (opts: { value: string; label: string }[], v?: string | null) => opts.find(o => o.value === v)?.label ?? '—'
export const contractTypeLabel = (v?: string | null) => labelOf(CONTRACT_TYPES, v)
export const salaryTypeLabel = (v?: string | null) => labelOf(SALARY_TYPES, v)

export const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  borrador: { label: 'Borrador', cls: 'bg-gray-100 text-gray-600' },
  calculada: { label: 'Calculada', cls: 'bg-blue-100 text-blue-700' },
  aprobada: { label: 'Aprobada', cls: 'bg-amber-100 text-amber-700' },
  pagada: { label: 'Pagada', cls: 'bg-green-100 text-green-700' },
  anulada: { label: 'Anulada', cls: 'bg-red-100 text-red-700' },
}
export const runStatusLabel = (s: string) => RUN_STATUS[s]?.label ?? s
export const runStatusCls = (s: string) => RUN_STATUS[s]?.cls ?? 'bg-gray-100 text-gray-600'
