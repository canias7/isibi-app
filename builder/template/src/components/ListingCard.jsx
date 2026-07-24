import { Link } from 'react-router-dom'
import Badge from './Badge.jsx'
import { cx } from '../lib/cx.js'

// ListingCard — property / rental / vehicle style listing with a feature row.
export default function ListingCard({ title, price, period, image, alt, to, location, badge, features = [], className }) {
  const Wrap = to ? Link : 'div'
  return (
    <article className={cx('group overflow-hidden rounded-xl2 border border-ink-100 bg-surface transition hover:shadow-soft', className)}>
      <Wrap {...(to ? { to } : {})} className="relative block aspect-[16/10] overflow-hidden bg-ink-100">
        {image && <img src={image} alt={alt || title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />}
        {badge && <span className="absolute left-3 top-3"><Badge tone="success">{badge}</Badge></span>}
      </Wrap>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Wrap {...(to ? { to } : {})} className="block truncate font-display text-base font-semibold text-ink-900 hover:text-brand-600">{title}</Wrap>
            {location && <p className="mt-0.5 truncate text-sm text-ink-500">{location}</p>}
          </div>
          <span className="shrink-0 text-right">
            <span className="font-display text-lg font-semibold text-ink-900">{price}</span>
            {period && <span className="block text-xs text-ink-400">{period}</span>}
          </span>
        </div>
        {features.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-ink-100 pt-3 text-xs text-ink-600">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-1.5">{f.icon}{f.label}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}
