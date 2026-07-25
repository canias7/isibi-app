import { Link } from 'react-router-dom'
import Badge from './Badge.tsx'
import Rating from './Rating.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface ProductCardProps {
  title?: string
  price?: any
  comparePrice?: any
  image?: string
  alt?: string
  to?: string
  badge?: any
  rating?: any
  reviewCount?: any
  meta?: any
  onAdd?: (...args: any[]) => any
  className?: string
}

// ProductCard — a shop/marketplace item tile.
export default function ProductCard({ title, price, comparePrice, image, alt, to, badge, rating, reviewCount, meta, onAdd, className }: ProductCardProps) {
  const Wrap: any = to ? Link : 'div'
  return (
    <div className={cx('group flex flex-col overflow-hidden rounded-xl2 border border-ink-100 bg-surface transition hover:shadow-soft', className)}>
      <Wrap {...(to ? { to } : {})} className="relative block aspect-[4/3] overflow-hidden bg-ink-100">
        {image && <img src={image} alt={alt || title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />}
        {badge && <span className="absolute left-3 top-3"><Badge tone="brand">{badge}</Badge></span>}
      </Wrap>
      <div className="flex flex-1 flex-col p-4">
        <Wrap {...(to ? { to } : {})} className="font-display text-sm font-semibold text-ink-900 hover:text-brand-600">{title}</Wrap>
        {meta && <p className="mt-1 text-xs text-ink-500">{meta}</p>}
        {rating != null && (
          <div className="mt-2 flex items-center gap-1.5">
            <Rating value={rating} readOnly size={13} />
            {reviewCount != null && <span className="text-xs text-ink-400">({reviewCount})</span>}
          </div>
        )}
        <div className="mt-3 flex items-end justify-between gap-2 pt-1">
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-lg font-semibold text-ink-900">{price}</span>
            {comparePrice && <span className="text-sm text-ink-400 line-through">{comparePrice}</span>}
          </span>
          {onAdd && (
            <button type="button" onClick={onAdd}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-brandfg transition hover:bg-brand-600">
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
