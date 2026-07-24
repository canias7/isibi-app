import { Download, FileText } from 'lucide-react'
import { cx } from '../lib/cx.js'

// StatementRow — one downloadable document in a billing/statements list: invoices, payslips, tax documents,
// reports. InvoiceTable is the contents of one; this is the row that links to it.
export default function StatementRow({
  title, period, amount, status, issued, href, onDownload, size, format = 'PDF', className,
}) {
  const tone = /paid|complete/i.test(status || '') ? 'bg-emerald-50 text-emerald-700'
    : /overdue|failed/i.test(status || '') ? 'bg-rose-50 text-rose-700'
    : /pending|due/i.test(status || '') ? 'bg-amber-50 text-amber-700' : 'bg-ink-100 text-ink-600'
  return (
    <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5', className)}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-500">
        <FileText size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{title}</p>
        <p className="truncate text-xs text-ink-400">
          {[period, issued && `Issued ${issued}`, size && `${format} · ${size}`].filter(Boolean).join(' · ')}
        </p>
      </div>
      {status && <span className={cx('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', tone)}>{status}</span>}
      {amount && <span className="shrink-0 text-sm font-medium tabular-nums text-ink-900">{amount}</span>}
      {(href || onDownload) && (
        href
          ? <a href={href} download
              className="shrink-0 rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label={`Download ${title}`}><Download size={16} /></a>
          : <button type="button" onClick={onDownload} aria-label={`Download ${title}`}
              className="shrink-0 rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <Download size={16} />
            </button>
      )}
    </div>
  )
}
