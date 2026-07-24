import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { Sparkline } from './Chart.jsx'
import { cx } from '../lib/cx.js'

// VitalsGrid — measurements with a normal range, so out-of-range values flag themselves.
// Clinical vitals, lab results, sensor readings, environmental monitoring — anywhere a number is only
// meaningful against a reference band.
// vitals: [{label, value, unit, low, high, at, trend:[numbers]}]
export default function VitalsGrid({ vitals = [], columns = 3, title, className }) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }
  return (
    <div className={className}>
      {title && <h3 className="mb-3 font-display text-base font-semibold text-ink-900">{title}</h3>}
      <div className={cx('grid gap-4', cols[columns] || cols[3])}>
        {vitals.map((v, i) => {
          const n = Number(v.value)
          const low = v.low != null && n < v.low
          const high = v.high != null && n > v.high
          const off = low || high
          const Icon = high ? ArrowUp : low ? ArrowDown : Minus
          return (
            <div key={i} className={cx('rounded-xl2 border p-4', off ? 'border-amber-300 bg-amber-50/60' : 'border-ink-100 bg-surface')}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-ink-400">{v.label}</p>
                {off && (
                  <span className={cx('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    high ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700')}>
                    <Icon size={9} />{high ? 'High' : 'Low'}
                  </span>
                )}
              </div>
              <p className="mt-1.5 font-display text-2xl font-bold tabular-nums tracking-tight text-ink-900">
                {v.value}{v.unit && <span className="ml-1 text-base font-medium text-ink-500">{v.unit}</span>}
              </p>
              {v.trend && v.trend.length > 1 && <Sparkline data={v.trend} className="mt-2 h-8" />}
              <p className="mt-2 text-[11px] text-ink-400">
                {v.low != null || v.high != null
                  ? `Normal ${v.low ?? '–'}–${v.high ?? '–'}${v.unit ? ` ${v.unit}` : ''}`
                  : v.at}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
