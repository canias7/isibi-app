import { Link } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import ProgressRing from './ProgressRing.jsx'
import Button from './Button.jsx'
import { cx } from '../lib/cx.js'

// QuizResult — the score screen. Pass/fail is decided by `passMark`, and the copy changes with it, because
// "you scored 60%" without a verdict makes the learner do the maths.
export default function QuizResult({
  score = 0, total = 0, passMark = 70, onRetry, continueTo, continueLabel = 'Continue',
  breakdown = [], className,
}) {
  const pct = total ? Math.round((score / total) * 100) : 0
  const passed = pct >= passMark
  return (
    <div className={cx('card-surface p-8 text-center', className)}>
      <ProgressRing value={pct} max={100} label={`${pct}%`} tone={passed ? 'success' : 'danger'} className="mx-auto" />
      <h3 className={cx('mt-5 font-display text-2xl font-bold tracking-tight', passed ? 'text-emerald-700' : 'text-ink-900')}>
        {passed ? 'Passed' : 'Not quite'}
      </h3>
      <p className="mt-2 text-sm text-ink-600">
        You answered <span className="font-medium tabular-nums text-ink-900">{score} of {total}</span> correctly.
        {!passed && ` You need ${passMark}% to pass.`}
      </p>
      {breakdown.length > 0 && (
        <dl className="mx-auto mt-6 max-w-sm divide-y divide-ink-100 text-left text-sm">
          {breakdown.map((b, i) => (
            <div key={i} className="flex justify-between py-2">
              <dt className="text-ink-600">{b.label}</dt>
              <dd className={cx('font-medium tabular-nums', b.tone === 'bad' ? 'text-rose-600' : 'text-ink-900')}>{b.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {onRetry && <Button variant="outline" onClick={onRetry}><RotateCcw size={15} />Try again</Button>}
        {continueTo && <Button as={Link} to={continueTo}>{continueLabel}</Button>}
      </div>
    </div>
  )
}
