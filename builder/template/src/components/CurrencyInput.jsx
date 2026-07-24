import { useId } from 'react'
import { cx } from '../lib/cx.js'

// CurrencyInput — a money field with the symbol inside the control and an optional unit suffix
// (/mo, /night, per seat). Keeps the raw number in state; formatting is the caller's job on display.
export default function CurrencyInput({
  label, value, onChange, symbol = '$', suffix, hint, error, min = 0, step = '0.01',
  placeholder = '0.00', className, wrapperClassName, id, ...props
}) {
  const autoId = useId()
  const fieldId = id || autoId
  return (
    <div className={cx('flex flex-col gap-1.5', wrapperClassName)}>
      {label && <label htmlFor={fieldId} className="text-sm font-medium text-ink-700">{label}</label>}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 grid w-9 place-items-center text-sm font-medium text-ink-400">{symbol}</span>
        <input id={fieldId} type="number" inputMode="decimal" min={min} step={step} placeholder={placeholder}
          value={value} onChange={(e) => onChange && onChange(e.target.value)} aria-invalid={!!error}
          className={cx('w-full rounded-xl border bg-surface py-2.5 pl-9 text-sm tabular-nums text-ink-900 transition-colors',
            'placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500',
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            suffix ? 'pr-16' : 'pr-3.5',
            error ? 'border-rose-400' : 'border-ink-200 hover:border-ink-300', className)}
          {...props} />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-0 grid place-items-center pr-3.5 text-sm text-ink-400">{suffix}</span>}
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {!error && hint && <p className="text-xs text-ink-500">{hint}</p>}
    </div>
  )
}
