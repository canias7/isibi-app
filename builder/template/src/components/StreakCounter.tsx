import { Flame } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface StreakCounterProps {
  current?: number
  best?: any
  days?: any[]
  unit?: string
  label?: string
  freezeLeft?: any
  className?: string
}

// StreakCounter — consecutive-days habit tracking with the last N days shown as dots. Fitness, learning,
// journalling, savings — anything where the streak IS the motivation.
// days: array of booleans, oldest first (or [{done, label}]).
export default function StreakCounter({
  current = 0, best, days = [], unit = 'day', label = 'Current streak', freezeLeft, className,
}: StreakCounterProps) {
  const dots = days.map((d) => (typeof d === 'boolean' ? { done: d } : d))
  const plural = current === 1 ? unit : `${unit}s`
  const hot = current >= 7
  return (
    <div className={cx('card-surface p-5', className)}>
      <div className="flex items-center gap-4">
        <span className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-full',
          hot ? 'bg-accent-100 text-accent-600' : 'bg-ink-100 text-ink-400')}>
          <Flame size={22} className={hot ? 'fill-accent-500 text-accent-500' : ''} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">{label}</p>
          <p className="font-display text-2xl font-bold tabular-nums tracking-tight text-ink-900">
            {current} <span className="text-base font-medium text-ink-500">{plural}</span>
          </p>
        </div>
        {best != null && (
          <div className="shrink-0 text-right">
            <p className="text-xs text-ink-400">Best</p>
            <p className="font-display text-lg font-semibold tabular-nums text-ink-700">{best}</p>
          </div>
        )}
      </div>
      {dots.length > 0 && (
        <div className="mt-4 flex items-center gap-1.5">
          {dots.map((d, i) => (
            <span key={i} title={d.label}
              className={cx('h-2.5 flex-1 rounded-full', d.done ? 'bg-brand-500' : 'bg-ink-100')} />
          ))}
        </div>
      )}
      {freezeLeft != null && (
        <p className="mt-3 text-xs text-ink-400">{freezeLeft} streak freeze{freezeLeft === 1 ? '' : 's'} left</p>
      )}
    </div>
  )
}
