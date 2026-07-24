import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface EnvSelectorProps {
  envs?: any[]
  value?: any
  onChange?: (...args: any[]) => any
  label?: string
  className?: string
}

// EnvSelector — switch between environments (production / staging / local) or tenants. Production carries a
// warning tint on purpose: the whole class of "I ran that against prod" incidents starts with a switcher
// that looks the same everywhere.
// envs: [{id, label, hint, danger}]
export default function EnvSelector({ envs = [], value, onChange, label = 'Environment', className }: EnvSelectorProps) {
  const [open, setOpen] = useState(false)
  const box = useRef<any>(null)
  const active = envs.find((e) => e.id === value) || envs[0]
  useEffect(() => {
    if (!open) return
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  if (!active) return null
  return (
    <div ref={box} className={cx('relative', className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={String(label ?? "")}
        className={cx('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          active.danger ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
            : 'border-ink-200 bg-surface text-ink-700 hover:bg-ink-50')}>
        <span className={cx('h-2 w-2 rounded-full', active.danger ? 'bg-rose-500' : 'bg-emerald-500')} aria-hidden="true" />
        {active.label}
        <ChevronDown size={14} className="opacity-60" />
      </button>
      {open && (
        <ul role="listbox" className="absolute right-0 z-30 mt-1.5 min-w-56 overflow-hidden rounded-xl border border-ink-100 bg-surface p-1 shadow-soft">
          {envs.map((e) => (
            <li key={e.id} role="option" aria-selected={e.id === active.id}>
              <button type="button" onClick={() => { onChange && onChange(e.id); setOpen(false) }}
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', e.danger ? 'bg-rose-500' : 'bg-emerald-500')} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink-900">{e.label}</span>
                  {e.hint && <span className="block truncate font-mono text-[11px] text-ink-400">{e.hint}</span>}
                </span>
                {e.id === active.id && <Check size={14} className="mt-0.5 shrink-0 text-brand-600" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
