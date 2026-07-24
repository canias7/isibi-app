import { useState } from 'react'
import { Check, UserPlus } from 'lucide-react'
import { cx } from '../lib/cx.js'

// FollowButton — follow/unfollow with the standard hover-to-"Unfollow" affordance, so a user can see that
// they're following AND that clicking will undo it. Works controlled (`following` + onToggle) or on its own.
export default function FollowButton({
  following: prop, onToggle, count, size = 'md', labels = { follow: 'Follow', following: 'Following', unfollow: 'Unfollow' }, className,
}) {
  const [self, setSelf] = useState(false)
  const controlled = prop !== undefined
  const on = controlled ? prop : self
  const click = () => { if (!controlled) setSelf(!on); onToggle && onToggle(!on) }
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' }
  return (
    <button type="button" onClick={click} aria-pressed={on}
      className={cx('group inline-flex items-center gap-1.5 rounded-full font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        sizes[size],
        on ? 'border border-ink-200 text-ink-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600'
           : 'bg-brand-600 text-brandfg hover:bg-brand-700', className)}>
      {on ? <Check size={14} className="group-hover:hidden" /> : <UserPlus size={14} />}
      <span>
        {on ? (<><span className="group-hover:hidden">{labels.following}</span><span className="hidden group-hover:inline">{labels.unfollow}</span></>) : labels.follow}
      </span>
      {typeof count === 'number' && <span className="tabular-nums opacity-70">{count.toLocaleString()}</span>}
    </button>
  )
}
