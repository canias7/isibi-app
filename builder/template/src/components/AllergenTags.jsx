import { cx } from '../lib/cx.js'

// AllergenTags — the allergen row on a dish. Legally significant information, so it gets its own component
// with fixed wording rather than being left to per-page prose. `contains` is the hard warning; `mayContain`
// is the cross-contamination note and is styled more quietly on purpose.
export const ALLERGENS = ['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soya', 'milk', 'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs']
const title = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1)

export default function AllergenTags({ contains = [], mayContain = [], label = 'Allergens', note, className }) {
  if (!contains.length && !mayContain.length) return null
  return (
    <div className={cx('text-xs', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold uppercase tracking-wider text-ink-400">{label}</span>
        {contains.map((a) => (
          <span key={a} className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-inset ring-amber-200">{title(a)}</span>
        ))}
        {mayContain.map((a) => (
          <span key={a} className="rounded-full px-2 py-0.5 text-ink-500 ring-1 ring-inset ring-ink-200">May contain {a}</span>
        ))}
      </div>
      {note && <p className="mt-1.5 text-ink-400">{note}</p>}
    </div>
  )
}
