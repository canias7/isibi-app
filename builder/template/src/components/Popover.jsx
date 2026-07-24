import { useEffect, useRef, useState } from 'react'
import { cx } from '../lib/cx.js'

// Popover — a generic anchored overlay (filters, pickers, extra detail). Controlled or self-managed.
export default function Popover({ trigger, open: openProp, onOpenChange, align = 'left', width = 'w-72', children, className }) {
  const [internal, setInternal] = useState(false)
  const open = openProp !== undefined ? openProp : internal
  const set = (v) => { if (openProp === undefined) setInternal(v); if (onOpenChange) onOpenChange(v) }
  const box = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (box.current && !box.current.contains(e.target)) set(false) }
    const onKey = (e) => { if (e.key === 'Escape') set(false) }
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  })
  return (
    <div ref={box} className={cx('relative inline-block', className)}>
      <span onClick={() => set(!open)}>{trigger}</span>
      {open && (
        <div className={cx('absolute z-30 mt-2 rounded-xl border border-ink-100 bg-white p-3 shadow-soft', width,
          align === 'right' ? 'right-0' : 'left-0')}>
          {children}
        </div>
      )}
    </div>
  )
}
