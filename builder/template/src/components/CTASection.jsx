import { Link } from 'react-router-dom'
import Button from './Button.jsx'
import { cx } from '../lib/cx.js'

// CTASection — the closing "ready to start?" band.
export default function CTASection({ title, subtitle, primaryCta, secondaryCta, tone = 'brand', className }) {
  const dark = tone === 'brand'
  return (
    <section className={cx('py-16', className)}>
      <div className="container-page">
        <div className={cx('rounded-xl2 px-8 py-14 text-center', dark ? 'bg-brand-600' : 'bg-ink-100')}>
          <h2 className={cx('font-display text-3xl font-bold tracking-tight', dark ? 'text-brandfg' : 'text-ink-900')}>{title}</h2>
          {subtitle && <p className={cx('mx-auto mt-3 max-w-xl', dark ? 'text-brandfg/80' : 'text-ink-600')}>{subtitle}</p>}
          {/* On the brand band, buttons must contrast against the ACCENT, not against the page — a plain
              outline/ghost button inherits page colours and can vanish (e.g. a gold band on a gold-accent theme).
              So force surface-on-brand for the primary and a bordered brandfg for the secondary. */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {primaryCta && (primaryCta.to
              ? <Button as={Link} to={primaryCta.to} size="lg" className={dark ? 'bg-surface text-ink-900 hover:bg-ink-100' : undefined}>{primaryCta.label}</Button>
              : <Button onClick={primaryCta.onClick} size="lg" className={dark ? 'bg-surface text-ink-900 hover:bg-ink-100' : undefined}>{primaryCta.label}</Button>)}
            {secondaryCta && (secondaryCta.to
              ? <Button as={Link} to={secondaryCta.to} size="lg" variant="ghost" className={dark ? 'border border-brandfg/30 text-brandfg hover:bg-brandfg/10' : undefined}>{secondaryCta.label}</Button>
              : <Button onClick={secondaryCta.onClick} size="lg" variant="ghost" className={dark ? 'border border-brandfg/30 text-brandfg hover:bg-brandfg/10' : undefined}>{secondaryCta.label}</Button>)}
          </div>
        </div>
      </div>
    </section>
  )
}
