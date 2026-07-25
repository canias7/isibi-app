import { useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import Button from './Button.tsx'
import { cx } from '../lib/cx.js'

interface FeedbackWidgetProps {
  question?: string
  onSubmit?: (...args: any[]) => any
  thanks?: string
  followUp?: string
  className?: string
}

// FeedbackWidget — "was this helpful?" at the foot of a doc, article or support answer. A thumbs-down opens a
// short follow-up box, because the useful signal is WHY it wasn't helpful.
// onSubmit({helpful, comment}).
export default function FeedbackWidget({
  question = 'Was this helpful?', onSubmit, thanks = 'Thanks — this helps us improve the docs.',
  followUp = 'What was missing or unclear?', className,
}: FeedbackWidgetProps) {
  const [choice, setChoice] = useState(null)
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState(false)

  const pick = (helpful) => {
    setChoice(helpful)
    // A thumbs-up needs no follow-up: record it immediately so the common case is one click.
    if (helpful) { setSent(true); onSubmit && onSubmit({ helpful: true, comment: '' }) }
  }
  const send = () => { setSent(true); onSubmit && onSubmit({ helpful: false, comment: comment.trim() }) }

  if (sent) return <p className={cx('rounded-xl2 bg-ink-50 px-5 py-4 text-sm text-ink-600', className)} role="status">{thanks}</p>

  return (
    <div className={cx('rounded-xl2 border border-ink-100 bg-ink-50/60 px-5 py-4', className)}>
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-sm font-medium text-ink-800">{question}</p>
        <div className="flex gap-2">
          {[true, false].map((v) => (
            <button key={String(v)} type="button" onClick={() => pick(v)} aria-pressed={choice === v}
              aria-label={v ? 'Yes, helpful' : 'No, not helpful'}
              className={cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                choice === v ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-200 bg-surface text-ink-600 hover:bg-ink-100')}>
              {v ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}{v ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </div>
      {choice === false && (
        <div className="mt-3">
          <textarea value={comment} onChange={(e) => setComment((e.target as any).value)} rows={3} placeholder={followUp} aria-label={String(followUp ?? "")}
            className="w-full rounded-xl border border-ink-200 bg-surface px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => send()}>Skip</Button>
            <Button size="sm" onClick={send} disabled={!comment.trim()}>Send feedback</Button>
          </div>
        </div>
      )}
    </div>
  )
}
