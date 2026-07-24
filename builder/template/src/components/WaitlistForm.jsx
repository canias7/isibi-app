import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import Button from './Button.jsx'
import { cx } from '../lib/cx.js'

// WaitlistForm — join-the-queue capture for a sold-out event, a closed beta, or an out-of-stock product.
// Shows the queue position back after submit, because that is the thing that stops people signing up twice.
export default function WaitlistForm({
  title = 'Join the waitlist', subtitle, onSubmit, busy = false, submitLabel = 'Join waitlist',
  position, total, fields = ['email'], note, className,
}) {
  const [values, setValues] = useState({})
  const [sent, setSent] = useState(false)
  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }))
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(values.email || '').trim())
  const submit = (e) => {
    e.preventDefault()
    if (!emailOk || busy) return
    setSent(true)
    onSubmit && onSubmit(values)
  }
  if (sent || position != null) {
    return (
      <div className={cx('rounded-xl2 border border-emerald-200 bg-emerald-50 p-6 text-center', className)}>
        <CheckCircle2 size={28} className="mx-auto text-emerald-600" aria-hidden="true" />
        <p className="mt-3 font-display text-lg font-semibold text-emerald-900">You are on the list</p>
        {position != null && (
          <p className="mt-1 text-sm text-emerald-800">
            You are number <span className="font-semibold tabular-nums">{position}</span>
            {total ? <> of <span className="tabular-nums">{total}</span></> : null} in the queue.
          </p>
        )}
        <p className="mt-2 text-sm text-emerald-700">We will email you the moment a place opens up.</p>
      </div>
    )
  }
  return (
    <form onSubmit={submit} className={cx('card-surface p-6', className)}>
      <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      <div className="mt-4 space-y-3">
        {fields.includes('name') && (
          <input value={values.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="Your name" aria-label="Your name" autoComplete="name"
            className="w-full rounded-xl border border-ink-200 bg-surface px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 transition-colors hover:border-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
        )}
        <input type="email" value={values.email || ''} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" aria-label="Email address" autoComplete="email" required
          className="w-full rounded-xl border border-ink-200 bg-surface px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 transition-colors hover:border-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
        {fields.includes('quantity') && (
          <input type="number" min="1" max="10" value={values.quantity || 1} onChange={(e) => set('quantity', e.target.value)} aria-label="How many places"
            className="w-full rounded-xl border border-ink-200 bg-surface px-3.5 py-2.5 text-sm tabular-nums text-ink-900 transition-colors hover:border-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
        )}
      </div>
      <Button type="submit" disabled={!emailOk || busy} className="mt-4 w-full justify-center">
        {busy ? 'Adding you…' : submitLabel}
      </Button>
      {note && <p className="mt-3 text-xs text-ink-400">{note}</p>}
    </form>
  )
}
