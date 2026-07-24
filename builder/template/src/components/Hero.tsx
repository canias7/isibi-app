import { Link } from 'react-router-dom'
import Button from './Button.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface HeroProps {
  eyebrow?: any
  title?: ReactNode
  subtitle?: ReactNode
  primaryCta?: any
  secondaryCta?: any
  media?: ReactNode
  notes?: any[]
  variant?: string
  className?: string
}

// Hero — the top of a landing page. variant: 'split' (copy + media), 'center', or 'minimal'.
export default function Hero({ eyebrow, title, subtitle, primaryCta, secondaryCta, media, notes = [], variant = 'split', className }: HeroProps) {
  const Cta = ({ cta, variant: v }) =>
    !cta ? null : cta.to ? (
      <Button as={Link} to={cta.to} variant={v} size="lg">{cta.label}</Button>
    ) : (
      <Button onClick={cta.onClick} variant={v} size="lg">{cta.label}</Button>
    )
  const copy = (
    <div className={cx('max-w-xl', variant === 'center' && 'mx-auto text-center')}>
      {eyebrow && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
          {eyebrow}
        </span>
      )}
      <h1 className="mt-5 font-display text-4xl font-bold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl">{title}</h1>
      {subtitle && <p className="mt-5 text-lg leading-relaxed text-ink-600">{subtitle}</p>}
      <div className={cx('mt-8 flex flex-wrap gap-3', variant === 'center' && 'justify-center')}>
        <Cta cta={primaryCta} variant="primary" />
        <Cta cta={secondaryCta} variant="outline" />
      </div>
      {notes.length > 0 && (
        <ul className={cx('mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-500', variant === 'center' && 'justify-center')}>
          {notes.map((n, i) => <li key={i} className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" />{n}</li>)}
        </ul>
      )}
    </div>
  )
  if (variant !== 'split' || !media) {
    return <section className={cx('py-20', className)}><div className="container-page">{copy}</div></section>
  }
  return (
    <section className={cx('py-20', className)}>
      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        {copy}
        <div className="relative">{media}</div>
      </div>
    </section>
  )
}
