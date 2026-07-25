import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface ProgressRingProps {
  value?: number
  max?: number
  size?: number
  thickness?: number
  label?: ReactNode
  tone?: 'brand' | 'success' | 'warning' | 'danger'
  className?: string
}

// ProgressRing — circular progress/gauge (usage meters, scores, completion).
export default function ProgressRing({ value = 0, max = 100, size = 96, thickness = 9, label, tone = 'brand', className }: ProgressRingProps) {
  const pct = Math.min(100, Math.max(0, (value / (max || 1)) * 100))
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const tones = { brand: 'text-brand-500', success: 'text-emerald-500', warning: 'text-accent-400', danger: 'text-rose-500' }
  return (
    <div className={cx('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${Math.round(pct)}%`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={thickness} className="stroke-ink-100" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={thickness} stroke="currentColor" strokeLinecap="round"
          strokeDasharray={`${(pct/100)*c} ${c}`} className={cx('transition-all duration-700', tones[tone])} />
      </svg>
      <div className="absolute text-center">
        <span className="block font-display text-lg font-semibold tabular-nums text-ink-900">{Math.round(pct)}%</span>
        {label && <span className="block text-xs text-ink-400">{label}</span>}
      </div>
    </div>
  )
}
