import { CheckCircle2, Circle, Lock, PlayCircle } from 'lucide-react'
import Progress from './Progress.jsx'
import { cx } from '../lib/cx.js'

// LessonList — a course curriculum with completion state. sections: [{title, lessons:[{title,duration,done,locked}]}]
export default function LessonList({ sections = [], onSelect, activeId, showProgress = true, className }) {
  const all = sections.flatMap((s) => s.lessons || [])
  const done = all.filter((l) => l.done).length
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      {showProgress && all.length > 0 && (
        <div className="border-b border-ink-100 px-5 py-4">
          <Progress value={done} max={all.length} label={`${done} of ${all.length} lessons complete`} showValue />
        </div>
      )}
      {sections.map((sec, si) => (
        <div key={si}>
          <p className="border-b border-ink-100 bg-ink-50/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-500">
            {sec.title}
          </p>
          <ul className="divide-y divide-ink-100">
            {(sec.lessons || []).map((l, li) => (
              <li key={li}>
                <button type="button" disabled={l.locked} onClick={() => onSelect && onSelect(l)}
                  className={cx('flex w-full items-center gap-3 px-5 py-3 text-left transition',
                    l.locked ? 'cursor-not-allowed opacity-60' : 'hover:bg-ink-50',
                    activeId && l.id === activeId && 'bg-brand-50')}>
                  <span className="shrink-0">
                    {l.locked ? <Lock size={16} className="text-ink-300" />
                      : l.done ? <CheckCircle2 size={16} className="text-emerald-500" />
                      : activeId && l.id === activeId ? <PlayCircle size={16} className="text-brand-500" />
                      : <Circle size={16} className="text-ink-300" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{l.title}</span>
                  {l.duration && <span className="shrink-0 text-xs tabular-nums text-ink-400">{l.duration}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
