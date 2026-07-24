import { Clock } from 'lucide-react'
import { cx } from '../lib/cx.js'

// KitchenTicket — the STAFF-side order docket for a kitchen display or prep station. Deliberately high
// contrast and large type: it is read across a room, in a hurry, not browsed. Ages from neutral → amber →
// red as the order sits, because time-since-ordered is the only thing that matters on a pass.
export default function KitchenTicket({
  number, table, type = 'Dine in', placedAt, minutesAgo = 0, items = [], note, onBump, bumpLabel = 'Ready', className,
}) {
  const heat = minutesAgo >= 15 ? 'border-rose-500 bg-rose-50' : minutesAgo >= 8 ? 'border-amber-500 bg-amber-50' : 'border-ink-200 bg-surface'
  const clock = minutesAgo >= 15 ? 'text-rose-700' : minutesAgo >= 8 ? 'text-amber-700' : 'text-ink-500'
  return (
    <article className={cx('flex flex-col overflow-hidden rounded-xl2 border-2', heat, className)}>
      <header className="flex items-baseline justify-between gap-3 border-b border-ink-200/70 px-4 py-2.5">
        <span className="font-display text-xl font-bold tabular-nums text-ink-900">#{number}</span>
        <span className="text-sm font-medium text-ink-700">{table ? `Table ${table}` : type}</span>
        <span className={cx('inline-flex items-center gap-1 text-sm font-semibold tabular-nums', clock)}>
          <Clock size={14} />{minutesAgo}m
        </span>
      </header>
      <ul className="flex-1 divide-y divide-ink-200/60">
        {items.map((it, i) => (
          <li key={i} className="px-4 py-2.5">
            <div className="flex gap-3">
              <span className="font-display text-lg font-bold tabular-nums text-ink-900">{it.qty || 1}×</span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold uppercase leading-tight tracking-wide text-ink-900">{it.name}</span>
                {it.modifiers && it.modifiers.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {it.modifiers.map((m, j) => <li key={j} className="text-sm text-ink-600">— {m}</li>)}
                  </ul>
                )}
                {it.note && <span className="mt-1 block text-sm font-semibold text-rose-700">! {it.note}</span>}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {note && <p className="border-t border-ink-200/70 px-4 py-2 text-sm font-semibold text-rose-700">! {note}</p>}
      {placedAt && <p className="px-4 pt-2 text-xs tabular-nums text-ink-400">Ordered {placedAt}</p>}
      {onBump && (
        <button type="button" onClick={onBump}
          className="mt-2 bg-ink-900 py-3 text-sm font-semibold uppercase tracking-wider text-canvas transition hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400">
          {bumpLabel}
        </button>
      )}
    </article>
  )
}
