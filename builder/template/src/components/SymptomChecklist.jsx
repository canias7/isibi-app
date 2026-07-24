import { cx } from '../lib/cx.js'

// SymptomChecklist — a grouped multi-select intake list with an urgent-flag path. Also fits damage reports,
// inspection checklists, incident forms: any "tick everything that applies" where SOME answers matter more.
// groups: [{title, items:[{id, label, hint, urgent}]}]
export default function SymptomChecklist({
  groups = [], value = [], onChange, title, urgentNotice = 'Some of what you have selected needs urgent attention. Contact us straight away rather than waiting for a reply.',
  noneLabel = 'None of these', className,
}) {
  const set = new Set(value)
  const toggle = (id) => {
    if (!onChange) return
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    onChange([...next])
  }
  const allUrgent = groups.flatMap((g) => g.items).filter((i) => i.urgent).map((i) => i.id)
  const anyUrgent = allUrgent.some((id) => set.has(id))
  return (
    <div className={className}>
      {title && <h3 className="mb-4 font-display text-base font-semibold text-ink-900">{title}</h3>}
      <div className="space-y-6">
        {groups.map((g, gi) => (
          <fieldset key={gi}>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{g.title}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.items.map((it) => {
                const on = set.has(it.id)
                return (
                  <label key={it.id}
                    className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition',
                      'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500',
                      on ? 'border-brand-500 bg-brand-50/60' : 'border-ink-200 hover:border-ink-300')}>
                    <input type="checkbox" checked={on} onChange={() => toggle(it.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded accent-brand-600" />
                    <span className="min-w-0">
                      <span className="block text-ink-800">{it.label}</span>
                      {it.hint && <span className="mt-0.5 block text-xs text-ink-500">{it.hint}</span>}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm text-ink-600">
        <input type="checkbox" checked={value.length === 0} onChange={() => onChange && onChange([])}
          className="h-4 w-4 rounded accent-brand-600" />
        {noneLabel}
      </label>
      {anyUrgent && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {urgentNotice}
        </p>
      )}
    </div>
  )
}
