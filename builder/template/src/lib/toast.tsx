import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  const push = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idCounter
    setToasts((t) => [...t, { id, message, type }])
    timers.current[id] = setTimeout(() => remove(id), duration)
    return id
  }, [remove])

  const toast = {
    success: (msg, d) => push(msg, 'success', d),
    error: (msg, d) => push(msg, 'error', d),
    info: (msg, d) => push(msg, 'info', d),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,360px)]" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={
              'flex items-start gap-2.5 rounded-xl border px-4 py-3 shadow-soft bg-white animate-[fadein_0.2s_ease] ' +
              (t.type === 'success' ? 'border-emerald-200' : t.type === 'error' ? 'border-rose-200' : 'border-ink-200')
            }
          >
            <span className="mt-0.5 shrink-0">
              {t.type === 'success' && <CheckCircle2 size={18} className="text-emerald-600" />}
              {t.type === 'error' && <XCircle size={18} className="text-rose-600" />}
              {t.type === 'info' && <Info size={18} className="text-brand-600" />}
            </span>
            <p className="text-sm text-ink-800 flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              aria-label="Dismiss notification"
              className="text-ink-400 hover:text-ink-700 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}