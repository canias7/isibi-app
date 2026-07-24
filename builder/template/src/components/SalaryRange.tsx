import { cx } from '../lib/cx.js'

interface SalaryRangeProps {
  min?: number
  max?: number
  median?: any
  marker?: any
  markerLabel?: string
  currency?: string
  period?: string
  label?: string
  format?: any
  className?: string
}

// SalaryRange — a pay band drawn as a bar, with the market median and (optionally) the candidate's ask
// marked on it. Turns "£60k–£85k" into something a reader can place themselves against.
export default function SalaryRange({
  min, max, median, marker, markerLabel = 'Your ask', currency = '$', period = 'a year', label = 'Salary range', format, className,
}: SalaryRangeProps) {
  const fmt = format || ((n) => currency + Number(n).toLocaleString())
  const span = (max - min) || 1
  const at = (v) => Math.max(0, Math.min(100, ((v - min) / span) * 100))
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink-700">{label}</span>
        <span className="font-display text-base font-semibold tabular-nums text-ink-900">
          {fmt(min)} – {fmt(max)} <span className="text-sm font-normal text-ink-500">{period}</span>
        </span>
      </div>
      <div className="relative mt-4 h-2 rounded-full bg-gradient-to-r from-brand-200 via-brand-400 to-brand-600">
        {median != null && (
          <span className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded bg-ink-900" style={{ left: `${at(median)}%` }} aria-hidden="true" />
        )}
        {marker != null && (
          <span className="absolute -top-1.5 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-accent-500 bg-surface shadow-sm"
            style={{ left: `${at(marker)}%` }} aria-label={`${markerLabel}: ${fmt(marker)}`} />
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs tabular-nums text-ink-400">
        <span>{fmt(min)}</span>
        {median != null && <span className="font-medium text-ink-600">Median {fmt(median)}</span>}
        <span>{fmt(max)}</span>
      </div>
      {marker != null && (
        <p className="mt-2 text-xs text-ink-500">
          <span className="inline-block h-2 w-2 rounded-full border-2 border-accent-500 align-middle" /> {markerLabel}: <span className="tabular-nums">{fmt(marker)}</span>
        </p>
      )}
    </div>
  )
}
