'use client'

import { useState } from 'react'

const WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const pad2 = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}` // m: 0-based

interface Props {
  /** Días adicionales seleccionados ("YYYY-MM-DD"), sin contar la fecha base. */
  selected: string[]
  /** Fecha base (siempre agendada): se muestra fija y no se puede quitar. */
  baseDate?: string
  onChange: (dates: string[]) => void
  onClose: () => void
}

export default function MultiDatePicker({ selected, baseDate, onChange, onClose }: Props) {
  const anchor = baseDate ? new Date(baseDate + 'T00:00:00') : new Date()
  const [view, setView] = useState({ y: anchor.getFullYear(), m: anchor.getMonth() })
  const sel = new Set(selected)
  const todayStr = ymd(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

  function toggle(dateStr: string) {
    if (dateStr === baseDate) return
    const next = new Set(sel)
    if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr)
    onChange([...next].sort())
  }
  function move(delta: number) {
    setView(v => {
      const m = v.m + delta
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
    })
  }

  const firstDow = (new Date(view.y, view.m, 1).getDay() + 6) % 7 // Lunes = 0
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-base font-semibold">Elegir días</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-600 hover:text-gray-800 text-xl">✕</button>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => move(-1)} aria-label="Mes anterior" className="px-2 py-1 rounded hover:bg-gray-100">‹</button>
            <span className="text-sm font-medium text-gray-800">{MONTHS[view.m]} {view.y}</span>
            <button type="button" onClick={() => move(1)} aria-label="Mes siguiente" className="px-2 py-1 rounded hover:bg-gray-100">›</button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
            {WEEK.map(w => <div key={w} className="py-1">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={`e${i}`} />
              const dateStr = ymd(view.y, view.m, d)
              const isBase = dateStr === baseDate
              const isSel = sel.has(dateStr)
              const isToday = dateStr === todayStr
              return (
                <button key={dateStr} type="button" onClick={() => toggle(dateStr)} disabled={isBase}
                  className={`h-9 rounded-lg text-sm transition ${
                    isBase ? 'bg-brand-700 text-white font-semibold cursor-default'
                    : isSel ? 'bg-brand-500 text-white font-medium'
                    : isToday ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                    : 'text-gray-700 hover:bg-gray-100'
                  }`}>
                  {d}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-brand-700 inline-block" /> Fecha base</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-brand-500 inline-block" /> Adicional</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t">
          <button type="button" onClick={() => onChange([])} className="text-sm text-gray-600 hover:text-gray-800">Limpiar adicionales</button>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700">Listo ({selected.length} adicional{selected.length === 1 ? '' : 'es'})</button>
        </div>
      </div>
    </div>
  )
}
