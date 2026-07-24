import { cx } from '../lib/cx.js'
import type React from 'react'
import type { ReactNode } from 'react'

const tones = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-100 text-brand-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-accent-100 text-accent-700',
  danger: 'bg-rose-100 text-rose-700',
  info: 'bg-sky-100 text-sky-700',
}

type BadgeProps = React.ComponentPropsWithoutRef<'span'> & {
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
  children?: ReactNode
  dot?: boolean
}

export default function Badge({ tone = 'neutral', className, children, dot = false, ...props }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className
      )}
      {...props}
    >
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', tones[tone].split(' ')[1] || 'bg-current')} />}
      {children}
    </span>
  )
}