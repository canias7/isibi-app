import { Check } from 'lucide-react'
import Button from './Button.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface PricingCardProps {
  name?: string
  price?: any
  period?: string
  description?: ReactNode
  features?: any[]
  cta?: string
  onSelect?: (...args: any[]) => any
  featured?: boolean
  badge?: any
  className?: string
}

// PricingCard — one plan on a pricing page. features: array of strings.
export default function PricingCard({ name, price, period = '/mo', description, features = [], cta = 'Get started', onSelect, featured = false, badge, className }: PricingCardProps) {
  return (
    <div className={cx('relative flex flex-col rounded-xl2 border p-6',
      featured ? 'border-brand-500 bg-surface shadow-soft ring-1 ring-brand-500' : 'border-ink-100 bg-surface', className)}>
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-brandfg">{badge}</span>
      )}
      <p className="font-display text-sm font-semibold uppercase tracking-wider text-ink-500">{name}</p>
      <p className="mt-3 flex items-baseline gap-1">
        <span className="font-display text-4xl font-bold tracking-tight text-ink-900">{price}</span>
        {period && <span className="text-sm text-ink-400">{period}</span>}
      </p>
      {description && <p className="mt-2 text-sm text-ink-500">{description}</p>}
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-ink-700">
            <Check size={16} className="mt-0.5 shrink-0 text-brand-500" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button className="mt-6 w-full" variant={featured ? 'primary' : 'outline'} onClick={onSelect}>{cta}</Button>
    </div>
  )
}
