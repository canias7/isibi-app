import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface TransactionListProps {
  items?: any[]
  currency?: string
  onSelect?: (...args: any[]) => any
  showDayTotals?: boolean
  emptyText?: string
  className?: string
}

// TransactionList — a money ledger grouped by day, with a running per-day total. Banking, wallets, payouts,
// expenses. Credits and debits are signed AND coloured, because a minus sign alone is easy to miss.
// items: [{id, title, meta, amount, currency, at, day, category, icon, pending}]
export default function TransactionList({ items = [], currency = '$', onSelect, showDayTotals = true, emptyText = 'No transactions yet.', className }: TransactionListProps) {
  const byDay = items.reduce((acc, t) => { (acc[t.day || 'Earlier'] ||= []).push(t); return acc }, {})
  const money = (n) => `${n < 0 ? '−' : '+'}${currency}${Math.abs(n).toFixed(2)}`
  if (!items.length) return <p className={cx('py-10 text-center text-sm text-ink-400', className)}>{emptyText}</p>
  return (
    <div className={className}>
      {(Object.entries(byDay) as [string, any[]][]).map(([day, list]) => {
        const net = list.reduce((s, t) => s + (t.amount || 0), 0)
        return (
          <section key={day}>
            <div className="flex items-baseline justify-between gap-3 px-1 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">{day}</h3>
              {showDayTotals && <span className={cx('text-xs tabular-nums', net < 0 ? 'text-ink-500' : 'text-emerald-600')}>{money(net)}</span>}
            </div>
            <ul className="card-surface divide-y divide-ink-100 overflow-hidden">
              {list.map((t) => {
                const out = (t.amount || 0) < 0
                const Icon = t.icon || (out ? ArrowUpRight : ArrowDownLeft)
                const inner = (
                  <>
                    <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full',
                      out ? 'bg-ink-100 text-ink-500' : 'bg-emerald-50 text-emerald-600')}>
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-900">{t.title}</span>
                      <span className="block truncate text-xs text-ink-400">
                        {[t.category, t.meta, t.at].filter(Boolean).join(' · ')}
                        {t.pending && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Pending</span>}
                      </span>
                    </span>
                    <span className={cx('shrink-0 text-sm font-medium tabular-nums', out ? 'text-ink-900' : 'text-emerald-600')}>
                      {money(t.amount || 0)}
                    </span>
                  </>
                )
                return (
                  <li key={t.id}>
                    {onSelect
                      ? <button type="button" onClick={() => onSelect(t)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">{inner}</button>
                      : <div className="flex items-center gap-3 px-4 py-3">{inner}</div>}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
