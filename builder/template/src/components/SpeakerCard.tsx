import { Link } from 'react-router-dom'
import Avatar from './Avatar.tsx'
import { cx } from '../lib/cx.js'

interface SpeakerCardProps {
  name?: string
  role?: any
  company?: any
  avatar?: string
  bio?: any
  talk?: any
  talkTime?: any
  to: string
  social?: any[]
  variant?: string
  className?: string
}

// SpeakerCard — a conference speaker / guest / presenter tile. TeamGrid is for staff; this one carries the
// talk title and the social handle, which is what an attendee is actually scanning for.
export default function SpeakerCard({
  name, role, company, avatar, bio, talk, talkTime, to, social = [], variant = 'card', className,
}: SpeakerCardProps) {
  const body = (
    <>
      <Avatar name={name} src={avatar} size={variant === 'compact' ? 'md' : 'xl'} className={variant === 'compact' ? '' : 'mx-auto'} />
      <div className={cx('min-w-0', variant === 'compact' ? 'flex-1' : 'mt-4 text-center')}>
        <p className="font-display text-base font-semibold text-ink-900">{name}</p>
        {(role || company) && <p className="mt-0.5 text-sm text-ink-500">{[role, company].filter(Boolean).join(', ')}</p>}
        {bio && variant !== 'compact' && <p className="mt-3 text-sm text-ink-600">{bio}</p>}
        {talk && (
          <div className={cx('mt-4 rounded-xl bg-ink-50 p-3', variant === 'compact' && 'mt-2')}>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Speaking</p>
            <p className="mt-1 text-sm font-medium text-ink-900">{talk}</p>
            {talkTime && <p className="mt-0.5 text-xs tabular-nums text-ink-400">{talkTime}</p>}
          </div>
        )}
        {social.length > 0 && (
          <div className={cx('mt-3 flex gap-3', variant !== 'compact' && 'justify-center')}>
            {social.map((s, i) => (
              <a key={i} href={s.href} target="_blank" rel="noreferrer"
                className="text-sm font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                {s.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  )
  const cls = cx('card-surface p-5', variant === 'compact' && 'flex items-start gap-4',
    to && 'transition hover:-translate-y-0.5 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', className)
  // Only wrap in a link when there are no inner links to swallow.
  return to && !social.length ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}
