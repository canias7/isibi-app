import { Check, X } from 'lucide-react'
import { cx } from '../lib/cx.js'

// QuizQuestion — one multiple-choice question. Controlled: the PARENT owns `value` and `revealed`, so a quiz
// can defer marking to the end or mark immediately, without the component guessing which.
// options: [{id, label, correct, why}]
export default function QuizQuestion({
  number, total, question, options = [], value, onChange, revealed = false, multiple = false, explanation, className,
}) {
  const chosen = multiple ? (Array.isArray(value) ? value : []) : value
  const isPicked = (id) => (multiple ? chosen.includes(id) : chosen === id)
  const pick = (id) => {
    if (revealed || !onChange) return
    if (!multiple) return onChange(id)
    onChange(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id])
  }
  return (
    <div className={cx('card-surface p-6', className)}>
      {(number || total) && (
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
          Question {number}{total ? ` of ${total}` : ''}
        </p>
      )}
      <h3 className="mt-2 font-display text-lg font-semibold text-ink-900">{question}</h3>
      <ul className="mt-4 space-y-2">
        {options.map((o) => {
          const picked = isPicked(o.id)
          // Once revealed, a correct answer is always green — even if the learner missed it, so they can see it.
          const state = !revealed ? (picked ? 'picked' : 'idle')
            : o.correct ? 'right' : picked ? 'wrong' : 'idle'
          return (
            <li key={o.id}>
              <button type="button" onClick={() => pick(o.id)} disabled={revealed} aria-pressed={picked}
                className={cx('flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  state === 'picked' && 'border-brand-500 bg-brand-50',
                  state === 'right' && 'border-emerald-400 bg-emerald-50',
                  state === 'wrong' && 'border-rose-400 bg-rose-50',
                  state === 'idle' && 'border-ink-200 hover:border-ink-400')}>
                <span className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center border text-[10px]',
                  multiple ? 'rounded' : 'rounded-full',
                  state === 'right' ? 'border-emerald-500 bg-emerald-500 text-white'
                    : state === 'wrong' ? 'border-rose-500 bg-rose-500 text-white'
                    : picked ? 'border-brand-500 bg-brand-500 text-brandfg' : 'border-ink-300')}>
                  {state === 'right' ? <Check size={12} strokeWidth={3} /> : state === 'wrong' ? <X size={12} strokeWidth={3} /> : picked ? <Check size={12} strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-ink-800">{o.label}</span>
                  {revealed && o.why && <span className="mt-1 block text-xs text-ink-500">{o.why}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {revealed && explanation && (
        <p className="mt-4 rounded-xl bg-ink-50 p-4 text-sm text-ink-600">{explanation}</p>
      )}
    </div>
  )
}
