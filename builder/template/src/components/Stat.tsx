import { TrendingUp, TrendingDown } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'
import { renderIcon, type IconSlot } from '../lib/icon.tsx'

interface StatProps {
  label?: ReactNode
  value?: any
  delta?: any
  deltaLabel?: any
  icon?: IconSlot
  hint?: ReactNode
  invertDelta?: boolean
  className?: string
}

// Stat — a KPI tile for dashboards. `delta` is a signed number (percent); positive is good unless invertDelta.
export default function Stat({ label, value, delta, deltaLabel, icon, hint, invertDelta = false, className }: StatProps) {
  const up = typeof delta === 'number' && delta >= 0
  const good = invertDelta ? !up : up
  return (
    <div className={cx('card-surface p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-ink-500">{label}</span>
        {icon && <span className="text-ink-300">{renderIcon(icon, 18)}</span>}
      </div>
      <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">{value}</div>
      {(delta != null || hint) && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          {delta != null && (
            <span className={cx('inline-flex items-center gap-1 font-medium', good ? 'text-emerald-600' : 'text-rose-600')}>
              {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {Math.abs(delta)}%
            </span>
          )}
          {(deltaLabel || hint) && <span className="text-ink-400">{deltaLabel || hint}</span>}
        </div>
      )}
    </div>
  )
}
