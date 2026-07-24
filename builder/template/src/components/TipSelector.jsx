import { useState } from 'react'
import { cx } from '../lib/cx.js'

// TipSelector — percentage presets plus a custom amount, for checkouts and service bills.
// onChange({ percent, amount }) always reports BOTH, so the caller never has to redo the maths.
export default function TipSelector({
  subtotal = 0, value, onChange, presets = [0, 10, 15, 20], currency = '$', label = 'Add a tip', note, className,
}) {
  const [custom, setCustom] = useState('')
  const percent = value && value.percent
  const money = (n) => currency + n.toFixed(2)
  const pick = (p) => { setCustom(''); onChange && onChange({ percent: p, amount: (subtotal * p) / 100 }) }
  const typeCustom = (v) => {
    setCustom(v)
    const amount = Math.max(0, Number(v) || 0)
    onChange && onChange({ percent: subtotal ? (amount / subtotal) * 100 : 0, amount, custom: true })
  }
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink-700">{label}</span>
        {value && <span className="text-sm tabular-nums text-ink-600">{money(value.amount || 0)}</span>}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {presets.map((p) => {
          const on = !custom && percent === p
          return (
            <button key={p} type="button" onClick={() => pick(p)} aria-pressed={on}
              className={cx('rounded-xl border py-2.5 text-center transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-700 hover:border-ink-400')}>
              <span className="block text-sm font-medium">{p === 0 ? 'None' : `${p}%`}</span>
              {p > 0 && <span className="block text-[11px] tabular-nums text-ink-400">{money((subtotal * p) / 100)}</span>}
            </button>
          )
        })}
      </div>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute inset-y-0 left-0 grid w-9 place-items-center text-sm text-ink-400">{currency}</span>
        <input type="number" min="0" step="0.5" inputMode="decimal" value={custom} onChange={(e) => typeCustom(e.target.value)}
          placeholder="Custom amount" aria-label="Custom tip amount"
          className="w-full rounded-xl border border-ink-200 bg-surface py-2.5 pl-9 pr-3.5 text-sm tabular-nums text-ink-900 placeholder:text-ink-400 transition-colors hover:border-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      </div>
      {note && <p className="mt-2 text-xs text-ink-400">{note}</p>}
    </div>
  )
}
