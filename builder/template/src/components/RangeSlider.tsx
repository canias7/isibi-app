import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface RangeSliderProps {
  value?: any[]
  onChange?: (...args: any[]) => any
  min?: number
  max?: number
  step?: number
  label?: ReactNode
  format?: (...args: any[]) => any
  className?: string
}

// RangeSlider — a two-handle min/max range. The filter every marketplace, property site and shop needs
// (price, distance, size). value = [min, max]; the handles are two stacked range inputs, so keyboard and
// touch work for free. format(v) controls the readout.
export default function RangeSlider({
  value = [0, 100], onChange, min = 0, max = 100, step = 1,
  label, format = (v) => v, className,
}: RangeSliderProps) {
  const [lo, hi] = value
  const span = max - min || 1
  const pct = (v) => ((v - min) / span) * 100
  const setLo = (v) => onChange && onChange([Math.min(Number(v), hi), hi])
  const setHi = (v) => onChange && onChange([lo, Math.max(Number(v), lo)])
  // The two inputs overlap, so only the handles may receive pointer events — otherwise the top track
  // swallows every click and the lower handle becomes undraggable.
  const thumb = 'pointer-events-none absolute inset-x-0 top-1/2 h-5 w-full -translate-y-1/2 appearance-none bg-transparent ' +
    '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 ' +
    '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 ' +
    '[&::-webkit-slider-thumb]:border-brand-500 [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-sm ' +
    '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 ' +
    '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand-500 ' +
    '[&::-moz-range-thumb]:bg-surface focus-visible:outline-none'
  return (
    <div className={className}>
      {label && (
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-ink-700">{label}</span>
          <span className="tabular-nums text-ink-500">{format(lo)} – {format(hi)}</span>
        </div>
      )}
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ink-100" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-500"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input type="range" min={min} max={max} step={step} value={lo} onChange={(e) => setLo((e.target as any).value)}
          aria-label={label ? `${label} minimum` : 'Minimum'} className={thumb} />
        <input type="range" min={min} max={max} step={step} value={hi} onChange={(e) => setHi((e.target as any).value)}
          aria-label={label ? `${label} maximum` : 'Maximum'} className={thumb} />
      </div>
    </div>
  )
}
