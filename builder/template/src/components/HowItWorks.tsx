import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface HowItWorksProps {
  title?: string
  subtitle?: ReactNode
  steps?: any[]
  className?: string
}

// HowItWorks — numbered process steps. steps: [{title, body, icon}]
export default function HowItWorks({ title = 'How it works', subtitle, steps = [], className }: HowItWorksProps) {
  return (
    <section className={cx('py-16', className)}>
      <div className="container-page">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">{title}</h2>
          {subtitle && <p className="mt-3 text-ink-600">{subtitle}</p>}
        </div>
        <ol className="grid gap-8 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={i} className="relative">
              <span className="mb-4 inline-grid h-10 w-10 place-items-center rounded-full bg-brand-500 font-display text-sm font-bold text-brandfg">
                {i + 1}
              </span>
              <h3 className="font-display text-base font-semibold text-ink-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
