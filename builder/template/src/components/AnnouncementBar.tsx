import { useState } from 'react'
import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface AnnouncementBarProps {
  children?: ReactNode
  cta?: any
  dismissible?: boolean
  tone?: 'brand' | 'ink' | 'accent'
  className?: string
}

// AnnouncementBar — the promo/notice strip above the nav.
export default function AnnouncementBar({ children, cta, dismissible = true, tone = 'brand', className }: AnnouncementBarProps) {
  const [open, setOpen] = useState(true)
  if (!open) return null
  const tones = { brand: 'bg-brand-600 text-brandfg', ink: 'bg-ink-900 text-canvas', accent: 'bg-accent-500 text-brandfg' }
  return (
    <div className={cx('relative px-4 py-2.5 text-center text-sm', tones[tone] || tones.brand, className)}>
      <span>{children}</span>
      {cta && (cta.to
        ? <Link to={cta.to} className="ml-2 font-semibold underline underline-offset-2">{cta.label}</Link>
        : <button type="button" onClick={cta.onClick} className="ml-2 font-semibold underline underline-offset-2">{cta.label}</button>)}
      {dismissible && (
        <button type="button" onClick={() => setOpen(false)} aria-label="Dismiss"
          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 transition hover:opacity-100"><X size={15} /></button>
      )}
    </div>
  )
}
