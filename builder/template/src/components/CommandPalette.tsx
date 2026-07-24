import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface CommandPaletteProps {
  items?: any[]
  placeholder?: string
  open?: boolean
  onOpenChange?: (...args: any[]) => any
  hotkey?: string
}

// CommandPalette — ⌘K / Ctrl-K quick search and actions. The single control that makes an app feel like a
// product rather than a page. Items: [{id, label, hint, icon, group, to, onSelect}] — `to` navigates, otherwise
// onSelect runs. Mount it ONCE (in a layout or on the dashboard page); it registers the global shortcut itself.
export default function CommandPalette({ items = [], placeholder = 'Search or jump to…', open: openProp, onOpenChange, hotkey = 'k' }: CommandPaletteProps) {
  const [openSelf, setOpenSelf] = useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : openSelf
  const setOpen = (v) => { if (!controlled) setOpenSelf(v); onOpenChange && onOpenChange(v) }
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<any>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === hotkey) { e.preventDefault(); setOpen(!open) }
      else if (e.key === 'Escape' && open) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const hits = !needle ? items : items.filter((i) =>
      (i.label + ' ' + (i.hint || '') + ' ' + (i.group || '')).toLowerCase().includes(needle))
    return hits.slice(0, 30)
  }, [items, q])

  useEffect(() => { setCursor(0) }, [q, open])
  if (!open) return null

  const run = (item) => {
    if (!item) return
    setOpen(false); setQ('')
    if (item.onSelect) item.onSelect()
    else if (item.to) navigate(item.to)
  }
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(results.length - 1, c + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[cursor]) }
  }

  // Group headers are emitted inline while walking the flat list, so the keyboard cursor stays a single index.
  let lastGroup = null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink-900/40 p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-ink-100 bg-surface shadow-xl">
        <div className="flex items-center gap-3 border-b border-ink-100 px-4">
          <Search size={16} className="shrink-0 text-ink-400" />
          <input autoFocus value={q} onChange={(e) => setQ((e.target as any).value)} onKeyDown={onKeyDown} placeholder={placeholder}
            aria-label={String(placeholder ?? "")} className="w-full bg-transparent py-4 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none" />
          <kbd className="hidden shrink-0 rounded border border-ink-200 px-1.5 py-0.5 font-mono text-[10px] text-ink-400 sm:block">esc</kbd>
        </div>
        <ul ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-ink-400">Nothing matches “{q}”.</li>}
          {results.map((item, i) => {
            const header = item.group && item.group !== lastGroup ? (lastGroup = item.group) : null
            const Icon = item.icon
            return (
              <li key={item.id || i}>
                {header && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{header}</p>}
                <button type="button" onMouseEnter={() => setCursor(i)} onClick={() => run(item)}
                  className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition',
                    i === cursor ? 'bg-brand-50 text-brand-900' : 'text-ink-700')}>
                  {Icon && <Icon size={16} className={i === cursor ? 'text-brand-600' : 'text-ink-400'} />}
                  <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                  {item.hint && <span className="shrink-0 text-xs text-ink-400">{item.hint}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
