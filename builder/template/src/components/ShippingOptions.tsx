import { cx } from '../lib/cx.js'
import type { Option } from '../lib/types.ts'

interface ShippingOptionsProps {
  options?: any[]
  value?: any
  onChange?: (...args: any[]) => any
  label?: string
  name?: string
  className?: string
}

// ShippingOptions — the delivery-method chooser in a checkout. Radio cards rather than a <select>, because the
// price and ETA have to be readable side by side to be compared.
// options: [{id, label, eta, price, note, disabled}]. `price` is pre-formatted (or 'Free').
export default function ShippingOptions({ options = [], value, onChange, label = 'Delivery', name = 'shipping', className }: ShippingOptionsProps) {
  return (
    <fieldset className={className}>
      {label && <legend className="mb-2 text-sm font-medium text-ink-700">{label}</legend>}
      <div className="space-y-2">
        {options.map((o) => {
          const on = o.id === value
          return (
            <label key={o.id}
              className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500',
                o.disabled ? 'cursor-not-allowed border-ink-100 opacity-60'
                  : on ? 'border-brand-500 bg-brand-50/60' : 'border-ink-200 hover:border-ink-300')}>
              <input type="radio" name={name} value={o.id} checked={on} disabled={o.disabled}
                onChange={() => onChange && onChange(o.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-medium text-ink-900">{o.label}</span>
                  <span className={cx('text-sm font-medium tabular-nums', o.price === 'Free' ? 'text-emerald-600' : 'text-ink-900')}>{o.price}</span>
                </span>
                {o.eta && <span className="mt-0.5 block text-sm text-ink-500">{o.eta}</span>}
                {o.note && <span className="mt-1 block text-xs text-ink-400">{o.note}</span>}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
