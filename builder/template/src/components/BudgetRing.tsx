import { cx } from '../lib/cx.js'

interface BudgetRingProps {
  spent?: number
  budget?: number
  currency?: string
  label?: string
  period?: any
  size?: number
  thickness?: number
  className?: string
}

// BudgetRing — spend against a budget as a ring that goes amber then red as it fills, and OVERFILLS visibly
// when you go past 100%. ProgressRing caps at the max; a budget you've blown has to look blown.
export default function BudgetRing({
  spent = 0, budget = 0, currency = '$', label = 'Spent this month', period, size = 150, thickness = 14, className,
}: BudgetRingProps) {
  const pct = budget > 0 ? (spent / budget) * 100 : 0
  const shown = Math.min(100, pct)
  const over = pct > 100
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const tone = over ? 'text-rose-500' : pct >= 85 ? 'text-amber-500' : 'text-brand-500'
  const left = budget - spent
  const money = (n) => currency + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })
  return (
    <div className={cx('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${label}: ${Math.round(pct)}% of budget`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-ink-100" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} stroke="currentColor" strokeLinecap="round"
            strokeDasharray={`${(shown / 100) * c} ${c}`} className={cx(tone, 'transition-all duration-700')} />
          {/* A second, inset arc shows the overspill so 130% doesn't look identical to 100%. */}
          {over && (
            <circle cx={size / 2} cy={size / 2} r={r - thickness} fill="none" strokeWidth={4} stroke="currentColor" strokeLinecap="round"
              strokeDasharray={`${(Math.min(100, pct - 100) / 100) * 2 * Math.PI * (r - thickness)} ${2 * Math.PI * (r - thickness)}`}
              className="text-rose-400" />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold tabular-nums leading-none text-ink-900">{money(spent)}</span>
          <span className="mt-1 text-xs text-ink-400">of {money(budget)}</span>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-ink-700">{label}</p>
      <p className={cx('mt-0.5 text-xs tabular-nums', over ? 'font-medium text-rose-600' : 'text-ink-500')}>
        {over ? `${money(left)} over budget` : `${money(left)} left`}{period && ` · ${period}`}
      </p>
    </div>
  )
}
