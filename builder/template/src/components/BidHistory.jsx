import Avatar from './Avatar.jsx'
import { cx } from '../lib/cx.js'

// BidHistory — the running bid log on an auction or tender. Newest first, leader highlighted, outbid entries
// struck back. Bidder names are usually masked on public auctions; pass them pre-masked.
// bids: [{id, bidder, avatar, amount, at, auto, you}]
export default function BidHistory({
  bids = [], currency = '$', title = 'Bid history', reserveMet, emptyText = 'No bids yet — be the first.', className,
}) {
  const top = bids[0]
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      <div className="flex items-baseline justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <h3 className="font-display text-base font-semibold text-ink-900">
          {title} <span className="ml-1 text-sm font-normal text-ink-400">{bids.length}</span>
        </h3>
        {reserveMet != null && (
          <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-medium',
            reserveMet ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
            {reserveMet ? 'Reserve met' : 'Reserve not met'}
          </span>
        )}
      </div>
      {bids.length === 0
        ? <p className="px-5 py-10 text-center text-sm text-ink-400">{emptyText}</p>
        : (
          <ul className="max-h-80 divide-y divide-ink-100 overflow-y-auto">
            {bids.map((b) => {
              const leading = top && b.id === top.id
              return (
                <li key={b.id} className={cx('flex items-center gap-3 px-5 py-3', leading && 'bg-emerald-50/60')}>
                  <Avatar name={b.bidder} src={b.avatar} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink-800">
                      {b.bidder}
                      {b.you && <span className="ml-1.5 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">You</span>}
                    </span>
                    <span className="block text-xs text-ink-400">{b.at}{b.auto && ' · automatic bid'}</span>
                  </span>
                  <span className={cx('shrink-0 text-sm font-medium tabular-nums',
                    leading ? 'text-emerald-700' : 'text-ink-500 line-through decoration-ink-300')}>
                    {currency}{b.amount}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
    </div>
  )
}
