import Avatar from './Avatar.jsx'
import { cx } from '../lib/cx.js'

// ActivityFeed — "who did what" list for dashboards. items: [{actor, avatar, action, target, time, icon}]
export default function ActivityFeed({ title = 'Recent activity', items = [], empty = 'Nothing has happened yet.', footer, className }) {
  return (
    <div className={cx('card-surface', className)}>
      <div className="border-b border-ink-100 px-5 py-4">
        <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-3 px-5 py-3.5">
              {it.icon
                ? <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-500">{it.icon}</span>
                : <Avatar name={it.actor} src={it.avatar} size="sm" className="shrink-0" />}
              <p className="min-w-0 flex-1 text-sm text-ink-600">
                <span className="font-medium text-ink-900">{it.actor}</span>{' '}{it.action}{' '}
                {it.target && <span className="font-medium text-ink-900">{it.target}</span>}
              </p>
              {it.time && <span className="shrink-0 text-xs text-ink-400">{it.time}</span>}
            </li>
          ))}
        </ul>
      )}
      {footer && <div className="border-t border-ink-100 px-5 py-3">{footer}</div>}
    </div>
  )
}
