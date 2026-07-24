import Avatar from './Avatar.tsx'
import Rating from './Rating.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface TestimonialGridProps {
  title?: ReactNode
  subtitle?: ReactNode
  items?: any[]
  columns?: number
  className?: string
}

// TestimonialGrid — social proof. items: [{quote, author, role, avatar, rating}]
export default function TestimonialGrid({ title, subtitle, items = [], columns = 3, className }: TestimonialGridProps) {
  const cols = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' }
  return (
    <section className={cx('py-16', className)}>
      <div className="container-page">
        {title && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">{title}</h2>
            {subtitle && <p className="mt-3 text-ink-600">{subtitle}</p>}
          </div>
        )}
        <div className={cx('grid gap-6', cols[columns] || cols[3])}>
          {items.map((t, i) => (
            <figure key={i} className="card-surface flex flex-col p-6">
              {t.rating != null && <Rating value={t.rating} readOnly size={15} className="mb-3" />}
              <blockquote className="flex-1 text-sm leading-relaxed text-ink-700">“{t.quote}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <Avatar name={t.author} src={t.avatar} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-900">{t.author}</span>
                  {t.role && <span className="block truncate text-xs text-ink-500">{t.role}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
