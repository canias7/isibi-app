import { Link } from 'react-router-dom'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface UsageBarProps {
  label?: ReactNode
  used?: number
  cap?: number
  unit?: string
  format?: any
  className?: string
}

// UsageMeter — "X of Y used" for a metered plan: seats, storage, credits, API calls, minutes. Warns as the
// cap approaches and turns the CTA on once it's hit, which is the whole point of showing it.
// metrics: [{label, used, cap, unit, format}] — pass several for a plan summary card.
export function UsageBar({ label, used = 0, cap = 0, unit = '', format, className }: UsageBarProps) {
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0
  const fmt = format || ((n) => n.toLocaleString())
  const tone = pct >= 100 ? 'bg-rose-500' : pct >= 85 ? 'bg-amber-500' : 'bg-brand-500'
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-ink-700">{label}</span>
        <span className={cx('tabular-nums', pct >= 100 ? 'font-medium text-rose-600' : 'text-ink-500')}>
          {fmt(used)} / {cap > 0 ? fmt(cap) : '∞'}{unit && ` ${unit}`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100"
        role="progressbar" aria-label={String(label ?? "")} aria-valuenow={used} aria-valuemin={0} aria-valuemax={cap || undefined}>
        <div className={cx('h-full rounded-full transition-all duration-500', tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

interface UsageMeterProps {
  title?: string
  plan?: any
  renews?: any
  metrics?: any[]
  upgradeTo?: any
  upgradeLabel?: string
  className?: string
}

export default function UsageMeter({ title = 'Plan usage', plan, renews, metrics = [], upgradeTo, upgradeLabel = 'Upgrade plan', className }: UsageMeterProps) {
  const maxed = metrics.some((m) => m.cap > 0 && m.used / m.cap >= 0.85)
  return (
    <div className={cx('card-surface p-5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
        {plan && <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">{plan}</span>}
      </div>
      {renews && <p className="mt-0.5 text-xs text-ink-400">Renews {renews}</p>}
      <div className="mt-4 space-y-4">
        {metrics.map((m, i) => <UsageBar key={i} {...m} />)}
      </div>
      {upgradeTo && (
        <Link to={upgradeTo}
          className={cx('mt-5 block rounded-xl px-4 py-2.5 text-center text-sm font-medium transition',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            maxed ? 'bg-brand-600 text-brandfg hover:bg-brand-700' : 'border border-ink-200 text-ink-700 hover:bg-ink-50')}>
          {upgradeLabel}
        </Link>
      )}
    </div>
  )
}
