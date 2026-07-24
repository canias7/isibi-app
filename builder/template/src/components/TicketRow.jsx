import { Link } from 'react-router-dom'
import { MessageSquare, Paperclip } from 'lucide-react'
import Avatar from './Avatar.jsx'
import StatusPill from './StatusPill.jsx'
import { cx } from '../lib/cx.js'

// TicketRow — one support ticket in a queue. Priority is a coloured left rail rather than another chip:
// agents scan the rail down the list, and a wall of chips stops meaning anything.
export default function TicketRow({
  id, subject, preview, requester, avatar, assignee, priority = 'normal', status, updated,
  replies, attachments, unread, to, onSelect, selected, className,
}) {
  const rails = { urgent: 'bg-rose-500', high: 'bg-amber-500', normal: 'bg-ink-200', low: 'bg-ink-100' }
  const inner = (
    <>
      <span className={cx('absolute inset-y-0 left-0 w-1', rails[priority] || rails.normal)} aria-label={`${priority} priority`} />
      <span className="min-w-0 flex-1 pl-3">
        <span className="flex flex-wrap items-baseline gap-x-2">
          {id && <span className="font-mono text-xs text-ink-400">#{id}</span>}
          <span className={cx('truncate text-sm', unread ? 'font-semibold text-ink-900' : 'font-medium text-ink-800')}>{subject}</span>
        </span>
        {preview && <span className="mt-0.5 block truncate text-xs text-ink-500">{preview}</span>}
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
          {requester && <span className="inline-flex items-center gap-1.5"><Avatar name={requester} src={avatar} size="xs" />{requester}</span>}
          {replies > 0 && <span className="inline-flex items-center gap-1"><MessageSquare size={11} />{replies}</span>}
          {attachments > 0 && <span className="inline-flex items-center gap-1"><Paperclip size={11} />{attachments}</span>}
          {updated && <span>{updated}</span>}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        {status && <StatusPill status={status} />}
        {assignee && <span className="text-xs text-ink-400">{assignee}</span>}
      </span>
    </>
  )
  const cls = cx('relative flex w-full items-start gap-3 overflow-hidden py-3.5 pr-4 text-left transition',
    selected ? 'bg-brand-50' : 'hover:bg-ink-50',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500', className)
  if (to) return <Link to={to} className={cls}>{inner}</Link>
  return <button type="button" onClick={onSelect} className={cls}>{inner}</button>
}
