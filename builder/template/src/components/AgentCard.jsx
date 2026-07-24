import { Mail, Phone } from 'lucide-react'
import Avatar from './Avatar.jsx'
import Button from './Button.jsx'
import { cx } from '../lib/cx.js'

// AgentCard — the "contact the agent/rep" panel beside a listing: estate agents, dealerships, brokers,
// account managers. UserCard is the directory tile; this one exists to get a message sent.
export default function AgentCard({
  name, role, avatar, agency, agencyLogo, phone, email, listings, rating, onContact, contactLabel = 'Request a viewing', className,
}) {
  return (
    <div className={cx('card-surface p-5', className)}>
      <div className="flex items-start gap-3">
        <Avatar name={name} src={avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-ink-900">{name}</p>
          {role && <p className="text-sm text-ink-500">{role}</p>}
          {agency && (
            <div className="mt-1 flex items-center gap-2">
              {agencyLogo && <img src={agencyLogo} alt="" className="h-4 w-auto" />}
              <span className="text-xs text-ink-400">{agency}</span>
            </div>
          )}
        </div>
      </div>
      {(listings || rating) && (
        <dl className="mt-4 flex gap-6 border-t border-ink-100 pt-4 text-sm">
          {listings != null && <div><dt className="text-xs text-ink-400">Listings</dt><dd className="font-medium tabular-nums text-ink-900">{listings}</dd></div>}
          {rating != null && <div><dt className="text-xs text-ink-400">Rating</dt><dd className="font-medium tabular-nums text-ink-900">{rating} / 5</dd></div>}
        </dl>
      )}
      <div className="mt-5 space-y-2">
        {onContact && <Button onClick={onContact} className="w-full justify-center">{contactLabel}</Button>}
        {/* tel: and mailto: are the fastest path on a phone and cost nothing to wire. */}
        {phone && (
          <a href={`tel:${String(phone).replace(/[^\d+]/g, '')}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <Phone size={15} />{phone}
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <Mail size={15} />Email
          </a>
        )}
      </div>
    </div>
  )
}
