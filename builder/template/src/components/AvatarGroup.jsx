import Avatar from './Avatar.jsx'
import { cx } from '../lib/cx.js'

// AvatarGroup — stacked avatars with an overflow count (team rows, attendees, assignees).
export default function AvatarGroup({ people = [], max = 4, size = 'sm', className }) {
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  return (
    <div className={cx('flex items-center', className)}>
      <div className="flex -space-x-2">
        {shown.map((p, i) => (
          <span key={i} className="rounded-full ring-2 ring-white">
            <Avatar name={p.name || p} src={p.src} size={size} />
          </span>
        ))}
      </div>
      {extra > 0 && (
        <span className="ml-2 text-xs font-medium text-ink-500">+{extra}</span>
      )}
    </div>
  )
}
