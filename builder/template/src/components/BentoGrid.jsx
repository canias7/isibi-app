import { Link } from 'react-router-dom'
import { cx } from '../lib/cx.js'

// BentoGrid — the asymmetric feature mosaic. Where FeatureGrid is an even row of equal cards, this gives some
// items twice the width or height, so the section has a visual hierarchy instead of reading as a spreadsheet.
// items: [{title, body, icon, media, to, span: 'wide'|'tall'|'large', tone: 'surface'|'brand'|'ink'}]
export default function BentoGrid({ eyebrow, title, subtitle, items = [], className }) {
  const spans = { wide: 'sm:col-span-2', tall: 'sm:row-span-2', large: 'sm:col-span-2 sm:row-span-2' }
  const tones = {
    surface: 'card-surface',
    brand: 'bg-brand-600 text-brandfg border border-transparent',
    ink: 'bg-ink-900 text-canvas border border-transparent',
  }
  return (
    <section className={cx('py-16', className)}>
      <div className="container-page">
        {(eyebrow || title || subtitle) && (
          <div className="mx-auto max-w-2xl text-center">
            {eyebrow && <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>}
            {title && <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-900">{title}</h2>}
            {subtitle && <p className="mt-3 text-ink-600">{subtitle}</p>}
          </div>
        )}
        <div className="mt-10 grid auto-rows-[minmax(180px,auto)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => {
            const dark = it.tone === 'brand' || it.tone === 'ink'
            const Icon = it.icon
            const inner = (
              <>
                {it.media && <div className="mb-4 overflow-hidden rounded-xl">{it.media}</div>}
                {Icon && (
                  <span className={cx('mb-3 inline-grid h-10 w-10 place-items-center rounded-xl',
                    dark ? 'bg-white/15' : 'bg-brand-50 text-brand-600')}>
                    <Icon size={18} />
                  </span>
                )}
                <h3 className={cx('font-display text-lg font-semibold', dark ? '' : 'text-ink-900')}>{it.title}</h3>
                {it.body && <p className={cx('mt-2 text-sm', dark ? 'opacity-80' : 'text-ink-600')}>{it.body}</p>}
              </>
            )
            const cls = cx('flex flex-col rounded-xl2 p-6 transition', spans[it.span], tones[it.tone] || tones.surface,
              it.to && 'hover:-translate-y-0.5 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500')
            return it.to
              ? <Link key={i} to={it.to} className={cls}>{inner}</Link>
              : <div key={i} className={cls}>{inner}</div>
          })}
        </div>
      </div>
    </section>
  )
}
