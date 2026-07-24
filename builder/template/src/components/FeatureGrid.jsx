import { cx } from '../lib/cx.js'

// FeatureGrid — the "what you get" section. features: [{icon, title, body}]
export default function FeatureGrid({ eyebrow, title, subtitle, features = [], columns = 3, className }) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }
  return (
    <section className={cx('py-16', className)}>
      <div className="container-page">
        {(title || eyebrow) && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            {eyebrow && <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>}
            {title && <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-900">{title}</h2>}
            {subtitle && <p className="mt-3 text-ink-600">{subtitle}</p>}
          </div>
        )}
        <div className={cx('grid gap-8', cols[columns] || cols[3])}>
          {features.map((f, i) => (
            <div key={i}>
              {f.icon && <span className="mb-4 inline-grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-600">{f.icon}</span>}
              <h3 className="font-display text-base font-semibold text-ink-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
