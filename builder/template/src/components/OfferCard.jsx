import { ArrowRight } from 'lucide-react'
import Avatar from './Avatar.jsx'
import Button from './Button.jsx'
import { cx } from '../lib/cx.js'

// OfferCard — a make-an-offer negotiation: what was asked, what was offered, and the gap between them.
// Marketplaces, freelance bids, property offers, trade-ins. The delta is the number both sides argue about,
// so the component computes and shows it rather than leaving it implied.
export default function OfferCard({
  from, avatar, listPrice, offer, currency = '$', message, at, status = 'pending', expiresIn,
  onAccept, onDecline, onCounter, className,
}) {
  const delta = Number(listPrice) - Number(offer)
  const pct = listPrice ? (delta / listPrice) * 100 : 0
  const open = status === 'pending'
  const tone = { accepted: 'bg-emerald-50 text-emerald-700', declined: 'bg-rose-50 text-rose-700', expired: 'bg-ink-100 text-ink-500', pending: 'bg-amber-50 text-amber-700' }
  const money = (n) => currency + Number(n).toLocaleString()
  return (
    <div className={cx('card-surface p-5', !open && 'opacity-75', className)}>
      <div className="flex items-start gap-3">
        <Avatar name={from} src={avatar} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-900">{from}</p>
          {at && <p className="text-xs text-ink-400">{at}</p>}
        </div>
        <span className={cx('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', tone[status] || tone.pending)}>{status}</span>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-400">Asking</p>
          <p className="font-display text-lg font-semibold tabular-nums text-ink-500 line-through decoration-ink-300">{money(listPrice)}</p>
        </div>
        <ArrowRight size={16} className="shrink-0 text-ink-300" aria-hidden="true" />
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-400">Offered</p>
          <p className="font-display text-2xl font-bold tabular-nums text-ink-900">{money(offer)}</p>
        </div>
        {delta !== 0 && (
          <p className={cx('ml-auto text-right text-sm tabular-nums', delta > 0 ? 'text-rose-600' : 'text-emerald-600')}>
            {delta > 0 ? '−' : '+'}{money(Math.abs(delta))}
            <span className="block text-xs text-ink-400">{Math.abs(pct).toFixed(0)}% {delta > 0 ? 'below' : 'above'}</span>
          </p>
        )}
      </div>
      {message && <p className="mt-3 rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-600">{message}</p>}
      {open && expiresIn && <p className="mt-2 text-xs text-amber-700">Expires in {expiresIn}</p>}
      {open && (onAccept || onDecline || onCounter) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onAccept && <Button size="sm" onClick={onAccept}>Accept {money(offer)}</Button>}
          {onCounter && <Button size="sm" variant="outline" onClick={onCounter}>Counter</Button>}
          {onDecline && <Button size="sm" variant="ghost" onClick={onDecline}>Decline</Button>}
        </div>
      )}
    </div>
  )
}
