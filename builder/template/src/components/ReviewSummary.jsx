import Rating from './Rating.jsx'
import Progress from './Progress.jsx'
import { cx } from '../lib/cx.js'

// ReviewSummary — average score + the 5→1 star breakdown bars. counts: {5:n,4:n,…}
export default function ReviewSummary({ average = 0, total = 0, counts = {}, className }) {
  const max = Math.max(1, ...Object.values(counts))
  return (
    <div className={cx('flex flex-wrap gap-8', className)}>
      <div className="text-center">
        <div className="font-display text-5xl font-bold tracking-tight text-ink-900">{Number(average).toFixed(1)}</div>
        <Rating value={average} readOnly size={16} className="mt-2 justify-center" />
        <p className="mt-1 text-sm text-ink-500">{total} review{total === 1 ? '' : 's'}</p>
      </div>
      <div className="min-w-56 flex-1 space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => (
          <div key={star} className="flex items-center gap-3">
            <span className="w-6 shrink-0 text-xs tabular-nums text-ink-500">{star}★</span>
            <Progress value={counts[star] || 0} max={max} size="sm" className="flex-1" />
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-ink-400">{counts[star] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
