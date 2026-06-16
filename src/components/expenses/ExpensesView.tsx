'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUI } from '@/components/ui/UIProvider'
import { formatCOP, fmtDate } from '@/lib/format'
import { buildCsv, downloadCsv } from '@/lib/csv'
import { bogotaDayStartISO, bogotaDayEndISO, bogotaToday } from '@/lib/dates'
import { EXPENSE_PAYMENT, expensePaymentLabel, expensePaymentCls, MEDIOS_GASTO } from '@/lib/expenses'
import type { Expense, ExpenseCategory } from '@/types/database'

interface Props {
  initialRange: { from: string; to: string }
  initialExpenses: Expense[]
  initialIngresos: number
  categories: ExpenseCategory[]
}

const categoryNameOf = (e: Expense) => (e.expense_categories as { name?: string } | undefined)?.name ?? '—'

/** Gastos: registra egresos, mide el margen del periodo (ingresos − gastos),
 *  filtra y exporta. Conecta Facturación (ingresos) con los costos. Solo admin. */
export default function ExpensesView({ initialRange, initialExpenses, initialIngresos, categories: initialCats }: Props) {
  const supabase = createClient()
  const { toast, confirm } = useUI()
  const [range, setRange] = useState(initialRange)
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [ingresos, setIngresos] = useState(initialIngresos)
  const [cats, setCats] = useState<ExpenseCategory[]>(initialCats)
  const [loading, setLoading] = useState(false)
  // Filtros.
  const [catFilter, setCatFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendiente' | 'pagado'>('all')
  const [search, setSearch] = useState('')
  // Modales.
  const [modal, setModal] = useState<Expense | 'new' | null>(null)
  const [catsModal, setCatsModal] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  async function load(from: string, to: string) {
    if (!from || !to) return
    setLoading(true)
    const [{ data: exp, error: e1 }, { data: inv, error: e2 }] = await Promise.all([
      supabase.from('expenses').select('*, expense_categories(name)').gte('expense_date', from).lte('expense_date', to).order('expense_date', { ascending: false }),
      supabase.from('invoices').select('total_amount').eq('billing_status', 'sent_dian').gte('issue_date', bogotaDayStartISO(from)).lte('issue_date', bogotaDayEndISO(to)),
    ])
    if (e1 || e2) toast('Error cargando gastos: ' + (e1?.message ?? e2?.message ?? ''), 'error')
    setExpenses((exp as Expense[]) ?? [])
    setIngresos(((inv as { total_amount: number }[]) ?? []).reduce((s, i) => s + Number(i.total_amount), 0))
    setLoading(false)
  }

  const activeCats = cats.filter(c => c.is_active)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return expenses.filter(e => {
      if (catFilter && e.category_id !== catFilter) return false
      if (statusFilter !== 'all' && e.payment_status !== statusFilter) return false
      if (q) {
        const hay = `${categoryNameOf(e)} ${e.supplier_name ?? ''} ${e.description ?? ''} ${e.cost_center ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [expenses, catFilter, statusFilter, search])

  const totalGastos = filtered.reduce((s, e) => s + Number(e.total_amount), 0)
  const pendientes = filtered.filter(e => e.payment_status === 'pendiente').reduce((s, e) => s + Number(e.total_amount), 0)
  const margen = ingresos - totalGastos

  const porCategoria = useMemo(() => {
    const m = new Map<string, number>()
    filtered.forEach(e => { const k = categoryNameOf(e); m.set(k, (m.get(k) ?? 0) + Number(e.total_amount)) })
    return [...m.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)
  }, [filtered])

  async function togglePaid(e: Expense) {
    const next = e.payment_status === 'pagado' ? 'pendiente' : 'pagado'
    setBusy(e.id)
    const { error } = await supabase.from('expenses').update({ payment_status: next }).eq('id', e.id)
    setBusy(null)
    if (error) { toast('No se pudo actualizar: ' + error.message, 'error'); return }
    setExpenses(prev => prev.map(x => x.id === e.id ? { ...x, payment_status: next } : x))
  }

  async function remove(e: Expense) {
    const ok = await confirm({ title: 'Eliminar gasto', message: '¿Eliminar este gasto? No se puede deshacer.', confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    setBusy(e.id)
    const { error } = await supabase.from('expenses').delete().eq('id', e.id)
    setBusy(null)
    if (error) { toast('No se pudo eliminar: ' + error.message, 'error'); return }
    setExpenses(prev => prev.filter(x => x.id !== e.id))
    toast('Gasto eliminado.', 'success')
  }

  async function viewSupport(e: Expense) {
    if (!e.support_path) return
    const res = await fetch(`/api/expenses/${e.id}/receipt`)
    const data = await res.json()
    if (!res.ok || !data.signedUrl) { toast('No se pudo abrir el soporte.', 'error'); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  function exportCsv() {
    const headers = ['Fecha', 'Categoría', 'Proveedor', 'Centro de costo', 'Descripción', 'Base', 'IVA', 'Total', 'Medio', 'Estado']
    const rows = filtered.map(e => [
      fmtDate(e.expense_date), categoryNameOf(e), e.supplier_name ?? '', e.cost_center ?? '', e.description ?? '',
      Number(e.base_amount), Number(e.iva_amount), Number(e.total_amount), e.payment_method ?? '', expensePaymentLabel(e.payment_status),
    ])
    downloadCsv(`gastos-${bogotaToday()}`, buildCsv(headers, rows))
  }

  const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-4">
      {/* Periodo + acciones */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
          <input type="date" title="Desde" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
          <input type="date" title="Hasta" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} className={inputCls} />
        </div>
        <button type="button" onClick={() => load(range.from, range.to)} disabled={loading}
          className="text-sm px-4 py-2 rounded-lg bg-gray-700 text-white font-medium hover:bg-gray-800 disabled:opacity-50">
          {loading ? 'Cargando…' : 'Generar'}
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setCatsModal(true)} className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Categorías</button>
          <button type="button" onClick={exportCsv} disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <span aria-hidden="true">⬇️</span> CSV
          </button>
          <button type="button" onClick={() => setModal('new')} className="text-sm px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700">+ Gasto</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi title="Gastos del periodo" value={formatCOP(totalGastos)} sub={`${filtered.length} registro(s)`} accent="amber" />
        <Kpi title="Pendientes de pago" value={formatCOP(pendientes)} sub="por pagar a proveedores" accent="gray" />
        <Kpi title="Ingresos (validados DIAN)" value={formatCOP(ingresos)} sub="facturas del periodo" accent="green" />
        <Kpi title="Margen" value={formatCOP(margen)} sub="ingresos − gastos" accent={margen >= 0 ? 'brand' : 'red'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Filtros + tabla */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-wrap gap-2">
            <select title="Categoría" value={catFilter} onChange={e => setCatFilter(e.target.value)} className={inputCls}>
              <option value="">Todas las categorías</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select title="Estado de pago" value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className={inputCls}>
              <option value="all">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="pagado">Pagados</option>
            </select>
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proveedor, descripción…" className={`${inputCls} flex-1 min-w-[160px]`} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[720px]">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-left px-4 py-3">Proveedor</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-500">Sin gastos en el periodo.</td></tr>}
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(e.expense_date)}</td>
                    <td className="px-4 py-3 text-gray-700">{categoryNameOf(e)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {e.supplier_name ?? '—'}
                      {e.support_path && <button type="button" onClick={() => viewSupport(e)} title="Ver soporte" className="ml-1.5 text-brand-600 hover:underline">📎</button>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatCOP(Number(e.total_amount))}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => togglePaid(e)} disabled={busy === e.id} title="Cambiar estado de pago"
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${expensePaymentCls(e.payment_status)} disabled:opacity-50`}>
                        {expensePaymentLabel(e.payment_status)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button type="button" onClick={() => setModal(e)} className="text-brand-600 hover:underline text-xs font-medium mr-3">Editar</button>
                      <button type="button" onClick={() => remove(e)} disabled={busy === e.id} className="text-red-500 hover:underline text-xs disabled:opacity-50">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>

        {/* Por categoría */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-700">Gasto por categoría</h3></div>
          <div className="divide-y divide-gray-100">
            {porCategoria.length === 0 && <p className="px-4 py-6 text-center text-gray-500 text-sm">Sin datos.</p>}
            {porCategoria.map(c => (
              <div key={c.name} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <span className="text-gray-700">{c.name}</span>
                <span className="font-medium text-gray-800">{formatCOP(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modal && (
        <ExpenseModal
          expense={modal === 'new' ? null : modal}
          categories={activeCats}
          onClose={() => setModal(null)}
          onSaved={(saved, inRange) => {
            setExpenses(prev => {
              const without = prev.filter(x => x.id !== saved.id)
              return inRange ? [saved, ...without].sort((a, b) => (a.expense_date < b.expense_date ? 1 : -1)) : without
            })
            setModal(null)
          }}
          range={range}
        />
      )}

      {catsModal && (
        <CategoriesModal
          categories={cats}
          onClose={() => setCatsModal(false)}
          onChange={setCats}
        />
      )}
    </div>
  )
}

function Kpi({ title, value, sub, accent }: { title: string; value: string; sub: string; accent: 'amber' | 'green' | 'brand' | 'gray' | 'red' }) {
  const cls: Record<string, string> = {
    amber: 'border-amber-200 bg-amber-50', green: 'border-green-200 bg-green-50',
    brand: 'border-brand-200 bg-brand-50', gray: 'border-gray-200 bg-white', red: 'border-red-200 bg-red-50',
  }
  return (
    <div className={`rounded-xl border shadow-sm p-4 ${cls[accent]}`}>
      <p className="text-xs uppercase text-gray-500 font-semibold truncate">{title}</p>
      <p className="text-lg font-bold text-gray-800 mt-1 truncate">{value}</p>
      <p className="text-xs text-gray-600 mt-0.5 truncate">{sub}</p>
    </div>
  )
}

function ExpenseModal({ expense, categories, range, onClose, onSaved }: {
  expense: Expense | null
  categories: ExpenseCategory[]
  range: { from: string; to: string }
  onClose: () => void
  onSaved: (e: Expense, inRange: boolean) => void
}) {
  const supabase = createClient()
  const { toast } = useUI()
  const [form, setForm] = useState({
    expense_date: expense?.expense_date ?? bogotaToday(),
    category_id: expense?.category_id ?? (categories[0]?.id ?? ''),
    supplier_name: expense?.supplier_name ?? '',
    cost_center: expense?.cost_center ?? '',
    description: expense?.description ?? '',
    total: expense ? String(expense.total_amount) : '',
    iva: expense ? String(expense.iva_amount) : '',
    payment_method: expense?.payment_method ?? MEDIOS_GASTO[0],
    payment_status: expense?.payment_status ?? 'pendiente',
  })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    const total = Number(form.total)
    const iva = Number(form.iva) || 0
    if (!form.category_id) { setError('Elige una categoría.'); return }
    if (!(total > 0)) { setError('El total debe ser mayor a 0.'); return }
    if (iva < 0 || iva > total) { setError('El IVA no puede ser mayor al total.'); return }
    setSaving(true); setError(null)
    const payload = {
      expense_date: form.expense_date,
      category_id: form.category_id,
      supplier_name: form.supplier_name.trim() || null,
      cost_center: form.cost_center.trim() || null,
      description: form.description.trim() || null,
      base_amount: total - iva,
      iva_amount: iva,
      total_amount: total,
      payment_method: form.payment_method,
      payment_status: form.payment_status,
    }
    let saved: Expense | null = null
    if (expense) {
      const { data, error } = await supabase.from('expenses').update(payload).eq('id', expense.id).select('*, expense_categories(name)').single()
      if (error) { setSaving(false); setError('No se pudo guardar: ' + error.message); return }
      saved = data as Expense
    } else {
      const { data, error } = await supabase.from('expenses').insert(payload).select('*, expense_categories(name)').single()
      if (error) { setSaving(false); setError('No se pudo crear: ' + error.message); return }
      saved = data as Expense
    }
    // Soporte (opcional).
    if (file && saved) {
      const fd = new FormData(); fd.append('support', file)
      const res = await fetch(`/api/expenses/${saved.id}/receipt`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setSaving(false); setError('Gasto guardado, pero el soporte no se subió: ' + (data.error ?? '')); return }
      saved = { ...saved, support_path: data.path }
    }
    setSaving(false)
    toast(expense ? 'Gasto actualizado.' : 'Gasto registrado.', 'success')
    const inRange = !!saved && saved.expense_date >= range.from && saved.expense_date <= range.to
    if (saved) onSaved(saved, inRange)
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{expense ? 'Editar gasto' : 'Nuevo gasto'}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
            <input type="date" title="Fecha del gasto" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} className={input} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
            <select title="Categoría" value={form.category_id} onChange={e => set('category_id', e.target.value)} className={input}>
              {categories.length === 0 && <option value="">— Crea una categoría —</option>}
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor / tercero</label>
            <input type="text" value={form.supplier_name} onChange={e => set('supplier_name', e.target.value)} placeholder="Ej: Distribuidora XYZ" className={input} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Centro de costo</label>
            <input type="text" value={form.cost_center} onChange={e => set('cost_center', e.target.value)} placeholder="Opcional" className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Concepto del gasto" className={input} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Total (COP)</label>
            <input type="number" title="Total del gasto" inputMode="numeric" min={0} value={form.total} onChange={e => set('total', e.target.value)} placeholder="0" className={input} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">IVA incluido (COP)</label>
            <input type="number" title="IVA incluido" inputMode="numeric" min={0} value={form.iva} onChange={e => set('iva', e.target.value)} placeholder="0" className={input} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Medio de pago</label>
            <select title="Medio de pago" value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className={input}>
              {MEDIOS_GASTO.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
            <select title="Estado de pago" value={form.payment_status} onChange={e => set('payment_status', e.target.value)} className={input}>
              {Object.entries(EXPENSE_PAYMENT).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Soporte (factura/recibo — JPG, PNG, WEBP o PDF, máx 5 MB)</label>
            <input type="file" title="Soporte del gasto" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
            {expense?.support_path && !file && <p className="text-xs text-green-600 mt-1">✓ Tiene soporte adjunto (subir uno nuevo lo reemplaza).</p>}
          </div>
          {error && <div className="sm:col-span-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

function CategoriesModal({ categories, onClose, onChange }: {
  categories: ExpenseCategory[]
  onClose: () => void
  onChange: (cats: ExpenseCategory[]) => void
}) {
  const supabase = createClient()
  const { toast } = useUI()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function add() {
    const n = name.trim()
    if (!n) return
    setSaving(true)
    const { data, error } = await supabase.from('expense_categories').insert({ name: n }).select('*').single()
    setSaving(false)
    if (error) { toast(error.message.includes('duplicate') ? 'Ya existe esa categoría.' : 'No se pudo crear: ' + error.message, 'error'); return }
    onChange([...categories, data as ExpenseCategory].sort((a, b) => a.name.localeCompare(b.name)))
    setName('')
  }

  async function toggle(c: ExpenseCategory) {
    const { error } = await supabase.from('expense_categories').update({ is_active: !c.is_active }).eq('id', c.id)
    if (error) { toast('No se pudo actualizar: ' + error.message, 'error'); return }
    onChange(categories.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x))
  }

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">Categorías de gasto</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex gap-2">
            <input type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="Nueva categoría" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <button type="button" onClick={add} disabled={saving || !name.trim()} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">Agregar</button>
          </div>
          <ul className="divide-y divide-gray-100">
            {categories.map(c => (
              <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                <span className={c.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}>{c.name}</span>
                <button type="button" onClick={() => toggle(c)} className="text-xs text-brand-600 hover:underline">{c.is_active ? 'Desactivar' : 'Activar'}</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end p-5 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
