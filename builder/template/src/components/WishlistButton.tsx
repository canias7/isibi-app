import { Heart } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface WishlistButtonProps {
  saved?: boolean
  onToggle?: (...args: any[]) => any
  count?: any
  size?: number
  floating?: boolean
  className?: string
}

// WishlistButton — the save/favourite heart toggle for listings and products.
export default function WishlistButton({ saved = false, onToggle, count, size = 18, floating = false, className }: WishlistButtonProps) {
  return (
    <button type="button" aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save'}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle && onToggle(!saved) }}
      className={cx('inline-flex items-center gap-1.5 transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-full',
        floating ? 'grid h-9 w-9 place-items-center bg-surface/90 shadow-sm hover:bg-surface' : '',
        saved ? 'text-rose-500' : 'text-ink-400 hover:text-rose-500', className)}>
      <Heart size={size} className={cx('transition', saved && 'fill-current')} />
      {count != null && <span className="text-xs font-medium tabular-nums">{count}</span>}
    </button>
  )
}
