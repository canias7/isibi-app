import { useState } from 'react'
import CurrencyInput from './CurrencyInput.tsx'
import Slider from './Slider.tsx'
import { cx } from '../lib/cx.js'

// monthlyPayment — the standard amortised formula. Exported so a page can show a figure without the whole
// calculator (e.g. "from $1,840/mo" on a listing card).
export function monthlyPayment(principal, annualRate, years) {
  const n = years * 12
  const r = annualRate / 100 / 12
  if (!principal || !n) return 0
  if (!r) return principal / n
  return (principal * r) / (1 - Math.pow(1 + r, -n))
}

interface MortgageCalculatorProps {
  price?: number
  currency?: string
  defaultDeposit?: number
  defaultRate?: number
  defaultTerm?: number
  title?: string
  note?: string
  className?: string
}

// MortgageCalculator — the "can I afford this?" widget on a property listing. Everything recalculates live;
// nothing is submitted anywhere.
export default function MortgageCalculator({
  price = 400000, currency = '$', defaultDeposit = 10, defaultRate = 5.5, defaultTerm = 25,
  title = 'Repayment estimate', note = 'An estimate only — not a mortgage offer.', className,
}: MortgageCalculatorProps) {
  const [amount, setAmount] = useState(String(price))
  const [depositPct, setDepositPct] = useState(defaultDeposit)
  const [rate, setRate] = useState(defaultRate)
  const [term, setTerm] = useState(defaultTerm)
  const total = Number(amount) || 0
  const deposit = (total * depositPct) / 100
  const loan = Math.max(0, total - deposit)
  const monthly = monthlyPayment(loan, rate, term)
  const paid = monthly * term * 12
  const money = (n) => currency + Math.round(n).toLocaleString()
  return (
    <div className={cx('card-surface p-6', className)}>
      <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
      <div className="mt-5 space-y-5">
        <CurrencyInput label="Property price" value={amount} onChange={setAmount} symbol={currency} step="1000" />
        <Slider label="Deposit" value={depositPct} onChange={setDepositPct} min={0} max={60} step={1}
          format={(v) => `${v}% · ${money((total * v) / 100)}`} />
        <Slider label="Interest rate" value={rate} onChange={setRate} min={0.5} max={12} step={0.1} format={(v) => `${Number(v).toFixed(1)}%`} />
        <Slider label="Term" value={term} onChange={setTerm} min={5} max={40} step={1} format={(v) => `${v} years`} />
      </div>
      <div className="mt-6 rounded-xl2 bg-brand-50 p-5 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-700">Monthly repayment</p>
        <p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-brand-900">{money(monthly)}</p>
      </div>
      <dl className="mt-4 divide-y divide-ink-100 text-sm">
        {[['Loan amount', money(loan)], ['Deposit', money(deposit)], ['Total repaid', money(paid)], ['Interest paid', money(paid - loan)]].map(([k, v]) => (
          <div key={k} className="flex justify-between py-2">
            <dt className="text-ink-600">{k}</dt><dd className="font-medium tabular-nums text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-3 text-xs text-ink-400">{note}</p>}
    </div>
  )
}
