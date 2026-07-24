import Avatar from './Avatar.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface CommentProps {
  author?: any
  avatar?: string
  time?: any
  body?: any
  actions?: ReactNode
  rating?: any
  children?: ReactNode
  className?: string
}

// Comment — one comment/review. Nest <Comment> children for replies.
export function Comment({ author, avatar, time, body, actions, rating, children, className }: CommentProps) {
  return (
    <div className={cx('flex gap-3', className)}>
      <Avatar name={author} src={avatar} size="sm" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-ink-900">{author}</span>
          {time && <span className="text-xs text-ink-400">{time}</span>}
          {rating}
        </div>
        <div className="mt-1 text-sm leading-relaxed text-ink-700">{body}</div>
        {actions && <div className="mt-2 flex items-center gap-4 text-xs font-medium text-ink-500">{actions}</div>}
        {children && <div className="mt-4 space-y-4 border-l-2 border-ink-100 pl-4">{children}</div>}
      </div>
    </div>
  )
}

interface CommentListProps {
  comments?: any[]
  renderComment?: any
  empty?: string
  className?: string
}

// CommentList — a thread with an empty state.
export default function CommentList({ comments = [], renderComment, empty = 'No comments yet — be the first.', className }: CommentListProps) {
  if (!comments.length) return <p className={cx('py-8 text-center text-sm text-ink-400', className)}>{empty}</p>
  return (
    <div className={cx('space-y-6', className)}>
      {comments.map((c, i) => (renderComment ? renderComment(c, i) : <Comment key={c.id ?? i} {...c} />))}
    </div>
  )
}
