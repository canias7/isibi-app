import Avatar from './Avatar.jsx'
import Dropdown from './Dropdown.jsx'
import { cx } from '../lib/cx.js'

// MemberList — the people-and-roles table for a workspace, group or project. AttendeeList is read-only for
// events; this one manages ACCESS, so the role control and the remove action are the point.
// members: [{id, name, email, avatar, role, status, lastActive, owner}]
export default function MemberList({
  members = [], roles = ['Admin', 'Member', 'Viewer'], onChangeRole, onRemove, canManage = true,
  title = 'Members', actions, className,
}) {
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <h3 className="font-display text-base font-semibold text-ink-900">
          {title} <span className="ml-1 text-sm font-normal text-ink-400">{members.length}</span>
        </h3>
        {actions}
      </div>
      <ul className="divide-y divide-ink-100">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
            <Avatar name={m.name} src={m.avatar} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">
                {m.name}
                {m.status === 'invited' && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Invited</span>}
              </p>
              {m.email && <p className="truncate text-xs text-ink-400">{m.email}</p>}
            </div>
            {m.lastActive && <span className="hidden shrink-0 text-xs text-ink-400 sm:block">{m.lastActive}</span>}
            {/* The owner's role is deliberately NOT editable — an app that lets you demote the last owner
                locks everyone out, and that bug is always found in production. */}
            {canManage && onChangeRole && !m.owner ? (
              <select value={m.role} onChange={(e) => onChangeRole(m.id, e.target.value)} aria-label={`Role for ${m.name}`}
                className="shrink-0 rounded-lg border border-ink-200 bg-surface px-2 py-1 text-xs font-medium text-ink-700 transition-colors hover:border-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40">
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <span className="shrink-0 rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-600">{m.owner ? 'Owner' : m.role}</span>
            )}
            {canManage && onRemove && !m.owner && (
              <Dropdown items={[{ label: 'Remove from team', danger: true, onSelect: () => onRemove(m.id) }]} />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
