import { Video } from 'lucide-react'
import { cx } from '../lib/cx.js'

// InterviewSlots — "pick a time that suits you" across several days at once. TimeSlots covers one day;
// this shows a whole week side by side, which is how scheduling links actually work.
// days: [{date, label, slots:[{id, time, taken}]}]
export default function InterviewSlots({
  days = [], value, onSelect, timezone, duration, remote, emptyText = 'No times available', className,
}) {
  return (
    <div className={className}>
      {(timezone || duration) && (
        <p className="mb-3 flex flex-wrap items-center gap-x-3 text-xs text-ink-500">
          {duration && <span>{duration}</span>}
          {remote && <span className="inline-flex items-center gap-1"><Video size={12} />Video call</span>}
          {timezone && <span>Times shown in {timezone}</span>}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {days.map((d) => (
          <div key={d.date} className="min-w-0">
            <div className="mb-2 text-center">
              <p className="text-xs uppercase tracking-wider text-ink-400">{d.label}</p>
              <p className="font-display text-sm font-semibold text-ink-900">{d.date}</p>
            </div>
            <div className="space-y-1.5">
              {d.slots.length === 0 && <p className="py-3 text-center text-xs text-ink-300">{emptyText}</p>}
              {d.slots.map((s) => {
                const on = value === s.id
                return (
                  <button key={s.id} type="button" disabled={s.taken} onClick={() => onSelect && onSelect(s.id, d)}
                    aria-pressed={on}
                    className={cx('w-full rounded-lg border py-2 text-center text-sm tabular-nums transition',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                      s.taken ? 'cursor-not-allowed border-ink-100 text-ink-300 line-through'
                        : on ? 'border-brand-500 bg-brand-500 font-medium text-brandfg'
                        : 'border-ink-200 text-ink-700 hover:border-brand-400 hover:text-brand-700')}>
                    {s.time}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
