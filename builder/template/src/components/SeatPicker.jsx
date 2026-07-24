import { cx } from '../lib/cx.js'

// SeatPicker — venue seat selection for ticketing. rows: [{row:'A', seats:[{id,taken,tier}]}]
export default function SeatPicker({ rows = [], value = [], onChange, tiers = {}, maxSeats, className }) {
  const toggle = (id, taken) => {
    if (taken || !onChange) return
    if (value.includes(id)) return onChange(value.filter((s) => s !== id))
    if (maxSeats && value.length >= maxSeats) return
    onChange([...value, id])
  }
  return (
    <div className={cx('space-y-4', className)}>
      <div className="rounded-lg bg-ink-100 py-2 text-center text-xs font-medium uppercase tracking-widest text-ink-500">Stage</div>
      <div className="space-y-2 overflow-x-auto">
        {rows.map((r) => (
          <div key={r.row} className="flex items-center justify-center gap-1.5">
            <span className="w-5 shrink-0 text-xs font-medium text-ink-400">{r.row}</span>
            {r.seats.map((s) => {
              const picked = value.includes(s.id)
              return (
                <button key={s.id} type="button" disabled={s.taken} onClick={() => toggle(s.id, s.taken)}
                  aria-label={`Seat ${s.id}${s.taken ? ' (taken)' : ''}`} aria-pressed={picked}
                  className={cx('h-7 w-7 shrink-0 rounded-t-lg text-[10px] font-medium transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    picked ? 'bg-brand-500 text-brandfg'
                      : s.taken ? 'cursor-not-allowed bg-ink-200 text-ink-300'
                      : 'bg-ink-100 text-ink-500 hover:bg-brand-200')}>
                  {s.label || ''}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-4 text-xs text-ink-500">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-t bg-ink-100" />Available</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-t bg-brand-500" />Selected</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-t bg-ink-200" />Taken</span>
      </div>
    </div>
  )
}
