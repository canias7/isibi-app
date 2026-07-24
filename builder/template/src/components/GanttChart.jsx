import { cx } from '../lib/cx.js'

const DAY = 86400000
const at = (d) => new Date(d + 'T00:00:00').getTime()

// GanttChart — tasks on a timeline: project plans, campaign schedules, staff assignments, production runs.
// tasks: [{id, label, start, end, progress, tone, group}] with ISO dates. The scale is derived from the data,
// so no configuration is needed.
export default function GanttChart({ tasks = [], title, today, className }) {
  const dated = tasks.filter((t) => t.start && t.end)
  if (!dated.length) return null
  const min = Math.min(...dated.map((t) => at(t.start)))
  const max = Math.max(...dated.map((t) => at(t.end)))
  const span = Math.max(DAY, max - min)
  const pct = (ms) => ((ms - min) / span) * 100
  const tones = {
    brand: 'bg-brand-500', accent: 'bg-accent-500', neutral: 'bg-ink-400',
    success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-rose-500',
  }
  // One tick per week, or per month once the plan runs long enough that weekly ticks would crowd.
  const weeks = Math.ceil(span / (7 * DAY))
  const stepDays = weeks > 16 ? 30 : 7
  const ticks = []
  for (let ms = min; ms <= max; ms += stepDays * DAY) ticks.push(ms)
  const nowPct = today ? pct(at(today)) : null

  return (
    <div className={cx('card-surface p-5', className)}>
      {title && <h3 className="mb-4 font-display text-base font-semibold text-ink-900">{title}</h3>}
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="mb-2 flex text-[11px] text-ink-400">
            <span className="w-40 shrink-0" />
            <div className="relative h-4 flex-1">
              {ticks.map((ms, i) => (
                <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(ms)}%` }}>
                  {new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              ))}
            </div>
          </div>
          <ul className="space-y-1.5">
            {dated.map((t) => {
              const left = pct(at(t.start))
              const width = Math.max(1.5, pct(at(t.end)) - left)
              return (
                <li key={t.id || t.label} className="flex items-center">
                  <div className="w-40 shrink-0 pr-3">
                    <p className="truncate text-sm font-medium text-ink-900">{t.label}</p>
                    {t.group && <p className="truncate text-[11px] text-ink-400">{t.group}</p>}
                  </div>
                  <div className="relative h-7 flex-1 rounded-md bg-ink-50">
                    {ticks.map((ms, i) => <span key={i} className="absolute inset-y-0 w-px bg-ink-100" style={{ left: `${pct(ms)}%` }} aria-hidden="true" />)}
                    {nowPct !== null && nowPct >= 0 && nowPct <= 100 && (
                      <span className="absolute inset-y-0 z-10 w-0.5 bg-rose-400/70" style={{ left: `${nowPct}%` }} aria-hidden="true" />
                    )}
                    {/* Track and fill are SIBLINGS, not parent/child: putting the opacity on a parent would fade
                        the fill along with it. Solid = done is the reading everyone expects — shading the
                        remainder instead makes the unfinished part look like the emphasis. */}
                    <div className="absolute inset-y-1 overflow-hidden rounded-md"
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${t.label}: ${t.start} → ${t.end}${typeof t.progress === 'number' ? ` · ${t.progress}% done` : ''}`}>
                      <span className={cx('absolute inset-0 rounded-md', tones[t.tone] || tones.brand,
                        typeof t.progress === 'number' && 'opacity-35')} />
                      {typeof t.progress === 'number' && (
                        <span className={cx('absolute inset-y-0 left-0 rounded-md', tones[t.tone] || tones.brand)}
                          style={{ width: `${Math.min(100, Math.max(0, t.progress))}%` }} />
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
