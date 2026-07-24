import { Link } from 'react-router-dom'
import Avatar from './Avatar.tsx'
import FollowButton from './FollowButton.tsx'
import { cx } from '../lib/cx.js'
import type { LinkItem } from '../lib/types.ts'

interface AuthorBioProps {
  name?: string
  role?: any
  avatar?: string
  bio?: any
  to: string
  links?: LinkItem[]
  following?: any
  onToggleFollow?: (...args: any[]) => any
  className?: string
}

// AuthorBio — the "about the writer" box at the foot of an article. links: [{label, href}].
export default function AuthorBio({ name, role, avatar, bio, to, links = [], following, onToggleFollow, className }: AuthorBioProps) {
  return (
    <aside className={cx('rounded-xl2 border border-ink-100 bg-ink-50/60 p-6', className)}>
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={name} src={avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Written by</p>
          {to ? <Link to={to} className="font-display text-lg font-semibold text-ink-900 hover:text-brand-600">{name}</Link>
            : <p className="font-display text-lg font-semibold text-ink-900">{name}</p>}
          {role && <p className="text-sm text-ink-500">{role}</p>}
          {bio && <p className="mt-3 text-sm text-ink-600">{bio}</p>}
          {links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-4">
              {links.map((l, i) => (
                <a key={i} href={l.href} target="_blank" rel="noreferrer"
                  className="text-sm font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                  {l.label}
                </a>
              ))}
            </div>
          )}
        </div>
        {onToggleFollow && <FollowButton size="sm" following={following} onToggle={onToggleFollow} className="shrink-0" />}
      </div>
    </aside>
  )
}
