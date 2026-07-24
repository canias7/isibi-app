import { Check } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface StepperProps {
  steps?: any[]
  current?: number
  className?: string
}

// Stepper — multi-step flows (checkout, booking, onboarding). `steps` = [{label}], `current` is 0-based.
export default function Stepper({ steps = [], current = 0, className }: StepperProps) {
  return (
    <ol className={cx('flex items-center gap-2', className)}>
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={i} className="flex flex-1 items-center gap-2 last:flex-none">
            <span className={cx(
              'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition',
              done ? 'bg-brand-500 text-brandfg' : active ? 'border-2 border-brand-500 bg-surface text-brand-700' : 'bg-ink-100 text-ink-400'
            )}>
              {done ? <Check size={15} strokeWidth={3} /> : i + 1}
            </span>
            <span className={cx('hidden text-sm sm:block', active ? 'font-medium text-ink-900' : 'text-ink-500')}>
              {s.label || s}
            </span>
            {i < steps.length - 1 && <span className={cx('h-px flex-1', done ? 'bg-brand-500' : 'bg-ink-200')} />}
          </li>
        )
      })}
    </ol>
  )
}
