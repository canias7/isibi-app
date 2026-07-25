import { cx } from '../lib/cx.js'

interface DescriptionListProps {
  items?: any[]
  columns?: number
  className?: string
}

// DescriptionList — label/value pairs for detail pages (order details, profile, invoice meta).
// items: [{label, value}]
export default function DescriptionList({ items = [], columns = 2, className }: DescriptionListProps) {
  const cols = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }
  return (
    <dl className={cx('grid grid-cols-1 gap-x-8 gap-y-4', cols[columns] || cols[2], className)}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wider text-ink-400">{it.label}</dt>
          <dd className="mt-1 text-sm text-ink-900">{it.value ?? <span className="text-ink-300">—</span>}</dd>
        </div>
      ))}
    </dl>
  )
}
