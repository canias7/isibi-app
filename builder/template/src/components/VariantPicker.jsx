import { cx } from '../lib/cx.js'

// VariantPicker — size / colour / material selection on a product page. options: [{value, label, swatch, disabled}].
// `swatch` renders a colour circle instead of a text chip; out-of-stock options stay VISIBLE but struck through,
// because hiding them makes a shopper think the size was never made.
export default function VariantPicker({ label, options = [], value, onChange, columns, showSelected = true, className }) {
  const swatches = options.some((o) => o.swatch)
  const selected = options.find((o) => o.value === value)
  return (
    <div className={className}>
      {label && (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-ink-700">{label}</span>
          {showSelected && selected && <span className="text-sm text-ink-500">{selected.label}</span>}
        </div>
      )}
      <div className={cx('flex flex-wrap gap-2', columns && `grid grid-cols-${columns}`)}>
        {options.map((o) => {
          const on = o.value === value
          if (swatches) {
            return (
              <button key={o.value} type="button" disabled={o.disabled} onClick={() => onChange && onChange(o.value)}
                aria-label={o.label} aria-pressed={on} title={o.label + (o.disabled ? ' — sold out' : '')}
                style={{ backgroundColor: o.swatch }}
                className={cx('relative h-9 w-9 rounded-full border border-ink-900/10 transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                  on && 'ring-2 ring-ink-900 ring-offset-2 ring-offset-surface',
                  o.disabled ? 'cursor-not-allowed opacity-40' : 'hover:scale-105')}>
                {o.disabled && <span className="absolute inset-0 grid place-items-center"><span className="h-px w-full rotate-45 bg-ink-900/50" /></span>}
              </button>
            )
          }
          return (
            <button key={o.value} type="button" disabled={o.disabled} onClick={() => onChange && onChange(o.value)}
              aria-pressed={on}
              className={cx('min-w-11 rounded-xl border px-3.5 py-2 text-sm font-medium transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                on ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : o.disabled ? 'cursor-not-allowed border-ink-100 text-ink-300 line-through'
                  : 'border-ink-200 text-ink-700 hover:border-ink-400')}>
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
