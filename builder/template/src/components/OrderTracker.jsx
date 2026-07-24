import { Check } from 'lucide-react'
import { cx } from '../lib/cx.js'

// OrderTracker — delivery / fulfilment progress. steps: [{label, at}] and `current` (0-based).
export default function OrderTracker({ steps = [], current = 0, failed = false, className }) {
  return (
    <ol className={cx('space-y-0', className)}>
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        const last = i === steps.length - 1
        return (
          <li key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold transition',
                failed && active ? 'bg-rose-500 text-canvas'
                  : done ? 'bg-brand-500 text-brandfg'
                  : active ? 'border-2 border-brand-500 bg-surface text-brand-700'
                  : 'bg-ink-100 text-ink-400')}>
                {done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              {!last && <span className={cx('w-px flex-1', done ? 'bg-brand-500' : 'bg-ink-200')} style={{ minHeight: 28 }} />}
            </div>
            <div className={cx('pb-6', last && 'pb-0')}>
              <p className={cx('text-sm', active || done ? 'font-medium text-ink-900' : 'text-ink-400')}>{s.label}</p>
              {s.at && <p className="mt-0.5 text-xs text-ink-400">{s.at}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
