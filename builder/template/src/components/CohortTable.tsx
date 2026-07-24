import { cx } from '../lib/cx.js'

interface CohortTableProps {
  cohorts?: any[]
  periodLabel?: string
  title?: string
  maxPeriods?: number
  className?: string
}

// CohortTable — retention by signup cohort: rows are cohorts, columns are periods since joining, cells are
// shaded by retention. The standard way to see whether a product is actually keeping people.
// cohorts: [{label, size, values:[n, n, …]}] where values are PERCENTAGES.
export default function CohortTable({
  cohorts = [], periodLabel = 'Month', title = 'Retention by cohort', maxPeriods = 8, className,
}: CohortTableProps) {
  if (!cohorts.length) return null
  const cols = Math.min(maxPeriods, Math.max(...cohorts.map((c) => c.values.length)))
  // Five bands rather than a continuous gradient: discrete steps are far easier to compare across a grid.
  const shade = (v) => (v == null ? 'bg-transparent text-transparent'
    : v >= 60 ? 'bg-brand-700 text-white'
    : v >= 40 ? 'bg-brand-500 text-white'
    : v >= 25 ? 'bg-brand-300 text-brand-900'
    : v >= 10 ? 'bg-brand-100 text-brand-800' : 'bg-ink-50 text-ink-500')
  const avg = (i) => {
    const vals = cohorts.map((c) => c.values[i]).filter((v) => v != null)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      {title && <h3 className="border-b border-ink-100 px-5 py-4 font-display text-base font-semibold text-ink-900">{title}</h3>}
      <div className="overflow-x-auto p-5">
        <table className="w-full border-separate border-spacing-1 text-xs">
          <thead>
            <tr className="text-ink-400">
              <th className="px-2 pb-1 text-left font-medium">Cohort</th>
              <th className="px-2 pb-1 text-right font-medium">Size</th>
              {Array.from({ length: cols }, (_, i) => (
                <th key={i} className="min-w-11 pb-1 text-center font-medium">{periodLabel[0]}{i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c, r) => (
              <tr key={r}>
                <td className="whitespace-nowrap px-2 text-left font-medium text-ink-700">{c.label}</td>
                <td className="px-2 text-right tabular-nums text-ink-500">{(c.size || 0).toLocaleString()}</td>
                {Array.from({ length: cols }, (_, i) => {
                  const v = c.values[i]
                  return (
                    <td key={i} className={cx('rounded-md px-1 py-1.5 text-center font-medium tabular-nums', shade(v))}>
                      {v == null ? '' : `${Math.round(v)}%`}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <td className="px-2 pt-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-400" colSpan={2}>Average</td>
              {Array.from({ length: cols }, (_, i) => {
                const a = avg(i)
                return <td key={i} className="px-1 pt-2 text-center text-[11px] font-semibold tabular-nums text-ink-600">{a == null ? '' : `${Math.round(a)}%`}</td>
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
