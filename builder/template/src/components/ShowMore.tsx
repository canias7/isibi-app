import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface ShowMoreProps {
  children?: ReactNode
  lines?: any
  collapsedHeight?: number
  more?: string
  less?: string
  className?: string
}

// ShowMore — clamps long content to a fixed height with a fade, and expands on click. For review bodies,
// descriptions, changelogs, anywhere a wall of text would push the page around.
export default function ShowMore({ children, lines, collapsedHeight = 160, more = 'Show more', less = 'Show less', className }: ShowMoreProps) {
  const [open, setOpen] = useState(false)
  // Line clamping is cleaner when you know the line count; height clamping handles mixed content (lists, images).
  const clamp: React.CSSProperties = lines ? { WebkitLineClamp: lines, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }
    : { maxHeight: collapsedHeight, overflow: 'hidden' }
  return (
    <div className={className}>
      <div className="relative" style={open ? undefined : clamp}>
        {children}
        {!open && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-canvas to-transparent" aria-hidden="true" />
        )}
      </div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1 rounded-lg text-sm font-medium text-brand-600 transition hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        {open ? less : more}
        <ChevronDown size={14} className={cx('transition-transform', open && 'rotate-180')} />
      </button>
    </div>
  )
}
