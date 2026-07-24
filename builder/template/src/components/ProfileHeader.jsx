import Avatar from './Avatar.jsx'
import { cx } from '../lib/cx.js'

// ProfileHeader — a member/company/seller banner with stats and actions.
export default function ProfileHeader({ name, tagline, avatar, cover, stats = [], actions, badges, className }) {
  return (
    <div className={cx('overflow-hidden rounded-xl2 border border-ink-100 bg-surface', className)}>
      <div className="h-28 bg-gradient-to-r from-brand-500 to-brand-700">
        {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="px-6 pb-6">
        <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <span className="rounded-full ring-4 ring-surface"><Avatar name={name} src={avatar} size="lg" /></span>
            <div className="pb-1">
              <h1 className="font-display text-xl font-bold text-ink-900">{name}</h1>
              {tagline && <p className="text-sm text-ink-500">{tagline}</p>}
            </div>
          </div>
          {actions && <div className="flex gap-2 pb-1">{actions}</div>}
        </div>
        {badges && <div className="mt-4 flex flex-wrap gap-2">{badges}</div>}
        {stats.length > 0 && (
          <dl className="mt-5 flex flex-wrap gap-8 border-t border-ink-100 pt-4">
            {stats.map((s, i) => (
              <div key={i}>
                <dd className="font-display text-lg font-semibold text-ink-900">{s.value}</dd>
                <dt className="text-xs text-ink-500">{s.label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  )
}
