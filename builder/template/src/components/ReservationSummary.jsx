import { CalendarDays, Clock, MapPin, Users } from 'lucide-react'
import StatusPill from './StatusPill.jsx'
import { cx } from '../lib/cx.js'

// ReservationSummary — the confirmed-booking receipt: table, room, class, appointment. What the customer sees
// after booking and again in their account, so it carries the reference and the change/cancel actions.
export default function ReservationSummary({
  title, reference, status = 'Confirmed', date, time, party, venue, address, notes,
  actions, extras = [], className,
}) {
  const rows = [
    date && { icon: CalendarDays, label: 'Date', value: date },
    time && { icon: Clock, label: 'Time', value: time },
    party && { icon: Users, label: 'Party', value: party },
    (venue || address) && { icon: MapPin, label: 'Where', value: venue, sub: address },
  ].filter(Boolean)
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
          {reference && <p className="mt-0.5 font-mono text-xs text-ink-400">Ref {reference}</p>}
        </div>
        <StatusPill status={status} />
      </div>
      <dl className="divide-y divide-ink-100">
        {rows.map((r, i) => {
          const Icon = r.icon
          return (
            <div key={i} className="flex gap-3 px-5 py-3.5">
              <Icon size={16} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
              <dt className="w-16 shrink-0 text-sm text-ink-500">{r.label}</dt>
              <dd className="min-w-0 flex-1 text-sm">
                <span className="font-medium text-ink-900">{r.value}</span>
                {r.sub && <span className="mt-0.5 block text-ink-500">{r.sub}</span>}
              </dd>
            </div>
          )
        })}
        {extras.map((e, i) => (
          <div key={`x${i}`} className="flex gap-3 px-5 py-3.5">
            <span className="w-4 shrink-0" aria-hidden="true" />
            <dt className="w-16 shrink-0 text-sm text-ink-500">{e.label}</dt>
            <dd className="min-w-0 flex-1 text-sm font-medium text-ink-900">{e.value}</dd>
          </div>
        ))}
      </dl>
      {notes && <p className="border-t border-ink-100 bg-ink-50/60 px-5 py-3.5 text-sm text-ink-600">{notes}</p>}
      {actions && <div className="flex flex-wrap gap-2 border-t border-ink-100 px-5 py-3.5">{actions}</div>}
    </div>
  )
}
