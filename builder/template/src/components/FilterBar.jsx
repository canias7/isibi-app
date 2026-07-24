import { X } from 'lucide-react'
import { cx } from '../lib/cx.js'

// FilterBar — the row of active filter chips above a list, with a clear-all.
export default function FilterBar({ filters = [], onRemove, onClearAll, className }) {
  if (!filters.length) return null
  return (
    <div className={cx('flex flex-wrap items-center gap-2', className)}>
      {filters.map((f) => (
        <span key={f.key} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-2.5 py-1 text-xs text-ink-600">
          {f.label && <span className="text-ink-400">{f.label}:</span>}
          <span className="font-medium text-ink-800">{f.value}</span>
          <button type="button" aria-label={`Remove ${f.label || ''} filter`} onClick={() => onRemove && onRemove(f.key)}
            className="opacity-50 transition hover:opacity-100"><X size={12} /></button>
        </span>
      ))}
      {filters.length > 1 && onClearAll && (
        <button type="button" onClick={onClearAll} className="text-xs font-medium text-brand-600 transition hover:text-brand-700">Clear all</button>
      )}
    </div>
  )
}
