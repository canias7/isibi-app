import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface ParamTableProps {
  params?: any[]
  title?: ReactNode
  dense?: boolean
  className?: string
}

// ParamTable — the parameter/field reference under an endpoint or a config doc.
// params: [{name, type, required, default, description, enum}]
export default function ParamTable({ params = [], title, dense = false, className }: ParamTableProps) {
  if (!params.length) return null
  return (
    <div className={className}>
      {title && <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{title}</p>}
      <dl className={cx('divide-y divide-ink-100 rounded-xl border border-ink-100', dense && 'text-sm')}>
        {params.map((p, i) => (
          <div key={i} className="px-4 py-3">
            <dt className="flex flex-wrap items-baseline gap-x-2">
              <code className="font-mono text-sm font-medium text-ink-900">{p.name}</code>
              {p.type && <span className="font-mono text-xs text-brand-600">{p.type}</span>}
              {p.required
                ? <span className="text-[11px] font-medium uppercase tracking-wider text-rose-600">required</span>
                : <span className="text-[11px] uppercase tracking-wider text-ink-400">optional</span>}
              {p.default !== undefined && (
                <span className="text-xs text-ink-400">default <code className="font-mono text-ink-600">{String(p.default)}</code></span>
              )}
            </dt>
            {p.description && <dd className="mt-1 text-sm text-ink-600">{p.description}</dd>}
            {p.enum && p.enum.length > 0 && (
              <dd className="mt-1.5 flex flex-wrap gap-1">
                {p.enum.map((e) => <code key={e} className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-700">{e}</code>)}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  )
}
