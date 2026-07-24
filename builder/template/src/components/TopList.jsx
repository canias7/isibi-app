import { Link } from 'react-router-dom'
import { cx } from '../lib/cx.js'

// TopList — "top pages / products / referrers / search terms": a ranked list where each row carries an
// inline bar showing its share. Leaderboard ranks PEOPLE with medals; this is the analytics version.
// items: [{label, value, to, meta, icon}]
export default function TopList({
  items = [], title, valueLabel = '', total, showShare = true, limit, emptyText = 'No data for this period.', className,
}) {
  const rows = limit ? items.slice(0, limit) : items
  const sum = total ?? items.reduce((s, i) => s + (i.value || 0), 0)
  const max = Math.max(...rows.map((i) => i.value || 0), 1)
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      {title && <h3 className="border-b border-ink-100 px-5 py-4 font-display text-base font-semibold text-ink-900">{title}</h3>}
      {rows.length === 0
        ? <p className="px-5 py-10 text-center text-sm text-ink-400">{emptyText}</p>
        : (
          <ul className="divide-y divide-ink-100">
            {rows.map((it, i) => {
              const share = sum ? ((it.value || 0) / sum) * 100 : 0
              const Icon = it.icon
              const inner = (
                <>
                  {/* The bar is a background layer inside the row, so the label sits ON it and long labels
                      never push the number off the end. */}
                  <span className="absolute inset-y-0 left-0 bg-brand-500/10" style={{ width: `${((it.value || 0) / max) * 100}%` }} aria-hidden="true" />
                  <span className="relative w-5 shrink-0 text-xs tabular-nums text-ink-400">{i + 1}</span>
                  {Icon && <Icon size={14} className="relative shrink-0 text-ink-400" />}
                  <span className="relative min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink-800">{it.label}</span>
                    {it.meta && <span className="block truncate text-xs text-ink-400">{it.meta}</span>}
                  </span>
                  {showShare && <span className="relative shrink-0 text-xs tabular-nums text-ink-400">{share.toFixed(1)}%</span>}
                  <span className="relative w-16 shrink-0 text-right text-sm font-medium tabular-nums text-ink-900">
                    {(it.value || 0).toLocaleString()}{valueLabel}
                  </span>
                </>
              )
              const cls = 'relative flex items-center gap-3 overflow-hidden px-5 py-2.5'
              return (
                <li key={i}>
                  {it.to
                    ? <Link to={it.to} className={cx(cls, 'transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500')}>{inner}</Link>
                    : <div className={cls}>{inner}</div>}
                </li>
              )
            })}
          </ul>
        )}
    </div>
  )
}
