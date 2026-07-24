import { AlertTriangle, Info, Lightbulb, OctagonAlert } from 'lucide-react'
import { cx } from '../lib/cx.js'

// Callout — the note/tip/warning aside INSIDE long-form content. Distinct from Alert, which is an app-level
// status message (dismissible, sits above the UI); a Callout is part of the prose and never dismisses.
const TONES = {
  note: { icon: Info, wrap: 'border-brand-200 bg-brand-50', mark: 'text-brand-600', head: 'text-brand-900' },
  tip: { icon: Lightbulb, wrap: 'border-emerald-200 bg-emerald-50', mark: 'text-emerald-600', head: 'text-emerald-900' },
  warning: { icon: AlertTriangle, wrap: 'border-amber-200 bg-amber-50', mark: 'text-amber-600', head: 'text-amber-900' },
  danger: { icon: OctagonAlert, wrap: 'border-rose-200 bg-rose-50', mark: 'text-rose-600', head: 'text-rose-900' },
}
export default function Callout({ tone = 'note', title, children, className }) {
  const t = TONES[tone] || TONES.note
  const Icon = t.icon
  return (
    <aside className={cx('flex gap-3 rounded-xl2 border p-4', t.wrap, className)}>
      <Icon size={18} className={cx('mt-0.5 shrink-0', t.mark)} aria-hidden="true" />
      <div className="min-w-0 text-sm">
        {title && <p className={cx('font-display font-semibold', t.head)}>{title}</p>}
        <div className={cx('text-ink-700', title && 'mt-1')}>{children}</div>
      </div>
    </aside>
  )
}
