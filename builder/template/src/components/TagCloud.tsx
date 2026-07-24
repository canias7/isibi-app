import { Link } from 'react-router-dom'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface TagCloudProps {
  tags?: any[]
  title?: ReactNode
  active?: any
  scale?: boolean
  className?: string
}

// TagCloud — topic chips with optional counts, sized by weight. tags: [{label, to, count, onClick}].
// `scale` makes popular tags visually bigger, which is the whole point of a cloud over a plain list.
export default function TagCloud({ tags = [], title, active, scale = false, className }: TagCloudProps) {
  const max = Math.max(...tags.map((t) => t.count || 0), 1)
  const size = (c) => {
    if (!scale || !c) return 'text-sm'
    const r = c / max
    return r > 0.75 ? 'text-base font-semibold' : r > 0.4 ? 'text-sm font-medium' : 'text-sm'
  }
  return (
    <div className={className}>
      {title && <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">{title}</p>}
      <div className="flex flex-wrap gap-2">
        {tags.map((t, i) => {
          const on = active === (t.label || t)
          const cls = cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            size(t.count),
            on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:border-ink-400 hover:text-ink-900')
          const body = <>{t.label || t}{typeof t.count === 'number' && <span className="tabular-nums text-ink-400">{t.count}</span>}</>
          return t.to ? <Link key={i} to={t.to} className={cls}>{body}</Link>
            : <button key={i} type="button" onClick={t.onClick} aria-pressed={on} className={cls}>{body}</button>
        })}
      </div>
    </div>
  )
}
