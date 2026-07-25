import Stat from './Stat.tsx'
import { cx } from '../lib/cx.js'
import type { StatItem } from '../lib/types.ts'

interface StatRowProps {
  stats?: any[]
  columns?: number
  className?: string
}

// StatRow — the KPI strip at the top of a dashboard. stats: [{label, value, delta, deltaLabel, icon, invertDelta}]
export default function StatRow({ stats = [], columns = 4, className }: StatRowProps) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }
  return (
    <div className={cx('grid gap-4', cols[columns] || cols[4], className)}>
      {stats.map((s, i) => <Stat key={i} {...s} />)}
    </div>
  )
}
