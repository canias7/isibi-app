import { CalendarDays, Check } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface OpenHouseListProps {
  slots?: any[]
  value?: any
  onSelect?: (...args: any[]) => any
  title?: string
  emptyText?: string
  className?: string
}

// OpenHouseList — bookable viewing/showing slots on a listing. Sits between TimeSlots (bare times) and
// BookingWidget (a whole flow): each slot carries a full date, a window, and a capacity.
// slots: [{id, day, date, window, spotsLeft, booked}]
export default function OpenHouseList({ slots = [], value, onSelect, title = 'Open house', emptyText = 'No viewings scheduled — request one below.', className }: OpenHouseListProps) {
  if (!slots.length) return <p className={cx('text-sm text-ink-500', className)}>{emptyText}</p>
  return (
    <div className={className}>
      {title && (
        <h3 className="mb-3 inline-flex items-center gap-2 font-display text-base font-semibold text-ink-900">
          <CalendarDays size={16} className="text-brand-500" />{title}
        </h3>
      )}
      <ul className="space-y-2">
        {slots.map((s) => {
          const full = s.spotsLeft === 0
          const on = value === s.id
          return (
            <li key={s.id}>
              <button type="button" disabled={full || s.booked} onClick={() => onSelect && onSelect(s.id)} aria-pressed={on}
                className={cx('flex w-full items-center gap-4 rounded-xl border p-3.5 text-left transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  full ? 'cursor-not-allowed border-ink-100 opacity-55'
                    : on ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-ink-400')}>
                <span className="w-14 shrink-0 text-center">
                  <span className="block text-xs uppercase tracking-wider text-ink-400">{s.day}</span>
                  <span className="block font-display text-lg font-semibold leading-tight text-ink-900">{s.date}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink-900">{s.window}</span>
                  <span className={cx('block text-xs', full ? 'text-rose-600' : 'text-ink-500')}>
                    {s.booked ? 'You are booked in' : full ? 'Fully booked' : s.spotsLeft != null ? `${s.spotsLeft} spots left` : 'Open'}
                  </span>
                </span>
                {(on || s.booked) && <Check size={16} className="shrink-0 text-brand-600" />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
