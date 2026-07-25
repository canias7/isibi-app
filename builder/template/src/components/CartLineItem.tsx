import { Trash2 } from 'lucide-react'
import QuantityStepper from './QuantityStepper.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface CartLineItemProps {
  title?: ReactNode
  meta?: any
  price?: any
  image?: string
  quantity?: number
  onQuantityChange?: (...args: any[]) => any
  onRemove?: (...args: any[]) => any
  className?: string
}

// CartLineItem — one row in a cart/basket, with quantity and remove.
export default function CartLineItem({ title, meta, price, image, quantity = 1, onQuantityChange, onRemove, className }: CartLineItemProps) {
  return (
    <div className={cx('flex items-start gap-4 py-4', className)}>
      {image && <img src={image} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />}
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold text-ink-900">{title}</p>
        {meta && <p className="mt-0.5 text-xs text-ink-500">{meta}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <QuantityStepper size="sm" value={quantity} onChange={onQuantityChange} />
          {onRemove && (
            <button type="button" onClick={onRemove}
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-400 transition hover:text-rose-600">
              <Trash2 size={13} />Remove
            </button>
          )}
        </div>
      </div>
      <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-ink-900">{price}</span>
    </div>
  )
}
