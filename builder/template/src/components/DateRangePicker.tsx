import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cx } from '../lib/cx.js'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const nights = (a, b) => Math.max(0, Math.round((+new Date(b) - +new Date(a)) / 86400000))

interface DateRangePickerProps {
  value?: Record<string, any>
  onChange?: (...args: any[]) => any
  minDate?: any
  months?: number
  nightsLabel?: string
  className?: string
}

// DateRangePicker — check-in/check-out, trip dates, a reporting period. Calendar handles ONE date; this is the
// two-date case, which is a different interaction: the first click sets the start, the second sets the end, and
// hovering between them previews the span.
// value = {start, end} as 'YYYY-MM-DD'. Set `nightsLabel` to '' to hide the count.
export default function DateRangePicker({
  value = {}, onChange, minDate, months = 2, nightsLabel = 'nights', className,
}: DateRangePickerProps) {
  const base = value.start ? new Date(value.start + 'T00:00:00') : new Date()
  const [view, setView] = useState(new Date(base.getFullYear(), base.getMonth(), 1))
  const [hover, setHover] = useState(null)
  const { start, end } = value

  const pick = (d) => {
    if (!onChange) return
    // No start yet, or a complete range already → start over from this day.
    if (!start || (start && end)) return onChange({ start: d, end: '' })
    if (d < start) return onChange({ start: d, end: '' }) // clicked before the start → treat as a new start
    onChange({ start, end: d })
  }

  const inSpan = (d) => {
    const stop = end || (start && hover && hover > start ? hover : null)
    return start && stop && d > start && d < stop
  }

  const month = (offset) => {
    const m = new Date(view.getFullYear(), view.getMonth() + offset, 1)
    const y = m.getFullYear(), mo = m.getMonth()
    const cells = [...Array(new Date(y, mo, 1).getDay()).fill(null),
      ...Array.from({ length: new Date(y, mo + 1, 0).getDate() }, (_, i) => i + 1)]
    return (
      <div key={offset} className="min-w-0 flex-1">
        <p className="mb-3 text-center font-display text-sm font-semibold text-ink-900">
          {m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </p>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {DAYS.map((d) => <span key={d} className="pb-1 text-[11px] font-medium text-ink-400">{d}</span>)}
          {cells.map((day, i) => {
            if (!day) return <span key={i} />
            const d = iso(new Date(y, mo, day))
            const disabled = minDate && d < minDate
            const isStart = d === start, isEnd = d === end
            const between = inSpan(d)
            return (
              <div key={i} className={cx('relative py-0.5',
                // The connecting band is drawn on the CELL, not the button, so the range reads as one continuous
                // strip instead of a row of detached circles.
                between && 'bg-brand-50', isStart && end && 'rounded-l-full bg-brand-50', isEnd && 'rounded-r-full bg-brand-50')}>
                <button type="button" disabled={disabled} onClick={() => pick(d)} onMouseEnter={() => setHover(d)}
                  aria-label={String(d ?? "")} aria-pressed={isStart || isEnd}
                  className={cx('mx-auto grid h-9 w-9 place-items-center rounded-full text-sm transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    disabled ? 'cursor-not-allowed text-ink-300'
                      : isStart || isEnd ? 'bg-brand-500 font-semibold text-brandfg'
                      : between ? 'text-brand-800' : 'text-ink-700 hover:bg-ink-100')}>
                  {day}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={cx('card-surface p-4', className)} onMouseLeave={() => setHover(null)}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          className="rounded-lg p-1.5 text-ink-500 transition hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><ChevronLeft size={16} /></button>
        <p className="text-xs text-ink-500">
          {start && end ? `${start} → ${end}${nightsLabel ? ` · ${nights(start, end)} ${nightsLabel}` : ''}`
            : start ? 'Now pick the end date' : 'Pick a start date'}
        </p>
        <button type="button" aria-label="Next month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          className="rounded-lg p-1.5 text-ink-500 transition hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><ChevronRight size={16} /></button>
      </div>
      <div className="flex flex-col gap-6 sm:flex-row">
        {Array.from({ length: Math.max(1, months) }, (_, i) => month(i))}
      </div>
    </div>
  )
}
