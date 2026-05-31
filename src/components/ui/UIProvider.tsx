'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem { id: number; message: string; type: ToastType }

interface ConfirmOpts {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface UICtx {
  toast: (message: string, type?: ToastType) => void
  confirm: (opts: ConfirmOpts) => Promise<boolean>
}

const Ctx = createContext<UICtx | null>(null)

export function useUI(): UICtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useUI debe usarse dentro de <UIProvider>')
  return c
}

let counter = 0

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<{ opts: ConfirmOpts; resolve: (b: boolean) => void } | null>(null)

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counter
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500)
  }, [])

  const confirm = useCallback(
    (opts: ConfirmOpts) => new Promise<boolean>(resolve => setConfirmState({ opts, resolve })),
    []
  )

  function answer(b: boolean) {
    confirmState?.resolve(b)
    setConfirmState(null)
  }

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      {/* Pila de toasts */}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 w-[min(92vw,360px)]">
        {toasts.map(t => (
          <ToastCard key={t.id} item={t} onClose={() => setToasts(p => p.filter(x => x.id !== t.id))} />
        ))}
      </div>

      {/* Diálogo de confirmación */}
      {confirmState && <ConfirmModal opts={confirmState.opts} onAnswer={answer} />}
    </Ctx.Provider>
  )
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const styles: Record<ToastType, { bg: string; icon: string }> = {
    success: { bg: 'bg-green-600', icon: '✓' },
    error: { bg: 'bg-red-600', icon: '✕' },
    info: { bg: 'bg-gray-800', icon: 'ℹ' },
  }
  const s = styles[item.type]
  return (
    <div role="status" className={`${s.bg} text-white rounded-lg shadow-lg px-4 py-3 text-base flex items-start gap-3 animate-[fadeIn_.15s_ease-out]`}>
      <span className="font-bold" aria-hidden="true">{s.icon}</span>
      <span className="flex-1">{item.message}</span>
      <button type="button" onClick={onClose} aria-label="Cerrar" className="opacity-80 hover:opacity-100">✕</button>
    </div>
  )
}

function ConfirmModal({ opts, onAnswer }: { opts: ConfirmOpts; onAnswer: (b: boolean) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onAnswer(false)
      if (e.key === 'Enter') onAnswer(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onAnswer])

  return (
    <div onClick={() => onAnswer(false)} role="dialog" aria-modal="true" className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        {opts.title && <h3 className="text-xl font-bold text-gray-900 mb-1.5">{opts.title}</h3>}
        <p className="text-base text-gray-700 whitespace-pre-line">{opts.message}</p>
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" onClick={() => onAnswer(false)} className="px-4 py-2.5 rounded-lg text-base border border-gray-400 hover:bg-gray-50">
            {opts.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={() => onAnswer(true)}
            className={`px-4 py-2.5 rounded-lg text-base text-white font-semibold ${opts.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}
          >
            {opts.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
