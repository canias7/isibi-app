import { Link } from 'react-router-dom'
import { Globe, Lock, MessagesSquare, Users } from 'lucide-react'
import AvatarGroup from './AvatarGroup.jsx'
import Button from './Button.jsx'
import { cx } from '../lib/cx.js'

// GroupCard — a community, space, channel or club tile. The join button is on the card because discovery
// pages convert far better when joining doesn't require a detour through the group page.
export default function GroupCard({
  name, description, cover, icon, to, members, memberAvatars = [], posts, privacy = 'public',
  joined, onJoin, category, className,
}) {
  const Privacy = privacy === 'private' ? Lock : Globe
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      {cover && <div className="h-24 bg-ink-100"><img src={cover} alt="" className="h-full w-full object-cover" /></div>}
      <div className="p-5">
        <div className="flex items-start gap-3">
          {icon
            ? <img src={icon} alt="" className={cx('h-12 w-12 shrink-0 rounded-xl object-cover ring-2 ring-surface', cover && '-mt-10')} />
            : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-100 font-display text-lg font-bold text-brand-700">{String(name || '?')[0]}</span>}
          <div className="min-w-0 flex-1">
            {to ? <Link to={to} className="font-display text-base font-semibold text-ink-900 hover:text-brand-600">{name}</Link>
              : <h3 className="font-display text-base font-semibold text-ink-900">{name}</h3>}
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-400">
              <span className="inline-flex items-center gap-1"><Privacy size={11} />{privacy === 'private' ? 'Private' : 'Public'}</span>
              {category && <span>{category}</span>}
            </p>
          </div>
        </div>
        {description && <p className="mt-3 line-clamp-2 text-sm text-ink-600">{description}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-500">
          {members != null && <span className="inline-flex items-center gap-1"><Users size={12} />{members.toLocaleString()} members</span>}
          {posts != null && <span className="inline-flex items-center gap-1"><MessagesSquare size={12} />{posts.toLocaleString()} posts</span>}
          {memberAvatars.length > 0 && <AvatarGroup people={memberAvatars} max={4} />}
        </div>
        {onJoin && (
          <Button variant={joined ? 'outline' : 'primary'} size="sm" onClick={onJoin} className="mt-4 w-full justify-center">
            {joined ? 'Joined' : privacy === 'private' ? 'Request to join' : 'Join group'}
          </Button>
        )}
      </div>
    </div>
  )
}
