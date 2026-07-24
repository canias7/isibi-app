import { Check, Flag, Trash2, X } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { cx } from '../lib/cx.js'

// ModerationQueue — reported content awaiting a decision. Shows the REPORT REASON and the reported content
// side by side, because a moderator judging content without the complaint is guessing.
// items: [{id, content, author, avatar, at, reason, reporter, reportCount, type}]
export default function ModerationQueue({
  items = [], onApprove, onRemove, onEscalate, title = 'Awaiting review',
  emptyText = 'Nothing to review. The queue is clear.', className,
}) {
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      <div className="flex items-baseline justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
        {items.length > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">{items.length} pending</span>}
      </div>
      {items.length === 0
        ? <p className="px-5 py-12 text-center text-sm text-ink-400">{emptyText}</p>
        : (
          <ul className="divide-y divide-ink-100">
            {items.map((it) => (
              <li key={it.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-700">
                    <Flag size={11} />{it.reason}
                  </span>
                  {it.reportCount > 1 && <span className="text-ink-500">{it.reportCount} reports</span>}
                  {it.reporter && <span className="text-ink-400">reported by {it.reporter}</span>}
                  {it.type && <span className="ml-auto rounded-full bg-ink-100 px-2 py-0.5 text-ink-600">{it.type}</span>}
                </div>
                <blockquote className="mt-3 rounded-xl border-l-2 border-ink-200 bg-ink-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={it.author} src={it.avatar} size="xs" />
                    <span className="text-xs font-medium text-ink-700">{it.author}</span>
                    {it.at && <span className="text-xs text-ink-400">· {it.at}</span>}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{it.content}</p>
                </blockquote>
                <div className="mt-3 flex flex-wrap gap-2">
                  {onApprove && (
                    <button type="button" onClick={() => onApprove(it)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                      <Check size={14} />Keep
                    </button>
                  )}
                  {onRemove && (
                    <button type="button" onClick={() => onRemove(it)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                      <Trash2 size={14} />Remove
                    </button>
                  )}
                  {onEscalate && (
                    <button type="button" onClick={() => onEscalate(it)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-600 transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                      <X size={14} />Escalate
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}
