import { Loader2 } from 'lucide-react'
import { cx } from '../lib/cx.js'

export default function Spinner({ size = 20, label, className }) {
  return (
    <span className={cx('inline-flex items-center gap-2 text-ink-400', className)} role="status" aria-live="polite">
      <Loader2 size={size} className="animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </span>
  )
}
