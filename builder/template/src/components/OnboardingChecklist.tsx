import { Link } from 'react-router-dom'
import { ArrowRight, Check, X } from 'lucide-react'
import Progress from './Progress.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface OnboardingChecklistProps {
  title?: string
  subtitle?: ReactNode
  steps?: any[]
  onDismiss?: (...args: any[]) => any
  keepWhenComplete?: boolean
  className?: string
}

// OnboardingChecklist — the "get set up" card on a new account's dashboard. steps: [{id, title, body, done, to,
// onClick, cta}]. Hides itself once every step is done unless `keepWhenComplete`.
export default function OnboardingChecklist({
  title = 'Finish setting up', subtitle, steps = [], onDismiss, keepWhenComplete = false, className,
}: OnboardingChecklistProps) {
  const done = steps.filter((s) => s.done).length
  const complete = steps.length > 0 && done === steps.length
  if (complete && !keepWhenComplete) return null
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      <div className="flex items-start gap-4 border-b border-ink-100 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
          <p className="mt-0.5 text-sm text-ink-500">{subtitle || `${done} of ${steps.length} done`}</p>
          <Progress value={done} max={steps.length} size="sm" className="mt-3" />
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Dismiss setup"
            className="rounded-lg p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <X size={16} />
          </button>
        )}
      </div>
      <ul className="divide-y divide-ink-100">
        {steps.map((s) => {
          const body = (
            <>
              <span className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                s.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-ink-300')}>
                {s.done && <Check size={12} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx('block text-sm font-medium', s.done ? 'text-ink-400 line-through' : 'text-ink-900')}>{s.title}</span>
                {s.body && !s.done && <span className="mt-0.5 block text-sm text-ink-500">{s.body}</span>}
              </span>
              {!s.done && (
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600">
                  {s.cta || 'Start'} <ArrowRight size={14} />
                </span>
              )}
            </>
          )
          const cls = 'flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500'
          return (
            <li key={s.id || s.title}>
              {s.done ? <div className="flex items-start gap-3 px-5 py-3.5">{body}</div>
                : s.to ? <Link to={s.to} className={cls}>{body}</Link>
                : <button type="button" onClick={s.onClick} className={cls}>{body}</button>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
