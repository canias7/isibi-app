import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cx } from '../lib/cx.js'

export default function Pagination({ page = 1, pageCount = 1, onChange, className }) {
  if (pageCount <= 1) return null
  const go = (p) => onChange && onChange(Math.min(pageCount, Math.max(1, p)))
  // A compact window around the current page, with ellipses.
  const nums = []
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) nums.push(i)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }
  const btn = 'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
  return (
    <nav aria-label="Pagination" className={cx('flex items-center gap-1', className)}>
      <button type="button" onClick={() => go(page - 1)} disabled={page === 1} aria-label="Previous page"
        className={cx(btn, 'text-ink-600 hover:bg-ink-100 disabled:opacity-40 disabled:hover:bg-transparent')}>
        <ChevronLeft size={16} />
      </button>
      {nums.map((n, i) =>
        n === '…' ? (
          <span key={`e${i}`} className="px-1 text-ink-400">…</span>
        ) : (
          <button key={n} type="button" onClick={() => go(n)} aria-current={n === page ? 'page' : undefined}
            className={cx(btn, n === page ? 'bg-brand-500 font-medium text-brandfg' : 'text-ink-600 hover:bg-ink-100')}>
            {n}
          </button>
        )
      )}
      <button type="button" onClick={() => go(page + 1)} disabled={page === pageCount} aria-label="Next page"
        className={cx(btn, 'text-ink-600 hover:bg-ink-100 disabled:opacity-40 disabled:hover:bg-transparent')}>
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}
