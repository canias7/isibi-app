import { Fragment } from 'react'
import { Check, Minus } from 'lucide-react'
import { cx } from '../lib/cx.js'

// PermissionMatrix — what each role can do, as an editable grid. Roles across the top, capabilities down the
// side. Read-only it documents your access model; with onToggle it becomes the admin screen that edits it.
// roles: [{key, label, locked}]  groups: [{title, items:[{key, label, hint}]}]
// value: {roleKey: [capabilityKey, …]}
export default function PermissionMatrix({
  roles = [], groups = [], value = {}, onToggle, title = 'Permissions', className,
}) {
  const has = (role, cap) => (value[role] || []).includes(cap)
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      {title && <h3 className="border-b border-ink-100 px-5 py-4 font-display text-base font-semibold text-ink-900">{title}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            {/* Sticky header: a long capability list scrolls past the role names otherwise, and then every
                tick in the grid is meaningless. */}
            <tr className="sticky top-0 z-10 bg-surface">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-400">Capability</th>
              {roles.map((r) => (
                <th key={r.key} className="px-3 py-3 text-center">
                  <span className="block text-sm font-semibold text-ink-900">{r.label}</span>
                  {r.locked && <span className="block text-[10px] uppercase tracking-wider text-ink-400">fixed</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* A group emits a header row PLUS its item rows, so it needs a real keyed Fragment — the `<>`
                shorthand cannot take a key, and a table row cannot be wrapped in a div. */}
            {groups.map((g) => (
              <Fragment key={g.title}>
                <tr className="bg-ink-50">
                  <td colSpan={roles.length + 1} className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-ink-500">{g.title}</td>
                </tr>
                {g.items.map((it) => (
                  <tr key={it.key} className="border-t border-ink-100">
                    <td className="px-5 py-2.5">
                      <span className="block text-ink-800">{it.label}</span>
                      {it.hint && <span className="block text-xs text-ink-400">{it.hint}</span>}
                    </td>
                    {roles.map((r) => {
                      const on = has(r.key, it.key)
                      const editable = onToggle && !r.locked
                      return (
                        <td key={r.key} className="px-3 py-2.5 text-center">
                          {editable ? (
                            <button type="button" onClick={() => onToggle(r.key, it.key, !on)}
                              aria-pressed={on} aria-label={`${it.label} for ${r.label}`}
                              className={cx('grid h-6 w-6 place-items-center rounded-md border transition mx-auto',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                                on ? 'border-brand-500 bg-brand-500 text-brandfg' : 'border-ink-200 text-transparent hover:border-ink-400')}>
                              <Check size={13} strokeWidth={3} />
                            </button>
                          ) : on
                            ? <Check size={16} className="mx-auto text-brand-500" aria-label="Allowed" />
                            : <Minus size={14} className="mx-auto text-ink-300" aria-label="Not allowed" />}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
