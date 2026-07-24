import { Flame, Leaf } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface DishCardProps {
  name?: string
  description?: ReactNode
  price?: any
  image?: string
  alt?: string
  tags?: any[]
  spicy?: any
  vegetarian?: any
  unavailable?: any
  badge?: any
  onAdd?: (...args: any[]) => any
  className?: string
}

// DishCard — one menu item as a card with a photo and an add button. MenuSection is the text list for a
// printed-style menu; this is the ordering surface, where the picture does the selling.
export default function DishCard({
  name, description, price, image, alt, tags = [], spicy, vegetarian, unavailable, badge, onAdd, className,
}: DishCardProps) {
  return (
    <div className={cx('card-surface flex overflow-hidden', unavailable && 'opacity-60', className)}>
      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-base font-semibold text-ink-900">{name}</h3>
          <span className="shrink-0 font-medium tabular-nums text-ink-900">{price}</span>
        </div>
        {description && <p className="mt-1 line-clamp-2 text-sm text-ink-600">{description}</p>}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {vegetarian && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"><Leaf size={10} />Veg</span>}
          {spicy && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700"><Flame size={10} />Spicy</span>}
          {tags.map((t) => <span key={t} className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600">{t}</span>)}
        </div>
        {onAdd && (
          <button type="button" onClick={onAdd} disabled={unavailable}
            className={cx('mt-3 rounded-lg px-3 py-1.5 text-sm font-medium transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              unavailable ? 'cursor-not-allowed bg-ink-100 text-ink-400' : 'bg-brand-600 text-brandfg hover:bg-brand-700')}>
            {unavailable ? 'Sold out' : 'Add to order'}
          </button>
        )}
      </div>
      {image && (
        <div className="relative w-28 shrink-0 sm:w-36">
          <img src={image} alt={alt || name} className="h-full w-full object-cover" />
          {badge && <span className="absolute left-1.5 top-1.5 rounded-full bg-surface/95 px-2 py-0.5 text-[11px] font-medium text-ink-800">{badge}</span>}
        </div>
      )}
    </div>
  )
}
