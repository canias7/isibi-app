import Button from './Button.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface NewsletterSignupProps {
  title?: string
  subtitle?: ReactNode
  onSubmit?: (...args: any[]) => any
  busy?: boolean
  note?: ReactNode
  className?: string
}

// NewsletterSignup — email capture band. Wire onSubmit to the backend.
export default function NewsletterSignup({ title = 'Stay in the loop', subtitle, onSubmit, busy = false, note, className }: NewsletterSignupProps) {
  return (
    <section className={cx('py-16', className)}>
      <div className="container-page">
        <div className="rounded-xl2 bg-ink-100 px-8 py-12 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900">{title}</h2>
          {subtitle && <p className="mx-auto mt-2 max-w-lg text-sm text-ink-600">{subtitle}</p>}
          <form onSubmit={onSubmit} className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row">
            <input name="email" type="email" required placeholder="you@example.com"
              className="flex-1 rounded-xl border border-ink-200 bg-surface px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400
                focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
            <Button type="submit" disabled={busy}>{busy ? 'Subscribing…' : 'Subscribe'}</Button>
          </form>
          {note && <p className="mt-3 text-xs text-ink-400">{note}</p>}
        </div>
      </div>
    </section>
  )
}
