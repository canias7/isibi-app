import { useId } from 'react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface DurationInputProps {
  value?: number
  onChange?: (...args: any[]) => any
  label?: string
  hint?: ReactNode
  error?: ReactNode
  maxHours?: number
  step?: number
  presets?: number[]
  className?: string
}

// DurationInput — enter a length of time as hours + minutes, stored as a single number of MINUTES.
// Timesheets, bookings, cooking steps, session lengths. A plain "minutes" box makes people do arithmetic;
// a plain time picker means "when", not "how long".
export default function DurationInput({
  value = 0, onChange, label = 'Duration', hint, error, maxHours = 23, step = 5, presets = [], className,
}: DurationInputProps) {
  const id = useId()
  const hours = Math.floor((value || 0) / 60)
  const minutes = (value || 0) % 60
  const set = (h, m) => onChange && onChange(Math.max(0, h) * 60 + Math.max(0, Math.min(59, m)))
  const field = 'w-full rounded-xl border bg-surface px-3 py-2.5 text-sm tabular-nums text-ink-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none'
  return (
    <div className={className}>
      {label && <label htmlFor={`${id}-h`} className="mb-1.5 block text-sm font-medium text-ink-700">{label}</label>}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input id={`${id}-h`} type="number" min={0} max={maxHours} value={hours}
            onChange={(e) => set(Number((e.target as any).value) || 0, minutes)} aria-label="Hours"
            className={cx(field, 'pr-8', error ? 'border-rose-400' : 'border-ink-200 hover:border-ink-300')} />
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-ink-400">h</span>
        </div>
        <div className="relative flex-1">
          <input id={`${id}-m`} type="number" min={0} max={59} step={step} value={minutes}
            onChange={(e) => set(hours, Number((e.target as any).value) || 0)} aria-label="Minutes"
            className={cx(field, 'pr-9', error ? 'border-rose-400' : 'border-ink-200 hover:border-ink-300')} />
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-ink-400">min</span>
        </div>
      </div>
      {presets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button key={p} type="button" onClick={() => onChange && onChange(p)}
              className={cx('rounded-full border px-2.5 py-0.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                value === p ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:border-ink-400')}>
              {p >= 60 ? `${Math.floor(p / 60)}h${p % 60 ? ` ${p % 60}m` : ''}` : `${p}m`}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
      {!error && hint && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
    </div>
  )
}
