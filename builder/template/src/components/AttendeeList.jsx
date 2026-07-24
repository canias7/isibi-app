import { useState } from 'react'
import { Search } from 'lucide-react'
import Avatar from './Avatar.jsx'
import StatusPill from './StatusPill.jsx'
import { cx } from '../lib/cx.js'

// AttendeeList — who is coming: events, classes, meetings, webinars. Filters client-side because the list is
// already loaded and a round-trip to search 80 names is silly.
// people: [{id, name, role, company, avatar, status, checkedIn}]
export default function AttendeeList({
  people = [], title = 'Attendees', searchable = true, onSelect, action, emptyText = 'Nobody has registered yet.', className,
}) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const shown = needle
    ? people.filter((p) => `${p.name} ${p.role || ''} ${p.company || ''}`.toLowerCase().includes(needle))
    : people
  const inCount = people.filter((p) => p.checkedIn).length
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <h3 className="font-display text-base font-semibold text-ink-900">
          {title} <span className="ml-1 text-sm font-normal text-ink-400">{people.length}</span>
        </h3>
        {inCount > 0 && <span className="text-xs text-ink-500">{inCount} checked in</span>}
      </div>
      {searchable && people.length > 6 && (
        <div className="relative border-b border-ink-100">
          <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search attendees" aria-label="Search attendees"
            className="w-full bg-transparent py-2.5 pl-10 pr-4 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none" />
        </div>
      )}
      {shown.length === 0
        ? <p className="px-5 py-10 text-center text-sm text-ink-400">{needle ? `Nobody matches “${q}”.` : emptyText}</p>
        : (
          <ul className="max-h-96 divide-y divide-ink-100 overflow-y-auto">
            {shown.map((p) => {
              const inner = (
                <>
                  <Avatar name={p.name} src={p.avatar} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">{p.name}</span>
                    {(p.role || p.company) && <span className="block truncate text-xs text-ink-500">{[p.role, p.company].filter(Boolean).join(' · ')}</span>}
                  </span>
                  {p.status && <StatusPill status={p.status} className="shrink-0" />}
                  {action && action(p)}
                </>
              )
              return (
                <li key={p.id || p.name}>
                  {onSelect
                    ? <button type="button" onClick={() => onSelect(p)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">{inner}</button>
                    : <div className="flex items-center gap-3 px-5 py-3">{inner}</div>}
                </li>
              )
            })}
          </ul>
        )}
    </div>
  )
}
