import { useId } from 'react'
import { cx } from '../lib/cx.js'
import type React from 'react'
import type { ReactNode } from 'react'

type SliderProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'onChange'> & {
  label?: ReactNode
  value?: number
  min?: number
  max?: number
  step?: number
  onChange?: (...args: any[]) => any
  format?: any
  className?: string
}

export default function Slider({ label, value = 0, min = 0, max = 100, step = 1, onChange, format, className, ...props }: SliderProps) {
  const id = useId()
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div className={cx('w-full', className)}>
      {label && (
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor={id} className="text-sm font-medium text-ink-800">{label}</label>
          <span className="text-sm tabular-nums text-ink-500">{format ? format(value) : value}</span>
        </div>
      )}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange && onChange(Number((e.target as any).value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-ink-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
          [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:shadow
          [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-brand-500"
        style={{ background: `linear-gradient(to right, rgb(74 109 245) ${pct}%, rgb(220 220 225) ${pct}%)` }}
        {...props}
      />
    </div>
  )
}
