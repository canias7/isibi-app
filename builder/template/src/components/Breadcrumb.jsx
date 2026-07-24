import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cx } from '../lib/cx.js'

export default function Breadcrumb({ items = [], className }) {
  return (
    <nav aria-label="Breadcrumb" className={cx('flex items-center gap-1.5 text-sm', className)}>
      {items.map((item, i) => {
        const last = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {item.to && !last ? (
              <Link to={item.to} className="text-ink-500 transition hover:text-ink-800">{item.label}</Link>
            ) : (
              <span className={cx(last ? 'font-medium text-ink-900' : 'text-ink-500')} aria-current={last ? 'page' : undefined}>
                {item.label}
              </span>
            )}
            {!last && <ChevronRight size={14} className="text-ink-300" />}
          </span>
        )
      })}
    </nav>
  )
}
