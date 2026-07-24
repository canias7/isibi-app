import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface TeamSwitcherProps {
  teams?: any[]
  value?: any
  onChange?: (...args: any[]) => any
  onCreate?: (...args: any[]) => any
  createLabel?: string
  className?: string
}

// TeamSwitcher — the workspace/organisation/store selector that sits at the top of a dashboard sidebar.
// teams: [{id, name, plan, logo}]. Multi-tenant apps need this the moment a user belongs to two of anything.
export default function TeamSwitcher({ teams = [], value, onChange, onCreate, createLabel = 'New workspace', className }: TeamSwitcherProps) {
  const [open, setOpen] = useState(false)
  const box = useRef<any>(null)
  const active = teams.find((t) => t.id === value) || teams[0]
  useEffect(() => {
    if (!open) return
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  if (!active) return null
  const initials = (n) => String(n).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div ref={box} className={cx('relative', className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl border border-ink-200 bg-surface px-2.5 py-2 text-left transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand-500 text-xs font-semibold text-brandfg">
          {active.logo ? <img src={active.logo} alt="" className="h-full w-full object-cover" /> : initials(active.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink-900">{active.name}</span>
          {active.plan && <span className="block truncate text-xs text-ink-400">{active.plan}</span>}
        </span>
        <ChevronsUpDown size={15} className="shrink-0 text-ink-400" />
      </button>
      {open && (
        <ul role="listbox" className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-ink-100 bg-surface p-1 shadow-soft">
          {teams.map((t) => (
            <li key={t.id} role="option" aria-selected={t.id === active.id}>
              <button type="button" onClick={() => { onChange && onChange(t.id); setOpen(false) }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-md bg-ink-200 text-[10px] font-semibold text-ink-700">
                  {t.logo ? <img src={t.logo} alt="" className="h-full w-full object-cover" /> : initials(t.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-800">{t.name}</span>
                {t.id === active.id && <Check size={14} className="shrink-0 text-brand-600" />}
              </button>
            </li>
          ))}
          {onCreate && (
            <li className="mt-1 border-t border-ink-100 pt-1">
              <button type="button" onClick={() => { setOpen(false); onCreate() }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-ink-600 transition hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <span className="grid h-6 w-6 place-items-center"><Plus size={14} /></span>{createLabel}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
