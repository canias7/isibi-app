import { Info, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

const tones = {
  info: { box: 'bg-sky-50 border-sky-200 text-sky-900', icon: 'text-sky-500', Icon: Info },
  success: { box: 'bg-emerald-50 border-emerald-200 text-emerald-900', icon: 'text-emerald-500', Icon: CheckCircle2 },
  warning: { box: 'bg-accent-50 border-accent-200 text-accent-700', icon: 'text-accent-500', Icon: AlertTriangle },
  danger: { box: 'bg-rose-50 border-rose-200 text-rose-900', icon: 'text-rose-500', Icon: XCircle },
}

interface AlertProps {
  tone?: 'info' | 'success' | 'warning' | 'danger'
  title?: ReactNode
  children?: ReactNode
  onDismiss?: (...args: any[]) => any
  action?: any
  className?: string
}

export default function Alert({ tone = 'info', title, children, onDismiss, action, className }: AlertProps) {
  const t = tones[tone] || tones.info
  const Icon = t.Icon
  return (
    <div role="alert" className={cx('flex gap-3 rounded-xl border px-4 py-3.5', t.box, className)}>
      <Icon size={18} className={cx('mt-0.5 shrink-0', t.icon)} />
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-semibold">{title}</p>}
        {children && <div className={cx('text-sm', title && 'mt-0.5 opacity-90')}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-50 transition hover:opacity-100">
          <X size={16} />
        </button>
      )}
    </div>
  )
}
