import { Briefcase, Luggage, ShoppingBag } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { Option } from '../lib/types.ts'

// BaggageOptions — the add-on picker at the end of a booking: bags, extras, insurance, equipment hire.
// Quantity-based rather than single-choice, because people buy two of these.
// options: [{id, label, detail, price, icon, max, included}]
const ICONS = { cabin: ShoppingBag, carry: Briefcase, hold: Luggage }

interface BaggageOptionsProps {
  options?: any[]
  value?: Record<string, any>
  onChange?: (...args: any[]) => any
  title?: string
  currency?: string
  className?: string
}

export default function BaggageOptions({ options = [], value = {}, onChange, title = 'Add extras', currency = '', className }: BaggageOptionsProps) {
  const set = (id, n) => onChange && onChange({ ...value, [id]: Math.max(0, n) })
  const total = options.reduce((s, o) => s + (value[o.id] || 0) * (o.priceValue || 0), 0)
  return (
    <div className={className}>
      {title && <h3 className="mb-3 font-display text-base font-semibold text-ink-900">{title}</h3>}
      <ul className="space-y-2">
        {options.map((o) => {
          const n = value[o.id] || 0
          const Icon = o.icon || ICONS[o.id] || Luggage
          return (
            <li key={o.id} className={cx('flex items-center gap-4 rounded-xl border p-4',
              n > 0 ? 'border-brand-300 bg-brand-50/50' : 'border-ink-200')}>
              <Icon size={20} className={cx('shrink-0', n > 0 ? 'text-brand-600' : 'text-ink-400')} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">{o.label}</p>
                {o.detail && <p className="mt-0.5 text-xs text-ink-500">{o.detail}</p>}
              </div>
              {o.included ? (
                <span className="shrink-0 text-sm font-medium text-emerald-600">Included</span>
              ) : (
                <>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-ink-900">{o.price}</span>
                  <div className="flex shrink-0 items-center gap-1 rounded-lg border border-ink-200 bg-surface">
                    <button type="button" onClick={() => set(o.id, n - 1)} disabled={n === 0} aria-label={`One fewer ${o.label}`}
                      className={cx('grid h-8 w-8 place-items-center rounded-l-lg text-lg leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                        n === 0 ? 'cursor-not-allowed text-ink-300' : 'text-ink-600 hover:bg-ink-100')}>−</button>
                    <span className="w-6 text-center text-sm font-medium tabular-nums text-ink-900">{n}</span>
                    <button type="button" onClick={() => set(o.id, n + 1)} disabled={o.max != null && n >= o.max} aria-label={`One more ${o.label}`}
                      className={cx('grid h-8 w-8 place-items-center rounded-r-lg text-lg leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                        o.max != null && n >= o.max ? 'cursor-not-allowed text-ink-300' : 'text-ink-600 hover:bg-ink-100')}>+</button>
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
      {total > 0 && (
        <p className="mt-3 text-right text-sm text-ink-600">
          Extras total <span className="font-display font-semibold tabular-nums text-ink-900">{currency}{total.toFixed(2)}</span>
        </p>
      )}
    </div>
  )
}
