import { X } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface BulkActionBarProps {
  count?: number
  onClear?: (...args: any[]) => any
  actions?: ReactNode
  className?: string
}

// BulkActionBar — the floating bar that appears when table rows are selected.
export default function BulkActionBar({ count = 0, onClear, actions, className }: BulkActionBarProps) {
  if (!count) return null
  return (
    <div className={cx('sticky bottom-4 z-20 mx-auto flex w-fit items-center gap-4 rounded-xl2 bg-ink-900 px-4 py-2.5 shadow-soft', className)}>
      <span className="text-sm font-medium text-canvas">{count} selected</span>
      <div className="flex items-center gap-2">{actions}</div>
      {onClear && (
        <button type="button" onClick={onClear} aria-label="Clear selection"
          className="text-ink-400 transition hover:text-canvas"><X size={16} /></button>
      )}
    </div>
  )
}
