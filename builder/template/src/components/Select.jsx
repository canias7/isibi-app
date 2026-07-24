import { forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cx } from '../lib/cx.js'

const Select = forwardRef(function Select(
  { label, hint, error, className, wrapperClassName, id, children, ...props },
  ref
) {
  const autoId = useId()
  const selectId = id || autoId
  return (
    <div className={cx('flex flex-col gap-1.5', wrapperClassName)}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-ink-700">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error}
          className={cx(
            'w-full appearance-none rounded-xl border bg-surface px-3.5 py-2.5 pr-9 text-sm text-ink-900 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500',
            error ? 'border-rose-400' : 'border-ink-200 hover:border-ink-300',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {!error && hint && <p className="text-xs text-ink-500">{hint}</p>}
    </div>
  )
})

export default Select