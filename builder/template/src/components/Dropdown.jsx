import { useEffect, useRef, useState } from 'react'
import { cx } from '../lib/cx.js'

// Dropdown — a click-triggered menu. `trigger` is any node; `items` are {label, onSelect, icon, danger} or
// { separator: true }. Closes on outside click and Escape.
export default function Dropdown({ trigger, items = [], align = 'right', className }) {
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
      <span onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>{trigger}</span>
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
