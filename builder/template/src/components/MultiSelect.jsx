import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'
import { cx } from '../lib/cx.js'

// MultiSelect — pick several from a fixed list (categories, amenities, assignees). value is an array.
export default function MultiSelect({ options = [], value = [], onChange, label, placeholder = 'Select…', className }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const toggle = (v) => onChange && onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  const selected = opts.filter((o) => value.includes(o.value))
  return (
    <div ref={box} className={cx('relative', className)}>
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-800">{label}</span>}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-left
          focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
        <span className="flex min-w-0 flex-wrap gap-1">
          {selected.length === 0 && <span className="py-0.5 text-sm text-ink-400">{placeholder}</span>}
          {selected.map((o) => (
            <span key={o.value} className="inline-flex items-center gap-1 rounded-lg bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
              {o.label}
              <span role="button" aria-label={`Remove ${o.label}`} onClick={(e) => { e.stopPropagation(); toggle(o.value) }}
                className="opacity-60 hover:opacity-100"><X size={11} /></span>
            </span>
          ))}
        </span>
        <ChevronDown size={16} className={cx('shrink-0 text-ink-400 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <ul role="listbox" className="absolute z-30 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-ink-100 bg-white py-1 shadow-soft">
          {opts.map((o) => (
            <li key={o.value}>
              <button type="button" role="option" aria-selected={value.includes(o.value)} onClick={() => toggle(o.value)}
                className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-sm text-ink-700 transition hover:bg-ink-50">
                {o.label}
                {value.includes(o.value) && <Check size={15} className="text-brand-500" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
