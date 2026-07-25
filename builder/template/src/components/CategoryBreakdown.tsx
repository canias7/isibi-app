import { cx } from '../lib/cx.js'

interface CategoryBreakdownProps {
  categories?: any[]
  total?: any
  currency?: string
  title?: string
  onSelect?: (...args: any[]) => any
  className?: string
}

// CategoryBreakdown — where the money went, as a single stacked bar plus a ranked list. Reads faster than a
// pie for 6+ categories, and the per-row change tells you what actually moved.
// categories: [{label, value, change, icon, className}]
export default function CategoryBreakdown({
  categories = [], total, currency = '$', title = 'By category', onSelect, className,
}: CategoryBreakdownProps) {
  const sum = total ?? categories.reduce((s, c) => s + (c.value || 0), 0)
  const sorted = [...categories].sort((a, b) => (b.value || 0) - (a.value || 0))
  const tones = ['bg-brand-500', 'bg-accent-500', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-rose-400', 'bg-amber-500', 'bg-ink-400']
  const money = (n) => currency + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })
  return (
    <div className={cx('card-surface p-5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
        <span className="font-display text-lg font-semibold tabular-nums text-ink-900">{money(sum)}</span>
      </div>
      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-ink-100" role="img" aria-label="Category split">
        {sorted.map((c, i) => (
          <span key={i} className={cx('transition-all duration-500', c.className || tones[i % tones.length])}
            style={{ width: `${sum ? ((c.value || 0) / sum) * 100 : 0}%` }} title={`${c.label}: ${money(c.value)}`} />
        ))}
      </div>
      <ul className="mt-4 divide-y divide-ink-100">
        {sorted.map((c, i) => {
          const pct = sum ? ((c.value || 0) / sum) * 100 : 0
          const Icon = c.icon
          const inner = (
            <>
              <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', c.className || tones[i % tones.length])} />
              {Icon && <Icon size={15} className="shrink-0 text-ink-400" />}
              <span className="min-w-0 flex-1 truncate text-sm text-ink-700">{c.label}</span>
              {c.change && (
                <span className={cx('shrink-0 text-xs tabular-nums', String(c.change).startsWith('-') ? 'text-emerald-600' : 'text-rose-600')}>{c.change}</span>
              )}
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-400">{pct.toFixed(0)}%</span>
              <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums text-ink-900">{money(c.value)}</span>
            </>
          )
          return (
            <li key={i}>
              {onSelect
                ? <button type="button" onClick={() => onSelect(c)} className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{inner}</button>
                : <div className="flex items-center gap-3 py-2.5">{inner}</div>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
