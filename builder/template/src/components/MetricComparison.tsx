import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface MetricComparisonProps {
  metrics?: any[]
  currentLabel?: string
  previousLabel?: string
  title?: ReactNode
  className?: string
}

// MetricComparison — this period against the last one, per metric. Stat shows one KPI with a delta; this
// shows the BOTH values side by side, which is what a "vs last month" report actually needs.
// metrics: [{label, current, previous, format, invert, unit}]
export default function MetricComparison({
  metrics = [], currentLabel = 'This period', previousLabel = 'Last period', title, className,
}: MetricComparisonProps) {
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      {title && <h3 className="border-b border-ink-100 px-5 py-4 font-display text-base font-semibold text-ink-900">{title}</h3>}
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        <span>Metric</span><span className="text-right">{previousLabel}</span><span className="text-right">{currentLabel}</span><span className="text-right">Change</span>
      </div>
      <ul className="divide-y divide-ink-100">
        {metrics.map((m, i) => {
          const fmt = m.format || ((n) => Number(n).toLocaleString())
          const delta = m.current - m.previous
          const pct = m.previous ? (delta / Math.abs(m.previous)) * 100 : 0
          // `invert` marks metrics where DOWN is good (churn, cost, response time, bounce rate).
          const good = m.invert ? delta < 0 : delta > 0
          const flat = delta === 0
          const Icon = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight
          return (
            <li key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 px-5 py-3">
              <span className="min-w-0 truncate text-sm text-ink-700">{m.label}</span>
              <span className="text-right text-sm tabular-nums text-ink-400">{fmt(m.previous)}{m.unit}</span>
              <span className="text-right text-sm font-semibold tabular-nums text-ink-900">{fmt(m.current)}{m.unit}</span>
              <span className={cx('inline-flex items-center justify-end gap-0.5 text-sm font-medium tabular-nums',
                flat ? 'text-ink-400' : good ? 'text-emerald-600' : 'text-rose-600')}>
                <Icon size={13} />{flat ? '0%' : `${Math.abs(pct).toFixed(1)}%`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
