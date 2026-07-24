import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cx } from '../lib/cx.js'

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose && onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-[2px] animate-[fadein_0.15s_ease]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose && onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
    >
      <div
        ref={ref}
        className={cx(
          'w-full bg-white rounded-2xl shadow-xl border border-ink-100 max-h-[90vh] flex flex-col',
          sizes[size]
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h2 className="font-display font-semibold text-lg text-ink-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-ink-400 hover:text-ink-700 rounded-lg p-1 hover:bg-ink-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-ink-100 bg-ink-50/50 rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}