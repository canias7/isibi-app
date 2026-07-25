import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'
import type { Option } from '../lib/types.ts'

interface ComboboxProps {
  options?: any[]
  value?: any
  onChange?: (...args: any[]) => any
  label?: ReactNode
  placeholder?: string
  emptyText?: string
  className?: string
}

// Combobox — a searchable single-select. options: [{value,label,hint}] or plain strings.
export default function Combobox({ options = [], value, onChange, label, placeholder = 'Select…', emptyText = 'No matches', className }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef<any>(null)
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  const selected = opts.find((o) => o.value === value)
  const shown = useMemo(
    () => opts.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())),
    [q, options]
  )
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={box} className={cx('relative', className)}>
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-800">{label}</span>}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-ink-200 bg-surface px-3.5 py-2.5 text-left text-sm
          focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
        <span className={cx('truncate', selected ? 'text-ink-900' : 'text-ink-400')}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className={cx('shrink-0 text-ink-400 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-ink-100 bg-surface shadow-soft">
          <div className="flex items-center gap-2 border-b border-ink-100 px-3 py-2">
            <Search size={14} className="text-ink-400" />
            <input autoFocus value={q} onChange={(e) => setQ((e.target as any).value)} placeholder="Search…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400" />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {shown.length === 0 && <li className="px-3.5 py-3 text-sm text-ink-400">{emptyText}</li>}
            {shown.map((o) => (
              <li key={o.value}>
                <button type="button" role="option" aria-selected={o.value === value}
                  onClick={() => { onChange && onChange(o.value); setOpen(false); setQ('') }}
                  className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-sm text-ink-700 transition hover:bg-ink-50">
                  <span className="min-w-0"><span className="block truncate">{o.label}</span>
                    {o.hint && <span className="block truncate text-xs text-ink-400">{o.hint}</span>}</span>
                  {o.value === value && <Check size={15} className="shrink-0 text-brand-500" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
