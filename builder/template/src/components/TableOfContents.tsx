import { useEffect, useState } from 'react'
import { cx } from '../lib/cx.js'

interface TableOfContentsProps {
  items?: any[]
  title?: string
  className?: string
}

// TableOfContents — the sticky heading rail beside a long article or docs page.
// items: [{id, label, level}] where level 2 = h2, 3 = h3. Highlights the section in view.
export default function TableOfContents({ items = [], title = 'On this page', className }: TableOfContentsProps) {
  const [active, setActive] = useState(items[0] && items[0].id)
  useEffect(() => {
    if (!items.length || typeof IntersectionObserver === 'undefined') return
    // rootMargin pulls the trigger line up to ~1/4 viewport so a heading "activates" as it reaches the top.
    const obs = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (seen[0]) setActive(seen[0].target.id)
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    )
    items.forEach((i) => { const el = document.getElementById(i.id); if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [items])
  if (!items.length) return null
  return (
    <nav aria-label={String(title ?? "")} className={cx('sticky top-24 self-start', className)}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">{title}</p>
      <ul className="space-y-1 border-l border-ink-100">
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`}
              onClick={() => setActive(i.id)}
              className={cx('-ml-px block border-l-2 py-1 text-sm transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                (i.level || 2) > 2 ? 'pl-7' : 'pl-4',
                active === i.id ? 'border-brand-500 font-medium text-brand-600' : 'border-transparent text-ink-500 hover:text-ink-800')}>
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
