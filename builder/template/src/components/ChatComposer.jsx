import { useState } from 'react'
import { Send, Paperclip } from 'lucide-react'
import { cx } from '../lib/cx.js'

// ChatComposer — the message input for DM/support threads. Enter sends, Shift+Enter newlines.
export default function ChatComposer({ onSend, placeholder = 'Write a message…', busy = false, onAttach, className }) {
  const [text, setText] = useState('')
  const send = () => { const t = text.trim(); if (!t || busy) return; onSend && onSend(t); setText('') }
  return (
    <div className={cx('flex items-end gap-2 border-t border-ink-100 p-3', className)}>
      {onAttach && (
        <button type="button" onClick={onAttach} aria-label="Attach a file"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-400 transition hover:bg-ink-100 hover:text-ink-700">
          <Paperclip size={17} />
        </button>
      )}
      <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        className="max-h-32 min-h-9 flex-1 resize-none rounded-xl border border-ink-200 bg-surface px-3.5 py-2 text-sm text-ink-900
          placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
      <button type="button" onClick={send} disabled={!text.trim() || busy} aria-label="Send"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500 text-brandfg transition
          hover:bg-brand-600 disabled:opacity-40">
        <Send size={16} />
      </button>
    </div>
  )
}
