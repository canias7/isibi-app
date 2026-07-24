import { cx } from '../lib/cx.js'

// WeekSchedule — a weekly class/shift grid (fitness timetables, staff rotas, opening hours).
// days: ['Mon',…]  entries: [{day, time, title, meta, tone, onClick}]
export default function WeekSchedule({ days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], entries = [], emptyText = 'No sessions', className }) {
  const tones = {
    brand: 'bg-brand-50 border-brand-200 text-brand-800',
    accent: 'bg-accent-50 border-accent-200 text-accent-700',
    neutral: 'bg-ink-50 border-ink-200 text-ink-700',
  }
  return (
    <div className={cx('overflow-x-auto', className)}>
      <div className="grid min-w-[720px] grid-cols-7 gap-3">
        {days.map((d) => {
          const dayEntries = entries.filter((e) => e.day === d)
          return (
            <div key={d}>
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-ink-400">{d}</p>
              <div className="space-y-2">
                {dayEntries.length === 0 && (
                  <p className="rounded-lg border border-dashed border-ink-200 px-2 py-4 text-center text-xs text-ink-300">{emptyText}</p>
                )}
                {dayEntries.map((e, i) => (
                  <button key={i} type="button" onClick={e.onClick} disabled={!e.onClick}
                    className={cx('w-full rounded-lg border p-2 text-left transition', tones[e.tone] || tones.brand,
                      e.onClick && 'hover:shadow-sm')}>
                    <span className="block text-xs font-semibold tabular-nums">{e.time}</span>
                    <span className="block truncate text-xs font-medium">{e.title}</span>
                    {e.meta && <span className="block truncate text-[11px] opacity-70">{e.meta}</span>}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
