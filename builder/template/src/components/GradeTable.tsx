import { cx } from '../lib/cx.js'

interface GradeTableProps {
  rows?: any[]
  title?: string
  passMark?: any
  className?: string
}

// GradeTable — the gradebook: one row per assessment, with weight, score and the running total.
// rows: [{label, weight, score, outOf, submitted}]. The weighted average is computed here so pages can't
// disagree about how it's worked out.
export default function GradeTable({ rows = [], title = 'Grades', passMark, className }: GradeTableProps) {
  const graded = rows.filter((r) => typeof r.score === 'number')
  const weightSum = graded.reduce((s, r) => s + (r.weight || 0), 0)
  const earned = graded.reduce((s, r) => s + ((r.score / (r.outOf || 100)) * (r.weight || 0)), 0)
  const overall = weightSum ? Math.round((earned / weightSum) * 100) : null
  const pct = (r) => (typeof r.score === 'number' ? Math.round((r.score / (r.outOf || 100)) * 100) : null)
  const tone = (p) => (p == null ? 'text-ink-400' : passMark != null && p < passMark ? 'text-rose-600' : 'text-ink-900')
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      <div className="flex items-baseline justify-between border-b border-ink-100 px-5 py-4">
        <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
        {overall != null && (
          <span className="text-sm text-ink-500">
            Overall <span className={cx('font-display text-base font-semibold tabular-nums', tone(overall))}>{overall}%</span>
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-xs uppercase tracking-wider text-ink-400">
              <th className="px-5 py-2.5 text-left font-medium">Assessment</th>
              <th className="px-5 py-2.5 text-right font-medium">Weight</th>
              <th className="px-5 py-2.5 text-right font-medium">Score</th>
              <th className="px-5 py-2.5 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r, i) => {
              const p = pct(r)
              return (
                <tr key={i}>
                  <td className="px-5 py-3">
                    <span className="font-medium text-ink-900">{r.label}</span>
                    {r.submitted && <span className="ml-2 text-xs text-ink-400">{r.submitted}</span>}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-ink-500">{r.weight ? `${r.weight}%` : '—'}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-ink-700">
                    {typeof r.score === 'number' ? `${r.score} / ${r.outOf || 100}` : <span className="text-ink-300">Not graded</span>}
                  </td>
                  <td className={cx('px-5 py-3 text-right font-medium tabular-nums', tone(p))}>{p == null ? '—' : `${p}%`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
