import { Check } from 'lucide-react'
import { cx } from '../lib/cx.js'

// ExerciseList — the sets/reps/weight table inside a workout, with per-set tick-off. Also fits any
// "repeat this N times and log it" routine: physio, rehab, practice drills.
// exercises: [{id, name, note, sets:[{reps, weight, done}], rest}]
export default function ExerciseList({ exercises = [], onToggleSet, unit = 'kg', className }) {
  return (
    <ol className={cx('space-y-3', className)}>
      {exercises.map((ex, ei) => {
        const done = (ex.sets || []).filter((s) => s.done).length
        const total = (ex.sets || []).length
        return (
          <li key={ex.id || ei} className="card-surface overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 border-b border-ink-100 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-ink-900">
                  <span className="mr-2 tabular-nums text-ink-400">{ei + 1}</span>{ex.name}
                </p>
                {ex.note && <p className="mt-0.5 text-xs text-ink-500">{ex.note}</p>}
              </div>
              <span className={cx('shrink-0 text-xs tabular-nums', done === total && total > 0 ? 'font-medium text-emerald-600' : 'text-ink-400')}>
                {done}/{total} sets
              </span>
            </div>
            <ul className="divide-y divide-ink-100">
              {(ex.sets || []).map((s, si) => (
                <li key={si}>
                  <button type="button" onClick={() => onToggleSet && onToggleSet(ex.id ?? ei, si)} disabled={!onToggleSet}
                    className={cx('flex w-full items-center gap-4 px-4 py-2.5 text-left text-sm transition',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
                      s.done ? 'bg-emerald-50/60' : onToggleSet && 'hover:bg-ink-50')}>
                    <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                      s.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-ink-300')}>
                      {s.done && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span className="w-12 shrink-0 text-xs text-ink-400">Set {si + 1}</span>
                    <span className="tabular-nums text-ink-800">{s.reps} reps</span>
                    {s.weight != null && <span className="tabular-nums text-ink-600">{s.weight} {unit}</span>}
                  </button>
                </li>
              ))}
            </ul>
            {ex.rest && <p className="border-t border-ink-100 bg-ink-50/60 px-4 py-2 text-xs text-ink-500">Rest {ex.rest} between sets</p>}
          </li>
        )
      })}
    </ol>
  )
}
