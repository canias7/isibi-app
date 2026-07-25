import { cx } from '../lib/cx.js'

interface TimelineProps {
  items?: any[]
  className?: string
}

// Timeline — activity feeds, order history, audit logs. items: [{title, meta, body, icon}]
export default function Timeline({ items = [], className }: TimelineProps) {
  return (
    <ol className={cx('relative space-y-6 border-l border-ink-100 pl-6', className)}>
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-brand-500 text-brandfg">
            {it.icon}
          </span>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-sm font-medium text-ink-900">{it.title}</p>
            {it.meta && <span className="text-xs text-ink-400">{it.meta}</span>}
          </div>
          {it.body && <div className="mt-1 text-sm text-ink-600">{it.body}</div>}
        </li>
      ))}
    </ol>
  )
}
