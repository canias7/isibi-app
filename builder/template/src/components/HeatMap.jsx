import { cx } from '../lib/cx.js'

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// HeatMap — the contribution-graph calendar: one square per day, shaded by volume. Reads a year of activity
// at a glance, which no line chart does. values: {'YYYY-MM-DD': number}. `weeks` sets how far back to go.
export default function HeatMap({ values = {}, weeks = 26, endDate, title, legend = true, onSelect, className }) {
  const end = endDate ? new Date(endDate + 'T00:00:00') : new Date()
  // Wind back to the Sunday on/before the end date so every column is a clean week.
  const lastSunday = new Date(end); lastSunday.setDate(end.getDate() - end.getDay())
  const cols = Array.from({ length: weeks }, (_, w) => {
    const colStart = new Date(lastSunday); colStart.setDate(lastSunday.getDate() - (weeks - 1 - w) * 7)
    return Array.from({ length: 7 }, (_, d) => {
      const day = new Date(colStart); day.setDate(colStart.getDate() + d)
      return day > end ? null : iso(day)
    })
  })
  const nums = Object.values(values).filter((n) => n > 0)
  const max = nums.length ? Math.max(...nums) : 1
  const level = (v) => (!v ? 0 : Math.min(4, Math.ceil((v / max) * 4)))
  const tints = ['bg-ink-100', 'bg-brand-200', 'bg-brand-300', 'bg-brand-500', 'bg-brand-700']
  const total = nums.reduce((s, n) => s + n, 0)
  // A month label is ~26px wide but a column is 16px, so two labels fewer than 2 columns apart collide
  // ("JanFeb"). Walk the columns once, remembering where the last label went, and skip the crowded ones.
  const monthLabels = (() => {
    const out = new Array(cols.length).fill(null)
    let lastMonth = -1, lastAt = -99
    cols.forEach((col, w) => {
      const first = col.find(Boolean)
      if (!first) return
      const m = new Date(first + 'T00:00:00').getMonth()
      if (m === lastMonth) return
      lastMonth = m
      if (w - lastAt < 2) return
      lastAt = w
      out[w] = new Date(first + 'T00:00:00').toLocaleDateString(undefined, { month: 'short' })
    })
    return out
  })()

  return (
    <div className={cx('card-surface p-5', className)}>
      {(title || legend) && (
        <div className="mb-3 flex items-baseline justify-between gap-4">
          {title && <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>}
          <span className="text-xs tabular-nums text-ink-500">{total.toLocaleString()} in the last {weeks} weeks</span>
        </div>
      )}
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1">
          <div className="flex gap-1 pl-0">
            {cols.map((_, w) => (
              <span key={w} className="w-3 whitespace-nowrap text-[9px] leading-none text-ink-400">{monthLabels[w]}</span>
            ))}
          </div>
          <div className="flex gap-1">
            {cols.map((col, w) => (
              <div key={w} className="flex flex-col gap-1">
                {col.map((day, d) => day === null
                  ? <span key={d} className="h-3 w-3" />
                  : (
                    <button key={d} type="button" disabled={!onSelect} onClick={() => onSelect && onSelect(day, values[day] || 0)}
                      title={`${day}: ${values[day] || 0}`} aria-label={`${day}: ${values[day] || 0}`}
                      className={cx('h-3 w-3 rounded-[3px] transition', tints[level(values[day])],
                        onSelect && 'hover:ring-2 hover:ring-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500')} />
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {legend && (
        <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-ink-400">
          <span>Less</span>
          {tints.map((t) => <span key={t} className={cx('h-3 w-3 rounded-[3px]', t)} />)}
          <span>More</span>
        </div>
      )}
    </div>
  )
}
