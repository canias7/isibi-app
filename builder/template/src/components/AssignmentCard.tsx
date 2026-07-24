import { Link } from 'react-router-dom'
import { CalendarClock, FileText, Paperclip } from 'lucide-react'
import StatusPill from './StatusPill.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface AssignmentCardProps {
  title?: ReactNode
  course?: any
  brief?: any
  due?: any
  dueIso?: any
  status?: string
  grade?: any
  points?: any
  attachments?: number
  to: string
  className?: string
}

// AssignmentCard — a piece of coursework: brief, due date, submission state, grade. Overdue is computed from
// `due` vs `dueIso` so a page doesn't have to pre-label it, and it turns red on its own.
export default function AssignmentCard({
  title, course, brief, due, dueIso, status = 'Not started', grade, points, attachments = 0, to, className,
}: AssignmentCardProps) {
  const overdue = dueIso && new Date(dueIso) < new Date() && !/submitted|graded|complete/i.test(status)
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {course && <p className="text-xs font-medium uppercase tracking-wider text-brand-600">{course}</p>}
          <h3 className="mt-0.5 font-display text-base font-semibold text-ink-900">{title}</h3>
        </div>
        <StatusPill status={overdue ? 'Overdue' : status} className="shrink-0" />
      </div>
      {brief && <p className="mt-2 line-clamp-2 text-sm text-ink-600">{brief}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {due && (
          <span className={cx('inline-flex items-center gap-1.5', overdue ? 'font-medium text-rose-600' : 'text-ink-500')}>
            <CalendarClock size={13} />{overdue ? 'Was due ' : 'Due '}{due}
          </span>
        )}
        {attachments > 0 && <span className="inline-flex items-center gap-1.5 text-ink-500"><Paperclip size={13} />{attachments} file{attachments === 1 ? '' : 's'}</span>}
        {points && <span className="inline-flex items-center gap-1.5 text-ink-500"><FileText size={13} />{points} points</span>}
        {grade && <span className="ml-auto font-display text-sm font-semibold tabular-nums text-ink-900">{grade}</span>}
      </div>
    </>
  )
  const cls = cx('card-surface block p-5', to && 'transition hover:border-ink-200 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', className)
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}
