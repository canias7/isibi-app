import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import NotificationItem from './NotificationItem.tsx'
import { cx } from '../lib/cx.js'

interface NotificationCenterProps {
  items?: any[]
  onMarkAllRead?: (...args: any[]) => any
  onOpenItem?: (...args: any[]) => any
  seeAllTo?: any
  emptyText?: string
  className?: string
}

// NotificationCenter — the bell in the nav with its unread badge and dropdown list. NotificationItem is one row;
// this is the whole surface: count, panel, mark-all-read, "see all" link.
// items: [{id, title, body, time, icon, unread, to}]
export default function NotificationCenter({ items = [], onMarkAllRead, onOpenItem, seeAllTo, emptyText = 'You are all caught up.', className }: NotificationCenterProps) {
  const [open, setOpen] = useState(false)
  const box = useRef<any>(null)
  const unread = items.filter((i) => i.unread).length
  useEffect(() => {
    if (!open) return
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div ref={box} className={cx('relative', className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-ink-100 bg-surface shadow-soft sm:w-96" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="font-display text-sm font-semibold text-ink-900">Notifications</p>
            {unread > 0 && onMarkAllRead && (
              <button type="button" onClick={onMarkAllRead}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <CheckCheck size={13} />Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 divide-y divide-ink-100 overflow-y-auto">
            {items.length === 0
              ? <p className="px-4 py-10 text-center text-sm text-ink-400">{emptyText}</p>
              : items.map((n) => (
                <NotificationItem key={n.id} {...n}
                  onClick={() => { setOpen(false); onOpenItem && onOpenItem(n) }} />
              ))}
          </div>
          {seeAllTo && (
            <Link to={seeAllTo} onClick={() => setOpen(false)}
              className="block border-t border-ink-100 px-4 py-2.5 text-center text-sm font-medium text-brand-600 transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">
              See all notifications
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
