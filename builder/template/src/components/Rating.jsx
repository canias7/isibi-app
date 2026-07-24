import { Star } from 'lucide-react'
import { cx } from '../lib/cx.js'

export default function Rating({ value = 0, max = 5, onChange, size = 18, readOnly = false, count, className }) {
  const stars = Array.from({ length: max }, (_, i) => i + 1)
  return (
    <div className={cx('inline-flex items-center gap-1', className)} role={readOnly ? 'img' : 'radiogroup'}
      aria-label={`${value} out of ${max}`}>
      {stars.map((n) => {
        const filled = n <= Math.round(value)
        const Icon = (
          <Star
            size={size}
            className={cx(filled ? 'fill-accent-400 text-accent-400' : 'text-ink-300')}
          />
        )
        return readOnly ? (
          <span key={n}>{Icon}</span>
        ) : (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onChange && onChange(n)}
            className="rounded transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {Icon}
          </button>
        )
      })}
      {count != null && <span className="ml-1 text-sm text-ink-500">({count})</span>}
    </div>
  )
}
