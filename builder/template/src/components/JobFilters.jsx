import { X } from 'lucide-react'
import SearchInput from './SearchInput.jsx'
import RangeSlider from './RangeSlider.jsx'
import { cx } from '../lib/cx.js'

// JobFilters — the faceted sidebar for a listings search: keyword, checkbox groups, a numeric range.
// Generic despite the name — the same shape filters properties, courses, products or events.
// facets: [{key, title, options:[{value,label,count}]}]
export default function JobFilters({
  query, onQueryChange, facets = [], value = {}, onChange, range, onRangeChange, rangeProps = {},
  onClear, title = 'Filters', className,
}) {
  const active = Object.values(value).reduce((n, v) => n + (v ? v.length : 0), 0)
  const toggle = (key, val) => {
    if (!onChange) return
    const cur = value[key] || []
    onChange({ ...value, [key]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] })
  }
  return (
    <aside className={cx('space-y-6', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-ink-900">
          {title}{active > 0 && <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">{active}</span>}
        </h3>
        {active > 0 && onClear && (
          <button type="button" onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-medium text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <X size={12} />Clear all
          </button>
        )}
      </div>
      {onQueryChange && <SearchInput value={query} onChange={onQueryChange} placeholder="Search…" />}
      {range && (
        <RangeSlider value={range} onChange={onRangeChange} {...rangeProps} />
      )}
      {facets.map((f) => (
        <fieldset key={f.key}>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{f.title}</legend>
          <div className="space-y-1.5">
            {f.options.map((o) => {
              const on = (value[f.key] || []).includes(o.value)
              return (
                <label key={o.value} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input type="checkbox" checked={on} onChange={() => toggle(f.key, o.value)}
                    className="h-4 w-4 shrink-0 rounded accent-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" />
                  <span className={cx('min-w-0 flex-1 truncate', on ? 'font-medium text-ink-900' : 'text-ink-700')}>{o.label}</span>
                  {o.count != null && <span className="shrink-0 text-xs tabular-nums text-ink-400">{o.count}</span>}
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
    </aside>
  )
}
