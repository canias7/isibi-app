import Avatar from './Avatar.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface NotificationItemProps {
  title?: string
  body?: any
  time?: any
  icon?: ReactNode
  avatar?: string
  unread?: boolean
  onClick?: (...args: any[]) => any
  className?: string
}

// NotificationItem — one row in a notifications list/dropdown.
export default function NotificationItem({ title, body, time, icon, avatar, unread = false, onClick, className }: NotificationItemProps) {
  return (
    <button type="button" onClick={onClick}
      className={cx('flex w-full gap-3 px-4 py-3 text-left transition hover:bg-ink-50', unread && 'bg-brand-50/60', className)}>
      <span className="shrink-0">
        {avatar ? <Avatar name={title} src={avatar} size="sm" />
          : <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-brand-600">{icon}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cx('truncate text-sm', unread ? 'font-semibold text-ink-900' : 'text-ink-800')}>{title}</span>
          {time && <span className="shrink-0 text-xs text-ink-400">{time}</span>}
        </span>
        {body && <span className="mt-0.5 block line-clamp-2 text-sm text-ink-500">{body}</span>}
      </span>
      {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
    </button>
  )
}
