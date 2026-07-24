import Avatar from './Avatar.jsx'
import { cx } from '../lib/cx.js'

// ChatMessage — a DM / support-thread bubble. `mine` flips it to the right, brand-coloured.
export default function ChatMessage({ author, avatar, body, time, mine = false, status, className }) {
  return (
    <div className={cx('flex gap-2.5', mine ? 'flex-row-reverse' : 'flex-row', className)}>
      {!mine && <Avatar name={author} src={avatar} size="sm" className="shrink-0 self-end" />}
      <div className={cx('max-w-[75%] min-w-0', mine ? 'items-end text-right' : 'items-start')}>
        <div className={cx('inline-block rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          mine ? 'rounded-br-md bg-brand-500 text-white' : 'rounded-bl-md bg-ink-100 text-ink-800')}>
          {body}
        </div>
        <div className={cx('mt-1 flex items-center gap-1.5 text-xs text-ink-400', mine && 'justify-end')}>
          {!mine && author && <span>{author}</span>}
          {time && <span>{time}</span>}
          {mine && status && <span>· {status}</span>}
        </div>
      </div>
    </div>
  )
}
