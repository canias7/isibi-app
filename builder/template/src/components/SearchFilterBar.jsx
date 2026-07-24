import SearchInput from './SearchInput.jsx'
import { cx } from '../lib/cx.js'

// SearchFilterBar — the standard toolbar above a list: search + filter controls + view switch.
export default function SearchFilterBar({ query, onQueryChange, placeholder = 'Search…', filters, trailing, className }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-3', className)}>
      <SearchInput value={query} onChange={onQueryChange} placeholder={placeholder} className="min-w-56 flex-1" />
      {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  )
}
