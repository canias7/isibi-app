import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cx } from '../lib/cx.js'

// Dropdown — a click-triggered menu. `trigger` is any node; `items` are {label, onSelect, icon, danger} or
// { separator: true }. Closes on outside click and Escape.
export default function Dropdown({ trigger, items = [], align = 'right', label = 'More options', className }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={box} className={cx('relative inline-block', className)}>
      {trigger
        // A caller's trigger is usually already a button, so wrapping it in another one would nest buttons
        // (invalid HTML). Keep the span, but make it focusable and Enter/Space-operable — a click-only span
        // is unreachable by keyboard.
        ? (
          <span role="button" tabIndex={0} aria-haspopup="menu" aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) } }}
            className="inline-flex cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            {trigger}
          </span>
        )
        // With NO trigger the old version rendered an empty, unclickable span — the menu existed but nothing
        // could open it. Fall back to a real ⋯ button so `<Dropdown items={…} />` works on its own.
        : (
          <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label}
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <MoreHorizontal size={16} />
          </button>
        )}
      {open && (
        <div role="menu"
          className={cx(
            'absolute z-30 mt-2 min-w-48 overflow-hidden rounded-xl border border-ink-100 bg-surface py-1 shadow-soft',
            align === 'right' ? 'right-0' : 'left-0'
          )}>
          {items.map((it, i) =>
            it.separator ? (
              <div key={i} className="my-1 h-px bg-ink-100" />
            ) : (
              <button key={i} type="button" role="menuitem"
                onClick={() => { setOpen(false); it.onSelect && it.onSelect() }}
                className={cx(
                  'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition',
                  it.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-ink-700 hover:bg-ink-50'
                )}>
                {it.icon}
                {it.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
