import { useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { cx } from '../lib/cx.js'

// ExchangeRate — a two-field converter with a swap. Currency is the obvious case; it also does units,
// tokens, points and any fixed-ratio pair. `rate` is 1 `from` = rate `to`.
export default function ExchangeRate({
  from = 'USD', to = 'EUR', rate = 1, onSwap, fee, updated, currencies, onChangeFrom, onChangeTo, className,
}) {
  const [amount, setAmount] = useState('100')
  const [inverted, setInverted] = useState(false)
  const r = inverted ? 1 / rate : rate
  const [a, b] = inverted ? [to, from] : [from, to]
  const n = Number(amount) || 0
  const out = n * r
  const swap = () => { setInverted((i) => !i); onSwap && onSwap() }
  const sel = 'rounded-lg border-0 bg-transparent py-0 pl-1 pr-6 text-sm font-medium text-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
  return (
    <div className={cx('card-surface p-5', className)}>
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-xl border border-ink-200 px-3.5 py-3">
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={`Amount in ${a}`}
            className="min-w-0 flex-1 bg-transparent font-display text-xl font-semibold tabular-nums text-ink-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          {currencies && onChangeFrom
            ? <select value={a} onChange={(e) => onChangeFrom(e.target.value)} className={sel}>{currencies.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            : <span className="shrink-0 text-sm font-medium text-ink-500">{a}</span>}
        </div>
        <div className="flex justify-center">
          <button type="button" onClick={swap} aria-label="Swap currencies"
            className="grid h-8 w-8 place-items-center rounded-full border border-ink-200 bg-surface text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <ArrowLeftRight size={14} />
          </button>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-ink-50 px-3.5 py-3">
          <span className="min-w-0 flex-1 font-display text-xl font-semibold tabular-nums text-ink-900">
            {out.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
          {currencies && onChangeTo
            ? <select value={b} onChange={(e) => onChangeTo(e.target.value)} className={sel}>{currencies.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            : <span className="shrink-0 text-sm font-medium text-ink-500">{b}</span>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-xs text-ink-400">
        <span className="tabular-nums">1 {a} = {r.toLocaleString(undefined, { maximumFractionDigits: 4 })} {b}</span>
        {fee && <span>{fee}</span>}
        {updated && <span>Updated {updated}</span>}
      </div>
    </div>
  )
}
