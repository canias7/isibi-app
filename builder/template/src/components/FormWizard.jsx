import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import Button from './Button.jsx'
import { cx } from '../lib/cx.js'

// FormWizard — a multi-step form with a progress header, per-step validation and back/next. Stepper is the
// indicator alone; this owns the navigation, so a long signup/onboarding/application is one component.
// steps: [{id, title, hint, render(ctx), validate(values) -> true | 'message'}]
export default function FormWizard({
  steps = [], values = {}, onChange, onComplete, submitLabel = 'Finish', busy = false, className,
}) {
  const [i, setI] = useState(0)
  const [error, setError] = useState(null)
  const step = steps[i]
  const last = i === steps.length - 1
  if (!step) return null
  const next = () => {
    const check = step.validate ? step.validate(values) : true
    if (check !== true) { setError(typeof check === 'string' ? check : 'Please complete this step.'); return }
    setError(null)
    if (last) onComplete && onComplete(values)
    else setI((n) => n + 1)
  }
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      <div className="border-b border-ink-100 px-6 py-5">
        <ol className="flex items-center gap-2">
          {steps.map((s, n) => (
            <li key={s.id || n} className="flex min-w-0 flex-1 items-center gap-2">
              <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition',
                n < i ? 'bg-emerald-500 text-white' : n === i ? 'bg-brand-600 text-brandfg' : 'bg-ink-100 text-ink-400')}>
                {n < i ? <Check size={13} strokeWidth={3} /> : n + 1}
              </span>
              <span className={cx('hidden min-w-0 truncate text-sm sm:block', n === i ? 'font-medium text-ink-900' : 'text-ink-400')}>{s.title}</span>
              {n < steps.length - 1 && <span className={cx('h-px min-w-4 flex-1', n < i ? 'bg-emerald-400' : 'bg-ink-200')} />}
            </li>
          ))}
        </ol>
      </div>
      <div className="px-6 py-6">
        <h3 className="font-display text-lg font-semibold text-ink-900">{step.title}</h3>
        {step.hint && <p className="mt-1 text-sm text-ink-500">{step.hint}</p>}
        <div className="mt-5">{step.render ? step.render({ values, onChange, setError }) : null}</div>
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-ink-100 bg-ink-50/60 px-6 py-4">
        <Button variant="ghost" onClick={() => { setError(null); setI((n) => Math.max(0, n - 1)) }} disabled={i === 0}>
          <ArrowLeft size={15} />Back
        </Button>
        <span className="text-xs tabular-nums text-ink-400">Step {i + 1} of {steps.length}</span>
        <Button onClick={next} disabled={busy}>
          {busy ? 'Working…' : last ? submitLabel : <>Next <ArrowRight size={15} /></>}
        </Button>
      </div>
    </div>
  )
}
