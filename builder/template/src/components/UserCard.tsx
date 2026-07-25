import { Link } from 'react-router-dom'
import Avatar from './Avatar.tsx'
import FollowButton from './FollowButton.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'
import type { StatItem } from '../lib/types.ts'

interface UserCardProps {
  name?: string
  role?: any
  avatar?: string
  bio?: any
  to?: string
  /** Click the whole tile without navigating — a directory that opens a drawer rather than a profile page. */
  onClick?: (...args: any[]) => any
  stats?: any[]
  following?: any
  onToggleFollow?: (...args: any[]) => any
  actions?: ReactNode
  variant?: string
  className?: string
}

// UserCard — the compact person card used in member directories, author bylines, "people you may know",
// and as the body of a hover card. ProfileHeader is the full-width banner version; this is the tile.
export default function UserCard({
  name, role, avatar, bio, to, onClick, stats = [], following, onToggleFollow, actions, variant = 'card', className,
}: UserCardProps) {
  const inner = (
    <>
      <div className="flex items-start gap-3">
        <Avatar name={name} src={avatar} size={variant === 'row' ? 'md' : 'lg'} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-semibold text-ink-900">{name}</p>
          {role && <p className="truncate text-sm text-ink-500">{role}</p>}
        </div>
        {onToggleFollow !== undefined && (
          <FollowButton size="sm" following={following} onToggle={onToggleFollow} className="shrink-0" />
        )}
        {actions}
      </div>
      {bio && <p className={cx('text-sm text-ink-600', variant === 'row' ? 'mt-2 line-clamp-2' : 'mt-3')}>{bio}</p>}
      {stats.length > 0 && (
        <dl className="mt-4 flex gap-5">
          {stats.map((s, i) => (
            <div key={i}>
              <dt className="text-xs text-ink-400">{s.label}</dt>
              <dd className="font-display text-sm font-semibold tabular-nums text-ink-900">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )
  const interactive = (to || onClick) && onToggleFollow === undefined
  const cls = cx(variant === 'row' ? 'py-4' : 'card-surface p-5',
    interactive && 'block w-full text-left transition hover:border-ink-200 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', className)
  // A whole-card link would swallow the follow button's click, so only make the tile interactive when there is
  // no inline action inside it. `onClick` (a drawer) wins over `to` (a profile page) when both are given.
  if (interactive && onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>
  if (interactive && to) return <Link to={to} className={cls}>{inner}</Link>
  return <div className={cls}>{inner}</div>
}
