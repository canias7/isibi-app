import { Search, X } from 'lucide-react'
import { cx } from '../lib/cx.js'

export default function SearchInput({ value = '', onChange, onClear, placeholder = 'Search…', className, ...props }) {
  return (
    <div className={cx('relative', className)}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-9 pr-9 text-sm text-ink-900 placeholder:text-ink-400
          focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20
          [&::-webkit-search-cancel-button]:appearance-none"
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => (onClear ? onClear() : onChange && onChange(''))}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 transition hover:text-ink-700
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
