import Countdown from './Countdown.tsx'
import NewsletterSignup from './NewsletterSignup.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface ComingSoonProps {
  eyebrow?: string
  title?: ReactNode
  subtitle?: ReactNode
  launchAt?: any
  onSubscribe?: (...args: any[]) => any
  busy?: boolean
  note?: string
  social?: any[]
  background?: any
  className?: string
}

// ComingSoon — the pre-launch holding page: what is coming, when, and a way to be told. One component so a
// "we're not live yet" page isn't a bespoke build every time.
export default function ComingSoon({
  eyebrow = 'Coming soon', title, subtitle, launchAt, onSubscribe, busy = false,
  note = 'No spam — one email when we launch.', social = [], background, className,
}: ComingSoonProps) {
  return (
    <section className={cx('relative flex min-h-[80vh] items-center overflow-hidden py-20', className)}>
      {background && (
        <>
          <img src={background} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-0 bg-canvas/85 backdrop-blur-[2px]" aria-hidden="true" />
        </>
      )}
      <div className="container-page relative">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>
          <h1 className="mt-4 text-balance font-display text-4xl font-bold leading-tight tracking-tight text-ink-900 sm:text-5xl">{title}</h1>
          {subtitle && <p className="mt-4 text-lg text-ink-600">{subtitle}</p>}
          {launchAt && (
            <div className="mt-10 flex justify-center">
              <Countdown to={launchAt} />
            </div>
          )}
          {onSubscribe && (
            <NewsletterSignup className="mt-10" title="" subtitle="" onSubmit={onSubscribe} busy={busy} note={note} />
          )}
          {social.length > 0 && (
            <div className="mt-10 flex flex-wrap justify-center gap-5">
              {social.map((s, i) => (
                <a key={i} href={s.href} target="_blank" rel="noreferrer"
                  className="text-sm font-medium text-ink-500 underline-offset-4 transition hover:text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
