import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface SeparatorProps {
  label?: ReactNode
  className?: string
}

export default function Separator({ label, className }: SeparatorProps) {
  if (!label) return <hr className={cx('border-ink-100', className)} />
  return (
    <div className={cx('flex items-center gap-3', className)}>
      <span className="h-px flex-1 bg-ink-100" />
      <span className="text-xs font-medium uppercase tracking-wider text-ink-400">{label}</span>
      <span className="h-px flex-1 bg-ink-100" />
    </div>
  )
}
