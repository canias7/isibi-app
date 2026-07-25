import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cx } from '../lib/cx.js'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

interface CalendarProps {
  value?: any
  onChange?: (...args: any[]) => any
  marks?: Record<string, any>
  minDate?: any
  className?: string
}

// Calendar — a month grid for bookings/scheduling. `value`/`onChange` use ISO date strings (YYYY-MM-DD).
// `marks` is a map of isoDate → true (or a node) to flag days that have something on them.
export default function Calendar({ value, onChange, marks = {}, minDate, className }: CalendarProps) {
  const start = value ? new Date(value + 'T00:00:00') : new Date()
  const [view, setView] = useState(new Date(start.getFullYear(), start.getMonth(), 1))
  const year = view.getFullYear(), month = view.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const today = iso(new Date())

  return (
    <div className={cx('card-surface p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => setView(new Date(year, month - 1, 1))}
          className="rounded-lg p-1.5 text-ink-500 transition hover:bg-ink-100"><ChevronLeft size={16} /></button>
        <span className="font-display text-sm font-semibold text-ink-900">
          {view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" aria-label="Next month" onClick={() => setView(new Date(year, month + 1, 1))}
          className="rounded-lg p-1.5 text-ink-500 transition hover:bg-ink-100"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAYS.map((d) => <span key={d} className="py-1 text-xs font-medium text-ink-400">{d}</span>)}
        {cells.map((day, i) => {
          if (!day) return <span key={`e${i}`} />
          const ds = iso(new Date(year, month, day))
          const selected = value === ds
          const disabled = minDate && ds < minDate
          return (
            <button key={ds} type="button" disabled={disabled} onClick={() => onChange && onChange(ds)}
              className={cx(
                'relative aspect-square rounded-lg text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                selected ? 'bg-brand-500 font-medium text-brandfg'
                  : disabled ? 'cursor-not-allowed text-ink-300'
                  : 'text-ink-700 hover:bg-ink-100',
                !selected && ds === today && 'font-semibold text-brand-600'
              )}>
              {day}
              {marks[ds] && !selected && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand-500" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
