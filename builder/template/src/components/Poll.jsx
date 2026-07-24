import { cx } from '../lib/cx.js'

// Poll — community/forum voting. options: [{id, label, votes}]. Shows bars once voted (or `showResults`).
export default function Poll({ question, options = [], value, onVote, showResults = false, totalLabel = 'votes', className }) {
  const total = options.reduce((s, o) => s + (o.votes || 0), 0)
  const revealed = showResults || value != null
  return (
    <div className={cx('card-surface p-5', className)}>
      <h3 className="font-display text-base font-semibold text-ink-900">{question}</h3>
      <ul className="mt-4 space-y-2">
        {options.map((o) => {
          const pct = total ? Math.round(((o.votes || 0) / total) * 100) : 0
          const picked = value === o.id
          return (
            <li key={o.id}>
              <button type="button" disabled={revealed} onClick={() => onVote && onVote(o.id)}
                className={cx('relative w-full overflow-hidden rounded-xl border px-4 py-2.5 text-left text-sm transition',
                  picked ? 'border-brand-500' : 'border-ink-200',
                  !revealed && 'hover:border-brand-300 hover:bg-brand-50')}>
                {revealed && <span className="absolute inset-y-0 left-0 bg-brand-100 transition-all duration-500" style={{ width: `${pct}%` }} />}
                <span className="relative flex items-center justify-between gap-3">
                  <span className={cx('truncate', picked ? 'font-medium text-brand-700' : 'text-ink-800')}>{o.label}</span>
                  {revealed && <span className="shrink-0 text-xs font-medium tabular-nums text-ink-500">{pct}%</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {revealed && <p className="mt-3 text-xs text-ink-400">{total} {totalLabel}</p>}
    </div>
  )
}
