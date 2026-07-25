import { Bike, ShoppingBag, UtensilsCrossed } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { Option } from '../lib/types.ts'

// OrderTypeToggle — delivery / pickup / dine-in. The first choice on any food ordering flow, and it changes
// what the rest of the checkout asks for, so it gets prominent treatment rather than a dropdown.
const PRESET = {
  delivery: { label: 'Delivery', icon: Bike },
  pickup: { label: 'Pickup', icon: ShoppingBag },
  dinein: { label: 'Dine in', icon: UtensilsCrossed },
}
interface OrderTypeToggleProps {
  value?: any
  onChange?: (...args: any[]) => any
  options?: any[]
  meta?: Record<string, any>
  className?: string
}

export default function OrderTypeToggle({ value, onChange, options = ['delivery', 'pickup'], meta = {}, className }: OrderTypeToggleProps) {
  return (
    <div role="radiogroup" className={cx('grid gap-2', options.length > 2 ? 'grid-cols-3' : 'grid-cols-2', className)}>
      {options.map((key) => {
        const o = typeof key === 'string' ? PRESET[key] || { label: key } : key
        const id = typeof key === 'string' ? key : key.id
        const Icon = o.icon
        const on = value === id
        const info = meta[id]
        return (
          <button key={id} type="button" role="radio" aria-checked={on} onClick={() => onChange && onChange(id)}
            className={cx('flex flex-col items-center gap-1 rounded-xl border px-3 py-3.5 text-center transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:border-ink-400')}>
            {Icon && <Icon size={18} className={on ? 'text-brand-600' : 'text-ink-400'} />}
            <span className="text-sm font-medium">{o.label}</span>
            {info && <span className="text-xs text-ink-400">{info}</span>}
          </button>
        )
      })}
    </div>
  )
}
