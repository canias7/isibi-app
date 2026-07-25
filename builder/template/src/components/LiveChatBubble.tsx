import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import ChatMessage from './ChatMessage.tsx'
import ChatComposer from './ChatComposer.tsx'
import { cx } from '../lib/cx.js'

interface LiveChatBubbleProps {
  messages?: any[]
  onSend?: (...args: any[]) => any
  unread?: number
  title?: string
  subtitle?: string
  agent?: any
  busy?: boolean
  open?: boolean
  onOpenChange?: (...args: any[]) => any
  className?: string
}

// LiveChatBubble — the floating support launcher and its panel. Mount once in a layout. Deliberately
// self-contained: open state, unread badge, message list and composer, so a page adds support with one tag.
export default function LiveChatBubble({
  messages = [], onSend, unread = 0, title = 'Chat with us', subtitle = 'We usually reply in a few minutes.',
  agent, busy = false, open: openProp, onOpenChange, className,
}: LiveChatBubbleProps) {
  const [selfOpen, setSelfOpen] = useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : selfOpen
  const setOpen = (v) => { if (!controlled) setSelfOpen(v); onOpenChange && onOpenChange(v) }
  return (
    <div className={cx('fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3', className)}>
      {open && (
        <div className="flex h-[28rem] w-[21rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-xl2 border border-ink-100 bg-surface shadow-xl">
          <div className="flex items-start justify-between gap-3 bg-brand-600 px-4 py-3.5 text-brandfg">
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-xs opacity-80">{agent ? `${agent} is here to help` : subtitle}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat"
              className="shrink-0 rounded-lg p-1 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0
              ? <p className="pt-10 text-center text-sm text-ink-400">Send a message to start.</p>
              : messages.map((m, i) => <ChatMessage key={m.id || i} {...m} />)}
          </div>
          <ChatComposer onSend={onSend} busy={busy} placeholder="Type a message…" />
        </div>
      )}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        aria-label={unread ? `Open chat, ${unread} unread` : open ? 'Close chat' : 'Open chat'}
        className="relative grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-brandfg shadow-soft transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  )
}
