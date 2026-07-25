import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface ButtonGroupProps {
  children?: ReactNode
  className?: string
}

// ButtonGroup — joins related buttons into one control (Save | Save & new).
export default function ButtonGroup({ children, className }: ButtonGroupProps) {
  return (
    <div className={cx('inline-flex [&>*]:rounded-none [&>*:first-child]:rounded-l-xl [&>*:last-child]:rounded-r-xl [&>*+*]:-ml-px', className)} role="group">
      {children}
    </div>
  )
}
