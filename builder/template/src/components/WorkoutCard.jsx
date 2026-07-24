import { Link } from 'react-router-dom'
import { Dumbbell, Flame, Timer } from 'lucide-react'
import { cx } from '../lib/cx.js'

// WorkoutCard — a session/routine tile: gyms, training apps, physio programmes, class libraries.
export default function WorkoutCard({
  title, focus, image, alt, to, duration, level, calories, equipment, exercises, completed, className,
}) {
  const body = (
    <>
      {image && (
        <div className="relative aspect-[16/9] overflow-hidden bg-ink-100">
          <img src={image} alt={alt || ''} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          {completed && (
            <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">Done</span>
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        {focus && <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{focus}</p>}
        <h3 className="mt-1 font-display text-base font-semibold text-ink-900">{title}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
          {duration && <span className="inline-flex items-center gap-1"><Timer size={13} />{duration}</span>}
          {calories && <span className="inline-flex items-center gap-1"><Flame size={13} />{calories} kcal</span>}
          {exercises && <span className="inline-flex items-center gap-1"><Dumbbell size={13} />{exercises} moves</span>}
        </div>
        {(level || equipment) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {level && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">{level}</span>}
            {equipment && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600">{equipment}</span>}
          </div>
        )}
      </div>
    </>
  )
  const cls = cx('card-surface group flex flex-col overflow-hidden', to && 'transition hover:-translate-y-0.5 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', className)
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}
