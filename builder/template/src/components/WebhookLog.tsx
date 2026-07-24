import { useState } from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { METHOD_TONES } from './EndpointRow.tsx'
import { cx } from '../lib/cx.js'

interface WebhookLogProps {
  entries?: any[]
  onRetry?: (...args: any[]) => any
  title?: string
  emptyText?: string
  className?: string
}

// WebhookLog — delivery attempts for webhooks or outbound calls: event, response code, latency, retry.
// The failing rows are the only reason anyone opens this page, so a non-2xx status is loud and the retry
// button lives on the row rather than behind a detail view.
// entries: [{id, event, url, method, status, ms, at, attempt, requestBody, responseBody}]
export default function WebhookLog({ entries = [], onRetry, title = 'Recent deliveries', emptyText = 'No deliveries yet.', className }: WebhookLogProps) {
  const [open, setOpen] = useState(null)
  const tone = (s) => (s >= 200 && s < 300 ? 'bg-emerald-100 text-emerald-700'
    : s >= 300 && s < 400 ? 'bg-sky-100 text-sky-700'
    : s >= 400 && s < 500 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      <h3 className="border-b border-ink-100 px-5 py-4 font-display text-base font-semibold text-ink-900">{title}</h3>
      {entries.length === 0
        ? <p className="px-5 py-10 text-center text-sm text-ink-400">{emptyText}</p>
        : (
          <ul className="divide-y divide-ink-100">
            {entries.map((e) => {
              const expanded = open === e.id
              return (
                <li key={e.id}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button type="button" onClick={() => setOpen(expanded ? null : e.id)} aria-expanded={expanded} aria-label={`Details for ${e.event}`}
                      className="shrink-0 rounded p-0.5 text-ink-300 transition hover:text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                      <ChevronRight size={14} className={cx('transition-transform', expanded && 'rotate-90')} />
                    </button>
                    <span className={cx('w-14 shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-[10px] font-bold',
                      METHOD_TONES[String(e.method || 'POST').toUpperCase()] || 'bg-ink-100 text-ink-600')}>
                      {String(e.method || 'POST').toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs text-ink-900">{e.event}</span>
                      {e.url && <span className="block truncate font-mono text-[11px] text-ink-400">{e.url}</span>}
                    </span>
                    {e.attempt > 1 && <span className="shrink-0 text-[11px] text-ink-400">try {e.attempt}</span>}
                    {e.ms != null && <span className="shrink-0 text-xs tabular-nums text-ink-400">{e.ms}ms</span>}
                    <span className={cx('w-11 shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold tabular-nums', tone(e.status))}>
                      {e.status}
                    </span>
                    <span className="hidden shrink-0 text-xs tabular-nums text-ink-400 sm:block">{e.at}</span>
                    {onRetry && e.status >= 400 && (
                      <button type="button" onClick={() => onRetry(e)} aria-label={`Retry ${e.event}`}
                        className="shrink-0 rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                  {expanded && (
                    <div className="grid gap-3 bg-ink-50 px-4 py-4 lg:grid-cols-2">
                      {[['Request', e.requestBody], ['Response', e.responseBody]].map(([k, v]) => (
                        <div key={k}>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{k}</p>
                          <pre className="max-h-48 overflow-auto rounded-lg bg-[#12121a] p-3 font-mono text-[11px] leading-relaxed text-white/85">
                            {typeof v === 'string' ? v : JSON.stringify(v, null, 2) || '—'}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
    </div>
  )
}
