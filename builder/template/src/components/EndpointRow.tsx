import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

// METHOD_TONES — the conventional REST verb colours. Exported so tables and logs elsewhere match.
export const METHOD_TONES = {
  GET: 'bg-sky-100 text-sky-700',
  POST: 'bg-emerald-100 text-emerald-700',
  PUT: 'bg-amber-100 text-amber-700',
  PATCH: 'bg-violet-100 text-violet-700',
  DELETE: 'bg-rose-100 text-rose-700',
}

interface EndpointRowProps {
  method?: string
  path?: any
  summary?: any
  auth?: any
  deprecated?: any
  children?: ReactNode
  defaultOpen?: boolean
  className?: string
}

// EndpointRow — one route in API documentation: verb, path, summary, and an expandable body.
// The verb badge is fixed-width so a column of them lines up, which is what makes a long reference scannable.
export default function EndpointRow({
  method = 'GET', path, summary, auth, deprecated, children, defaultOpen = false, className,
}: EndpointRowProps) {
  const [open, setOpen] = useState(defaultOpen)
  const m = String(method).toUpperCase()
  return (
    <div className={cx('border-b border-ink-100 last:border-b-0', className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">
        <ChevronRight size={14} className={cx('shrink-0 text-ink-300 transition-transform', open && 'rotate-90')} />
        <span className={cx('w-16 shrink-0 rounded-md px-2 py-1 text-center font-mono text-[11px] font-bold', METHOD_TONES[m] || 'bg-ink-100 text-ink-600')}>
          {m}
        </span>
        <code className={cx('min-w-0 truncate font-mono text-sm', deprecated ? 'text-ink-400 line-through' : 'text-ink-900')}>{path}</code>
        {summary && <span className="hidden min-w-0 flex-1 truncate text-sm text-ink-500 sm:block">{summary}</span>}
        {auth && <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-500">{auth}</span>}
        {deprecated && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">Deprecated</span>}
      </button>
      {open && children && <div className="space-y-4 px-4 pb-5 pl-[5.5rem]">{children}</div>}
    </div>
  )
}
