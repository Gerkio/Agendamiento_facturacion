/** Etiquetas y opciones del módulo de gastos. Centralizado para que la vista y el
 *  CSV usen los mismos textos. */

export const EXPENSE_PAYMENT: Record<string, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  pagado: { label: 'Pagado', cls: 'bg-green-100 text-green-700' },
}

export const expensePaymentLabel = (s: string) => EXPENSE_PAYMENT[s]?.label ?? s
export const expensePaymentCls = (s: string) => EXPENSE_PAYMENT[s]?.cls ?? 'bg-gray-100 text-gray-600'

/** Medios de pago de un gasto (mismo set que la cartera). */
export const MEDIOS_GASTO = ['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta', 'Otro']
