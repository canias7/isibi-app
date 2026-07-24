import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import Button from './Button.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface SplitFeatureProps {
  eyebrow?: any
  title?: ReactNode
  body?: any
  bullets?: any[]
  media?: ReactNode
  cta?: any
  reverse?: boolean
  tone?: string
  className?: string
}

// SplitFeature — one alternating copy/media row. Stack several with reverse={i % 2 === 1} for the classic
// zig-zag feature story, which carries far more detail than a grid of equal cards.
export default function SplitFeature({
  eyebrow, title, body, bullets = [], media, cta, reverse = false, tone = 'canvas', className,
}: SplitFeatureProps) {
  return (
    <section className={cx('py-16', tone === 'muted' && 'bg-ink-50', className)}>
      <div className="container-page">
        <div className={cx('grid items-center gap-10 lg:grid-cols-2 lg:gap-16', reverse && 'lg:[&>*:first-child]:order-2')}>
          <div>
            {eyebrow && <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>}
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-900">{title}</h2>
            {body && <p className="mt-4 text-ink-600">{body}</p>}
            {bullets.length > 0 && (
              <ul className="mt-6 space-y-3">
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-3 text-sm text-ink-700">
                    <Check size={18} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
                    <span>{typeof b === 'string' ? b : <><span className="font-medium text-ink-900">{b.title}</span> — {b.body}</>}</span>
                  </li>
                ))}
              </ul>
            )}
            {cta && (
              <div className="mt-8">
                {cta.to
                  ? <Button as={Link} to={cta.to} size="lg">{cta.label}</Button>
                  : <Button onClick={cta.onClick} size="lg">{cta.label}</Button>}
              </div>
            )}
          </div>
          <div className="overflow-hidden rounded-xl2 bg-ink-100 shadow-soft">{media}</div>
        </div>
      </div>
    </section>
  )
}
