import { Link } from 'react-router-dom'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface ArchiveListProps {
  groups?: any
  items?: any[]
  title?: ReactNode
  className?: string
}

// ArchiveList — every post, grouped by period, as a dense list. The counterpart to a card grid: when a blog has
// 300 posts nobody scrolls 300 cards, they scan titles.
// groups: [{label, items:[{title, to, date, meta}]}]  — or pass flat `items` with a `period` field.
export default function ArchiveList({ groups, items, title, className }: ArchiveListProps) {
  const rows = groups || Object.entries(
    (items || []).reduce((acc, it) => { (acc[it.period || 'All'] ||= []).push(it); return acc }, {}),
  ).map(([label, list]) => ({ label, items: list }))
  return (
    <div className={className}>
      {title && <h2 className="mb-6 font-display text-2xl font-bold tracking-tight text-ink-900">{title}</h2>}
      <div className="space-y-8">
        {rows.map((g) => (
          <section key={g.label}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{g.label}</h3>
            <ul className="divide-y divide-ink-100">
              {g.items.map((it, i) => (
                <li key={it.id || i}>
                  <Link to={it.to}
                    className="flex items-baseline gap-4 py-2.5 transition hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">{it.title}</span>
                    {it.meta && <span className="shrink-0 text-xs text-ink-400">{it.meta}</span>}
                    <span className="shrink-0 text-xs tabular-nums text-ink-400">{it.date}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
