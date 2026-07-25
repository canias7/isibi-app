import { useEffect, useState } from 'react'
import { cx } from '../lib/cx.js'

interface CountdownProps {
  to?: any
  onComplete?: (...args: any[]) => any
  compact?: boolean
  className?: string
}

// Countdown — event starts / offer ends / auction closes. `to` is a Date or ISO string.
export default function Countdown({ to, onComplete, compact = false, className }: CountdownProps) {
  const target = to instanceof Date ? to.getTime() : new Date(to).getTime()
  const calc = () => Math.max(0, target - Date.now())
  const [left, setLeft] = useState(calc)
  useEffect(() => {
    const t = setInterval(() => {
      const ms = Math.max(0, target - Date.now())
      setLeft(ms)
      if (ms === 0 && onComplete) onComplete()
    }, 1000)
    return () => clearInterval(t)
  }, [target, onComplete])

  const s = Math.floor(left / 1000)
  const parts = [
    { label: 'days', value: Math.floor(s / 86400) },
    { label: 'hrs', value: Math.floor((s % 86400) / 3600) },
    { label: 'min', value: Math.floor((s % 3600) / 60) },
    { label: 'sec', value: s % 60 },
  ]
  if (compact) {
    return <span className={cx('tabular-nums font-medium text-ink-900', className)}>
      {parts.map((p) => String(p.value).padStart(2, '0')).join(':')}
    </span>
  }
  return (
    <div className={cx('flex gap-3', className)}>
      {parts.map((p) => (
        <div key={p.label} className="min-w-16 rounded-xl bg-ink-900 px-3 py-2.5 text-center">
          <div className="font-display text-2xl font-bold tabular-nums text-canvas">{String(p.value).padStart(2, '0')}</div>
          <div className="text-[10px] uppercase tracking-wider text-ink-400">{p.label}</div>
        </div>
      ))}
    </div>
  )
}
