import { cx } from '../lib/cx.js'

// OrderSummary — cart / checkout / invoice totals panel. lines: [{label, value, muted}]
export default function OrderSummary({ title = 'Order summary', items = [], lines = [], total, totalLabel = 'Total', footer, className }) {
  return (
    <div className={cx('card-surface p-5', className)}>
      <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
      {items.length > 0 && (
        <ul className="mt-4 space-y-3 border-b border-ink-100 pb-4">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-3">
              {it.image && <img src={it.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink-900">{it.title}</span>
                {it.meta && <span className="block text-xs text-ink-500">{it.meta}</span>}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-ink-800">{it.price}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-4 space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="flex justify-between text-sm">
            <dt className="text-ink-500">{l.label}</dt>
            <dd className={cx('tabular-nums', l.muted ? 'text-ink-400' : 'text-ink-800')}>{l.value}</dd>
          </div>
        ))}
      </dl>
      {total != null && (
        <div className="mt-4 flex items-baseline justify-between border-t border-ink-100 pt-4">
          <span className="font-display text-sm font-semibold text-ink-900">{totalLabel}</span>
          <span className="font-display text-xl font-bold tabular-nums text-ink-900">{total}</span>
        </div>
      )}
      {footer && <div className="mt-5">{footer}</div>}
    </div>
  )
}
