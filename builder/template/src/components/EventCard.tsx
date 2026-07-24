import { Link } from 'react-router-dom'
import { Calendar, MapPin } from 'lucide-react'
import Badge from './Badge.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface EventCardProps {
  title?: string
  date?: any
  month?: any
  day?: any
  time?: any
  location?: any
  to?: string
  badge?: any
  spotsLeft?: any
  image?: string
  className?: string
}

// EventCard — a dated event with a calendar chip (classes, gigs, sessions, meetups).
export default function EventCard({ title, date, month, day, time, location, to, badge, spotsLeft, image, className }: EventCardProps) {
  const Wrap: any = to ? Link : 'div'
  return (
    <article className={cx('flex gap-4 rounded-xl2 border border-ink-100 bg-surface p-4 transition hover:shadow-soft', className)}>
      {month || day ? (
        <div className="grid h-16 w-16 shrink-0 place-content-center rounded-xl bg-brand-100 text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">{month}</span>
          <span className="font-display text-xl font-bold leading-none text-brand-700">{day}</span>
        </div>
      ) : image ? (
        <img src={image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Wrap {...(to ? { to } : {})} className="font-display text-base font-semibold text-ink-900 hover:text-brand-600">{title}</Wrap>
          {badge && <Badge tone="brand">{badge}</Badge>}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500">
          {(date || time) && <span className="flex items-center gap-1.5"><Calendar size={13} />{date}{time ? ` · ${time}` : ''}</span>}
          {location && <span className="flex items-center gap-1.5"><MapPin size={13} />{location}</span>}
        </div>
        {spotsLeft != null && (
          <p className={cx('mt-2 text-xs font-medium', spotsLeft <= 3 ? 'text-rose-600' : 'text-ink-400')}>
            {spotsLeft === 0 ? 'Fully booked' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
          </p>
        )}
      </div>
    </article>
  )
}
