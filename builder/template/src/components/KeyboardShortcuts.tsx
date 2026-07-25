import { useEffect, useState } from 'react'
import Modal from './Modal.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface KbdProps {
  children?: ReactNode
  className?: string
}

// Kbd — one key cap. Exported so shortcuts can be shown inline (in a menu, a tooltip, an empty state).
export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd className={cx('inline-grid min-w-6 place-items-center rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink-600 shadow-[0_1px_0_rgb(0_0_0/0.06)]', className)}>
      {children}
    </kbd>
  )
}

interface KeyboardShortcutsProps {
  groups?: any[]
  open?: boolean
  onOpenChange?: (...args: any[]) => any
  hotkey?: string
}

// KeyboardShortcuts — the "?" help sheet listing what the app's keys do. Any app with a command palette or
// power-user keys needs somewhere to discover them; this is that sheet, and it registers "?" itself.
// groups: [{title, items:[{keys:['⌘','K'], label}]}]
export default function KeyboardShortcuts({ groups = [], open: openProp, onOpenChange, hotkey = '?' }: KeyboardShortcutsProps) {
  const [openSelf, setOpenSelf] = useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : openSelf
  const setOpen = (v) => { if (!controlled) setOpenSelf(v); onOpenChange && onOpenChange(v) }
  useEffect(() => {
    const onKey = (e) => {
      // Never steal the key while the user is typing.
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === hotkey) { e.preventDefault(); setOpen(true) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts" size="lg">
      <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {groups.map((g, i) => (
          <div key={i}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{g.title}</p>
            <ul className="divide-y divide-ink-100">
              {g.items.map((it, j) => (
                <li key={j} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span className="text-ink-700">{it.label}</span>
                  <span className="flex shrink-0 gap-1">{it.keys.map((k, n) => <Kbd key={n}>{k}</Kbd>)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  )
}
