import { useState } from 'react'
import Button from './Button.jsx'
import { cx } from '../lib/cx.js'

// npsGroup(score) → 'detractor' | 'passive' | 'promoter'. The standard bands, exported so a dashboard
// classifies the same way the survey does.
export function npsGroup(score) {
  if (score == null) return null
  return score <= 6 ? 'detractor' : score <= 8 ? 'passive' : 'promoter'
}

// NpsInput — the 0–10 "how likely are you to recommend us" scale, with the follow-up question that makes the
// score actually useful. The follow-up copy changes with the band, because asking a detractor "what did you
// love?" is how you get no answer.
export default function NpsInput({
  question = 'How likely are you to recommend us to a friend or colleague?',
  onSubmit, busy = false, lowLabel = 'Not at all likely', highLabel = 'Extremely likely',
  askFollowUp = true, thanks = 'Thank you — this genuinely helps.', className,
}) {
  const [score, setScore] = useState(null)
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState(false)
  const group = npsGroup(score)
  const followUp = group === 'promoter' ? 'What did we get right?'
    : group === 'passive' ? 'What would have made this a 10?'
    : 'What let you down? We read every reply.'
  if (sent) return <p role="status" className={cx('rounded-xl2 bg-emerald-50 px-5 py-4 text-sm text-emerald-800', className)}>{thanks}</p>
  return (
    <div className={cx('card-surface p-6', className)}>
      <p className="font-display text-base font-semibold text-ink-900">{question}</p>
      <div className="mt-5 flex gap-1">
        {Array.from({ length: 11 }, (_, n) => {
          const on = score === n
          const tone = n <= 6 ? 'hover:border-rose-400 hover:text-rose-600' : n <= 8 ? 'hover:border-amber-400 hover:text-amber-600' : 'hover:border-emerald-400 hover:text-emerald-600'
          const onTone = n <= 6 ? 'border-rose-500 bg-rose-500' : n <= 8 ? 'border-amber-500 bg-amber-500' : 'border-emerald-500 bg-emerald-500'
          return (
            <button key={n} type="button" onClick={() => setScore(n)} aria-pressed={on} aria-label={`${n} out of 10`}
              className={cx('h-10 flex-1 rounded-lg border text-sm font-medium tabular-nums transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                on ? `${onTone} text-white` : `border-ink-200 text-ink-600 ${tone}`)}>
              {n}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink-400">
        <span>{lowLabel}</span><span>{highLabel}</span>
      </div>
      {score != null && askFollowUp && (
        <div className="mt-5">
          <label className="mb-1.5 block text-sm font-medium text-ink-700">{followUp}</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
            className="w-full rounded-xl border border-ink-200 bg-surface px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
        </div>
      )}
      {score != null && (
        <Button className="mt-4" disabled={busy}
          onClick={() => { setSent(true); onSubmit && onSubmit({ score, group, comment: comment.trim() }) }}>
          {busy ? 'Sending…' : 'Submit'}
        </Button>
      )}
    </div>
  )
}
