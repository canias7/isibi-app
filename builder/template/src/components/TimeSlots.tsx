import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface TimeSlotsProps {
  slots?: any[]
  value?: any
  onChange?: (...args: any[]) => any
  label?: ReactNode
  emptyText?: string
  className?: string
}

// TimeSlots — appointment/booking slot picker. slots: ['09:00','09:30',…] or [{time, taken}].
export default function TimeSlots({ slots = [], value, onChange, label, emptyText = 'No times available', className }: TimeSlotsProps) {
  const items = slots.map((s) => (typeof s === 'string' ? { time: s, taken: false } : s))
  return (
    <div className={className}>
      {label && <span className="mb-2 block text-sm font-medium text-ink-800">{label}</span>}
      {items.length === 0 ? (
        <p className="rounded-xl bg-ink-50 px-4 py-6 text-center text-sm text-ink-400">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((s) => (
            <button key={s.time} type="button" disabled={s.taken} onClick={() => onChange && onChange(s.time)}
              className={cx('rounded-xl border px-3 py-2.5 text-sm font-medium tabular-nums transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                value === s.time ? 'border-brand-500 bg-brand-500 text-brandfg'
                  : s.taken ? 'cursor-not-allowed border-ink-100 bg-ink-50 text-ink-300 line-through'
                  : 'border-ink-200 bg-surface text-ink-700 hover:border-brand-300 hover:bg-brand-50')}>
              {s.time}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
