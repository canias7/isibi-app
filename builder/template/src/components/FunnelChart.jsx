import { cx } from '../lib/cx.js'

// FunnelChart — conversion stages with drop-off between them: signup funnels, sales pipelines, checkout steps,
// application flows. steps: [{label, value, hint}] in descending order.
export default function FunnelChart({ steps = [], title, valueLabel = '', showDropOff = true, className }) {
  if (!steps.length) return null
  const top = steps[0].value || 1
  return (
    <div className={cx('card-surface p-5', className)}>
      {title && <h3 className="mb-4 font-display text-base font-semibold text-ink-900">{title}</h3>}
      <ol className="space-y-1">
        {steps.map((s, i) => {
          const pct = Math.max(0, Math.min(100, (s.value / top) * 100))
          const prev = i > 0 ? steps[i - 1].value : null
          const drop = prev ? prev - s.value : 0
          const dropPct = prev && prev > 0 ? (drop / prev) * 100 : 0
          return (
            <li key={i}>
              {i > 0 && showDropOff && (
                <div className="flex items-center gap-2 py-1 pl-1 text-xs">
                  <span className="h-3 w-px bg-ink-200" aria-hidden="true" />
                  <span className={cx('tabular-nums', dropPct > 50 ? 'text-rose-500' : 'text-ink-400')}>
                    −{drop.toLocaleString()} ({dropPct.toFixed(0)}% drop-off)
                  </span>
                </div>
              )}
              <div className="relative overflow-hidden rounded-lg bg-ink-100">
                {/* The bar is the background, the labels sit on top — so a narrow final stage still reads. */}
                <div className="absolute inset-y-0 left-0 bg-brand-500/85 transition-all duration-500" style={{ width: `${pct}%` }} />
                <div className="relative flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate font-medium text-ink-900">{s.label}</span>
                  <span className="shrink-0 tabular-nums text-ink-700">
                    {s.value.toLocaleString()}{valueLabel && ` ${valueLabel}`}
                    <span className="ml-2 text-xs text-ink-500">{pct.toFixed(0)}%</span>
                  </span>
                </div>
              </div>
              {s.hint && <p className="mt-1 pl-3 text-xs text-ink-400">{s.hint}</p>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
