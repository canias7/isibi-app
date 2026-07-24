import { Laptop, LogOut, Smartphone, Tablet } from 'lucide-react'
import { cx } from '../lib/cx.js'

// SessionList — "where you are signed in": device, location, last active, with per-session and sign-out-
// everywhere revocation. A security-settings staple, and the thing a user reaches for after a scare.
// sessions: [{id, device, type, browser, location, ip, lastActive, current}]
const ICONS = { mobile: Smartphone, tablet: Tablet, desktop: Laptop }

export default function SessionList({
  sessions = [], onRevoke, onRevokeAll, title = 'Active sessions',
  note = 'If you do not recognise a session, sign it out and change your password.', className,
}) {
  const others = sessions.filter((s) => !s.current).length
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
        {others > 0 && onRevokeAll && (
          <button type="button" onClick={onRevokeAll}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
            <LogOut size={14} />Sign out {others} other{others === 1 ? '' : 's'}
          </button>
        )}
      </div>
      <ul className="divide-y divide-ink-100">
        {sessions.map((s) => {
          const Icon = ICONS[s.type] || Laptop
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
              <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full',
                s.current ? 'bg-emerald-50 text-emerald-600' : 'bg-ink-100 text-ink-500')}>
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
                  {s.device}
                  {s.current && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">This device</span>}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">{[s.browser, s.location].filter(Boolean).join(' · ')}</p>
                <p className="text-xs text-ink-400">{[s.ip, s.lastActive && `Last active ${s.lastActive}`].filter(Boolean).join(' · ')}</p>
              </div>
              {!s.current && onRevoke && (
                <button type="button" onClick={() => onRevoke(s.id)}
                  className="shrink-0 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                  Sign out
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {note && <p className="border-t border-ink-100 bg-ink-50/60 px-5 py-3 text-xs text-ink-500">{note}</p>}
    </div>
  )
}
