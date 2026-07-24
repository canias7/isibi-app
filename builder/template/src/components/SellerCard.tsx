import { Link } from 'react-router-dom'
import { BadgeCheck, MessageSquare, Star } from 'lucide-react'
import Avatar from './Avatar.tsx'
import Button from './Button.tsx'
import { cx } from '../lib/cx.js'

interface SellerCardProps {
  name?: string
  avatar?: string
  to: string
  verified?: any
  rating?: any
  reviewCount?: any
  sales?: any
  memberSince?: any
  responseTime?: any
  location?: any
  onMessage?: (...args: any[]) => any
  onViewShop?: (...args: any[]) => any
  badges?: any[]
  className?: string
}

// SellerCard — the vendor panel on a marketplace listing. Trust signals first (verification, rating, response
// time), because on a marketplace the buyer is deciding about the SELLER as much as the item.
export default function SellerCard({
  name, avatar, to, verified, rating, reviewCount, sales, memberSince, responseTime, location,
  onMessage, onViewShop, badges = [], className,
}: SellerCardProps) {
  return (
    <div className={cx('card-surface p-5', className)}>
      <div className="flex items-start gap-3">
        <Avatar name={name} src={avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {to ? <Link to={to} className="truncate font-display font-semibold text-ink-900 hover:text-brand-600">{name}</Link>
              : <span className="truncate font-display font-semibold text-ink-900">{name}</span>}
            {verified && <BadgeCheck size={16} className="shrink-0 fill-brand-500 text-brandfg" aria-label="Verified seller" />}
          </div>
          {rating != null && (
            <div className="mt-1 flex items-center gap-1.5 text-sm">
              <Star size={13} className="fill-accent-400 text-accent-400" />
              <span className="font-medium tabular-nums text-ink-900">{rating}</span>
              {reviewCount != null && <span className="text-ink-400">({reviewCount.toLocaleString()})</span>}
            </div>
          )}
          {location && <p className="mt-0.5 text-xs text-ink-400">{location}</p>}
        </div>
      </div>
      {badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {badges.map((b) => <span key={b} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">{b}</span>)}
        </div>
      )}
      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-ink-100 pt-4 text-center">
        {[
          sales != null && { label: 'Sales', value: sales.toLocaleString() },
          responseTime && { label: 'Replies in', value: responseTime },
          memberSince && { label: 'Since', value: memberSince },
        ].filter(Boolean).map((f, i) => (
          <div key={i}>
            <dt className="text-[11px] text-ink-400">{f.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-ink-900">{f.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex gap-2">
        {onMessage && <Button variant="outline" size="sm" onClick={onMessage} className="flex-1 justify-center"><MessageSquare size={14} />Message</Button>}
        {onViewShop && <Button size="sm" onClick={onViewShop} className="flex-1 justify-center">View shop</Button>}
      </div>
    </div>
  )
}
