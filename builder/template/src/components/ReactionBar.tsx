import { useState } from 'react'
import { SmilePlus } from 'lucide-react'
import { cx } from '../lib/cx.js'

// ReactionBar — emoji reactions on a post, comment, message or doc. reactions: [{emoji, count, reacted}].
// Clicking a chip toggles the current user's reaction; the picker adds a new one.
export const DEFAULT_EMOJI = ['👍', '❤️', '🎉', '😂', '👀', '🚀', '😮', '🙏']

interface ReactionBarProps {
  reactions?: any[]
  onToggle?: (...args: any[]) => any
  onAdd?: (...args: any[]) => any
  emoji?: any[]
  className?: string
}

export default function ReactionBar({ reactions = [], onToggle, onAdd, emoji = DEFAULT_EMOJI, className }: ReactionBarProps) {
  const [picking, setPicking] = useState(false)
  return (
    <div className={cx('relative flex flex-wrap items-center gap-1.5', className)}>
      {reactions.map((r) => (
        <button key={r.emoji} type="button" onClick={() => onToggle && onToggle(r.emoji)} aria-pressed={!!r.reacted}
          aria-label={`${r.emoji} ${r.count}${r.reacted ? ', you reacted' : ''}`}
          className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            r.reacted ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-100')}>
          <span className="text-sm leading-none">{r.emoji}</span>
          <span className="tabular-nums">{r.count}</span>
        </button>
      ))}
      <button type="button" onClick={() => setPicking((p) => !p)} aria-label="Add a reaction" aria-expanded={picking}
        className="grid h-6 w-6 place-items-center rounded-full border border-ink-200 text-ink-400 transition hover:bg-ink-100 hover:text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <SmilePlus size={13} />
      </button>
      {picking && (
        <div className="absolute bottom-full left-0 z-20 mb-1.5 flex gap-0.5 rounded-xl border border-ink-100 bg-surface p-1.5 shadow-soft">
          {emoji.map((e) => (
            <button key={e} type="button"
              onClick={() => { setPicking(false); (onAdd || onToggle) && (onAdd || onToggle)(e) }}
              aria-label={`React with ${e}`}
              className="grid h-8 w-8 place-items-center rounded-lg text-lg transition hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
