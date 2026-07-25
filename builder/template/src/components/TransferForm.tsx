import { useState } from 'react'
import { ArrowDown } from 'lucide-react'
import CurrencyInput from './CurrencyInput.tsx'
import Button from './Button.tsx'
import { cx } from '../lib/cx.js'

interface TransferFormProps {
  accounts?: any[]
  payees?: any[]
  onSubmit?: (...args: any[]) => any
  busy?: boolean
  currency?: string
  title?: string
  submitLabel?: string
  className?: string
}

// TransferForm — move money between accounts, or send to a payee. Validates against the source balance BEFORE
// submit, because "insufficient funds" discovered server-side is the worst possible time to learn it.
// accounts: [{id, name, balance, number}]
export default function TransferForm({
  accounts = [], payees = [], onSubmit, busy = false, currency = '$', title = 'Transfer', submitLabel = 'Review transfer', className,
}: TransferFormProps) {
  const [from, setFrom] = useState(accounts[0] && accounts[0].id)
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const source = accounts.find((a) => a.id === from)
  const n = Number(amount) || 0
  const overdrawn = source && n > source.balance
  const ready = from && to && n > 0 && !overdrawn && from !== to
  const targets = [...accounts.filter((a) => a.id !== from).map((a) => ({ id: a.id, label: `${a.name} · ${currency}${a.balance}` })),
    ...payees.map((p) => ({ id: p.id, label: `${p.name}${p.detail ? ` · ${p.detail}` : ''}` }))]
  const field = 'w-full rounded-xl border border-ink-200 bg-surface px-3.5 py-2.5 text-sm text-ink-900 transition-colors hover:border-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40'
  return (
    <form className={cx('card-surface p-6', className)}
      onSubmit={(e) => { e.preventDefault(); if (ready && !busy) onSubmit && onSubmit({ from, to, amount: n, reference }) }}>
      <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
      <div className="mt-5 space-y-1">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">From</span>
          <select value={from} onChange={(e) => setFrom((e.target as any).value)} className={field}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {currency}{a.balance}</option>)}
          </select>
        </label>
        <div className="flex justify-center py-1">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-ink-100 text-ink-400"><ArrowDown size={14} /></span>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">To</span>
          <select value={to} onChange={(e) => setTo((e.target as any).value)} className={field}>
            <option value="">Choose an account or payee…</option>
            {targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4">
        <CurrencyInput label="Amount" value={amount} onChange={setAmount} symbol={currency}
          error={overdrawn ? `That is more than the ${currency}${source.balance} available in ${source.name}.` : undefined} />
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium text-ink-700">Reference (optional)</span>
        <input value={reference} onChange={(e) => setReference((e.target as any).value)} maxLength={35} placeholder="What is this for?" className={field} />
      </label>
      <Button type="submit" disabled={!ready || busy} className="mt-6 w-full justify-center">
        {busy ? 'Working…' : submitLabel}
      </Button>
    </form>
  )
}
