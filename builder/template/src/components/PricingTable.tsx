import { useState } from 'react'
import PricingCard from './PricingCard.tsx'
import SegmentedControl from './SegmentedControl.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface PricingTableProps {
  title?: string
  subtitle?: ReactNode
  plans?: any[]
  showToggle?: boolean
  className?: string
}

// PricingTable — the plans grid with an optional monthly/yearly switch.
// plans: [{name, price, yearlyPrice, description, features, cta, featured, badge, onSelect}]
export default function PricingTable({ title = 'Simple pricing', subtitle, plans = [], showToggle = true, className }: PricingTableProps) {
  const [period, setPeriod] = useState('mo')
  return (
    <section className={cx('py-16', className)}>
      <div className="container-page">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">{title}</h2>
          {subtitle && <p className="mt-3 text-ink-600">{subtitle}</p>}
          {showToggle && plans.some((p) => p.yearlyPrice) && (
            <div className="mt-6 flex justify-center">
              <SegmentedControl value={period} onChange={setPeriod}
                options={[{ value: 'mo', label: 'Monthly' }, { value: 'yr', label: 'Yearly' }]} />
            </div>
          )}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((p, i) => (
            <PricingCard key={i} {...p}
              price={period === 'yr' && p.yearlyPrice ? p.yearlyPrice : p.price}
              period={period === 'yr' ? '/yr' : '/mo'} />
          ))}
        </div>
      </div>
    </section>
  )
}
