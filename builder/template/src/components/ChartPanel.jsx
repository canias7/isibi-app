import { useState } from 'react'
import SegmentedControl from './SegmentedControl.jsx'
import { cx } from '../lib/cx.js'

// ChartPanel — a titled chart card with an optional range switcher and summary figure.
export default function ChartPanel({ title, subtitle, value, delta, ranges, range, onRangeChange, actions, children, className }) {
  const [internal, setInternal] = useState(ranges && ranges[0] && (ranges[0].value || ranges[0]))
  const active = range !== undefined ? range : internal
  const set = (v) => { if (range === undefined) setInternal(v); if (onRangeChange) onRangeChange(v) }
  return (
    <div className={cx('card-surface p-5', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
          {value != null && (
            <p className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold tabular-nums text-ink-900">{value}</span>
              {delta != null && (
                <span className={cx('text-sm font-medium', delta >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                  {delta >= 0 ? '+' : ''}{delta}%
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ranges && (
            <SegmentedControl size="sm" value={active} onChange={set}
              options={ranges.map((r) => (typeof r === 'string' ? { value: r, label: r } : r))} />
          )}
          {actions}
        </div>
      </div>
      {children}
    </div>
  )
}
