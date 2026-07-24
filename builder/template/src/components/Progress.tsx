import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface ProgressProps {
  value?: number
  max?: number
  label?: ReactNode
  showValue?: boolean
  tone?: 'brand' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function Progress({ value = 0, max = 100, label, showValue = false, tone = 'brand', size = 'md', className }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / (max || 1)) * 100))
  const tones = { brand: 'bg-brand-500', success: 'bg-emerald-500', warning: 'bg-accent-400', danger: 'bg-rose-500' }
  const sizes = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' }
  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-sm">
          {label && <span className="font-medium text-ink-700">{label}</span>}
          {showValue && <span className="tabular-nums text-ink-500">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className={cx('w-full overflow-hidden rounded-full bg-ink-100', sizes[size])}
        role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div className={cx('h-full rounded-full transition-all duration-500', tones[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
