import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cx } from '../lib/cx.js'

// Collapsible — a single show-more/less region (long descriptions, advanced options).
export default function Collapsible({ label = 'Show more', hideLabel = 'Show less', defaultOpen = false, children, className }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={className}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition hover:text-brand-700
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">
        {open ? hideLabel : label}
        <ChevronDown size={15} className={cx('transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="pt-3">{children}</div>}
    </div>
  )
}
