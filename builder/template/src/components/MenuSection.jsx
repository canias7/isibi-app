import { cx } from '../lib/cx.js'

// MenuSection — a restaurant/cafe menu group. items: [{name, description, price, tags, image}]
export default function MenuSection({ title, description, items = [], className }) {
  return (
    <section className={cx('py-8', className)}>
      <div className="mb-5">
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      <ul className="divide-y divide-ink-100">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-4 py-4">
            {it.image && <img src={it.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-base font-semibold text-ink-900">{it.name}</h3>
                <span className="shrink-0 font-medium tabular-nums text-ink-900">{it.price}</span>
              </div>
              {it.description && <p className="mt-1 text-sm text-ink-600">{it.description}</p>}
              {it.tags && it.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {it.tags.map((t, j) => (
                    <span key={j} className="rounded-md bg-ink-100 px-1.5 py-0.5 text-xs text-ink-600">{t}</span>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
