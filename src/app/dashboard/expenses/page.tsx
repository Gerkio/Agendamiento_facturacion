import { requireAdmin } from '@/lib/auth'
import ExpensesView from '@/components/expenses/ExpensesView'
import { bogotaMonthRange, bogotaDayStartISO, bogotaDayEndISO } from '@/lib/dates'
import type { Expense, ExpenseCategory } from '@/types/database'

export default async function ExpensesPage() {
  const supabase = await requireAdmin()

  // Siembra del mes en curso desde el servidor (sin spinner). Trae gastos +
  // categorías + ingresos validados del periodo para calcular el margen.
  const range = bogotaMonthRange()
  const [{ data: expenses }, { data: categories }, { data: invoices }] = await Promise.all([
    supabase.from('expenses').select('*, expense_categories(name)').gte('expense_date', range.from).lte('expense_date', range.to).order('expense_date', { ascending: false }).returns<Expense[]>(),
    supabase.from('expense_categories').select('*').order('name').returns<ExpenseCategory[]>(),
    supabase.from('invoices').select('total_amount').eq('billing_status', 'sent_dian').gte('issue_date', bogotaDayStartISO(range.from)).lte('issue_date', bogotaDayEndISO(range.to)),
  ])
  const ingresos = ((invoices ?? []) as { total_amount: number }[]).reduce((s, i) => s + Number(i.total_amount), 0)

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Gastos</h1>
      <p className="text-sm text-gray-500 mb-6">Registra los egresos operativos y mide el margen del periodo (ingresos − gastos).</p>
      <ExpensesView
        initialRange={range}
        initialExpenses={expenses ?? []}
        initialIngresos={ingresos}
        categories={categories ?? []}
      />
    </div>
  )
}
