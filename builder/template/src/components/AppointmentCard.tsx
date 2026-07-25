import { Link } from 'react-router-dom'
import { CalendarDays, Clock, MapPin, Video } from 'lucide-react'
import Avatar from './Avatar.tsx'
import StatusPill from './StatusPill.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface AppointmentCardProps {
  title?: ReactNode
  withName?: any
  withRole?: any
  avatar?: string
  date?: any
  time?: any
  duration?: any
  location?: any
  remote?: any
  joinHref?: any
  status?: string
  to?: string
  actions?: ReactNode
  className?: string
}

// AppointmentCard — a booked appointment for clinics, salons, advisers, tutors. Surfaces the join link for a
// remote appointment and the address for an in-person one, since those are the only two things anyone needs
// in the hour before it starts.
export default function AppointmentCard({
  title, withName, withRole, avatar, date, time, duration, location, remote, joinHref,
  status = 'Confirmed', to, actions, className,
}: AppointmentCardProps) {
  return (
    <div className={cx('card-surface p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {to ? <Link to={to} className="font-display text-base font-semibold text-ink-900 hover:text-brand-600">{title}</Link>
            : <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>}
          {duration && <p className="mt-0.5 text-sm text-ink-500">{duration}</p>}
        </div>
        <StatusPill status={status} className="shrink-0" />
      </div>
      {withName && (
        <div className="mt-4 flex items-center gap-2.5">
          <Avatar name={withName} src={avatar} size="sm" />
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium text-ink-900">{withName}</p>
            {withRole && <p className="truncate text-ink-500">{withRole}</p>}
          </div>
        </div>
      )}
      <dl className="mt-4 space-y-2 text-sm">
        {date && <div className="flex items-center gap-2 text-ink-600"><CalendarDays size={15} className="shrink-0 text-ink-400" />{date}</div>}
        {time && <div className="flex items-center gap-2 text-ink-600"><Clock size={15} className="shrink-0 text-ink-400" />{time}</div>}
        {remote
          ? <div className="flex items-center gap-2 text-ink-600"><Video size={15} className="shrink-0 text-ink-400" />Video appointment</div>
          : location && <div className="flex items-start gap-2 text-ink-600"><MapPin size={15} className="mt-0.5 shrink-0 text-ink-400" />{location}</div>}
      </dl>
      {(joinHref || actions) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {joinHref && (
            <a href={joinHref} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-brandfg transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <Video size={15} />Join call
            </a>
          )}
          {actions}
        </div>
      )}
    </div>
  )
}
