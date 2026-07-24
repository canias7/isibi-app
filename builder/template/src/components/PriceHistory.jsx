import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cx } from '../lib/cx.js'

// PriceHistory — how an asking price has moved: listings, vehicles, tickets, tracked products.
// entries: [{date, price, value, event}] newest first. The delta between rows is computed here, since that
// is the whole reason a buyer reads this table.
export default function PriceHistory({ entries = [], title = 'Price history', currency = '', className }) {
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      <h3 className="border-b border-ink-100 px-5 py-4 font-display text-base font-semibold text-ink-900">{title}</h3>
      <ul className="divide-y divide-ink-100">
        {entries.map((e, i) => {
          const prev = entries[i + 1]
          const delta = prev && typeof e.value === 'number' && typeof prev.value === 'number' ? e.value - prev.value : 0
          const pct = delta && prev.value ? (delta / prev.value) * 100 : 0
          const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus
          return (
            <li key={i} className="flex items-center gap-4 px-5 py-3">
              <span className="w-24 shrink-0 text-xs tabular-nums text-ink-400">{e.date}</span>
              <span className="min-w-0 flex-1 text-sm text-ink-600">{e.event || 'Price changed'}</span>
              <span className="shrink-0 text-right">
                <span className="block font-medium tabular-nums text-ink-900">{currency}{e.price}</span>
                {delta !== 0 && (
                  <span className={cx('inline-flex items-center gap-0.5 text-xs tabular-nums', delta > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                    <Icon size={11} />{Math.abs(pct).toFixed(1)}%
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
