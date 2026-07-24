import { cx } from '../lib/cx.js'
import type { StatItem } from '../lib/types.ts'

interface StatsBandProps {
  stats?: any[]
  className?: string
}

// StatsBand — headline numbers ("2,400 bookings · 4.9 rating · 30s setup"). stats: [{value, label}]
export default function StatsBand({ stats = [], className }: StatsBandProps) {
  return (
    <section className={cx('py-14', className)}>
      <div className="container-page">
        <dl className="grid gap-8 text-center sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div key={i}>
              <dt className="order-2 mt-1 text-sm text-ink-500">{s.label}</dt>
              <dd className="font-display text-4xl font-bold tracking-tight text-ink-900">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
