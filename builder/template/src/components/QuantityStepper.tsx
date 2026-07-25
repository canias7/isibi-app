import { Minus, Plus } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface QuantityStepperProps {
  value?: number
  onChange?: (...args: any[]) => any
  min?: number
  max?: number
  size?: string
  className?: string
}

// QuantityStepper — cart / line-item quantity control.
export default function QuantityStepper({ value = 1, onChange, min = 1, max = 99, size = 'md', className }: QuantityStepperProps) {
  const btn = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  const set = (v) => onChange && onChange(Math.min(max, Math.max(min, v)))
  return (
    <div className={cx('inline-flex items-center rounded-xl border border-ink-200 bg-surface', className)}>
      <button type="button" aria-label="Decrease" onClick={() => set(value - 1)} disabled={value <= min}
        className={cx(btn, 'grid place-items-center rounded-l-xl text-ink-600 transition hover:bg-ink-50 disabled:opacity-40')}>
        <Minus size={14} />
      </button>
      <span className={cx('min-w-9 text-center text-sm font-medium tabular-nums text-ink-900')}>{value}</span>
      <button type="button" aria-label="Increase" onClick={() => set(value + 1)} disabled={value >= max}
        className={cx(btn, 'grid place-items-center rounded-r-xl text-ink-600 transition hover:bg-ink-50 disabled:opacity-40')}>
        <Plus size={14} />
      </button>
    </div>
  )
}
