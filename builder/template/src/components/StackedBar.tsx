import { cx } from '../lib/cx.js'

interface StackedBarProps {
  data?: any[]
  keys?: any[]
  height?: number
  stacked?: boolean
  valueLabel?: string
  className?: string
}

// StackedBar — composition over time or category. BarChart compares one value per column; this splits each
// column into parts, which is what you need for "revenue by plan, by month".
// data: [{label, values:{key: n}}]  keys: [{key, label, className}]
export default function StackedBar({
  data = [], keys = [], height = 220, stacked = true, valueLabel = '', className,
}: StackedBarProps) {
  if (!data.length || !keys.length) return null
  const tones = ['bg-brand-500', 'bg-accent-500', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-rose-400']
  const toneOf = (k, i) => k.className || tones[i % tones.length]
  const totals = data.map((d) => keys.reduce((s, k) => s + (d.values[k.key] || 0), 0))
  // Grouped mode measures against the single tallest BAR; stacked measures against the tallest COLUMN.
  const max = stacked ? Math.max(...totals, 1)
    : Math.max(...data.flatMap((d) => keys.map((k) => d.values[k.key] || 0)), 1)
  return (
    <div className={className}>
      <div className="flex items-end gap-2 overflow-x-auto" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex h-full min-w-8 flex-1 flex-col justify-end gap-1">
            {stacked ? (
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-md" style={{ height: `${(totals[i] / max) * 100}%` }}>
                {keys.map((k, j) => {
                  const v = d.values[k.key] || 0
                  if (!v) return null
                  return <span key={k.key} className={cx('w-full', toneOf(k, j))} style={{ height: `${(v / (totals[i] || 1)) * 100}%` }}
                    title={`${d.label} · ${k.label}: ${v}${valueLabel}`} />
                })}
              </div>
            ) : (
              <div className="flex h-full w-full items-end gap-0.5">
                {keys.map((k, j) => (
                  <span key={k.key} className={cx('flex-1 rounded-t-sm', toneOf(k, j))}
                    style={{ height: `${((d.values[k.key] || 0) / max) * 100}%` }}
                    title={`${d.label} · ${k.label}: ${d.values[k.key] || 0}${valueLabel}`} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((d, i) => <span key={i} className="min-w-8 flex-1 truncate text-center text-[11px] text-ink-400">{d.label}</span>)}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {keys.map((k, j) => (
          <li key={k.key} className="inline-flex items-center gap-2 text-xs text-ink-600">
            <span className={cx('h-2.5 w-2.5 rounded-sm', toneOf(k, j))} />{k.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
