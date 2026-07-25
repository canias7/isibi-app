import { useState } from 'react'
import { Tag, X } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface PromoCodeInputProps {
  applied?: any
  onApply?: (...args: any[]) => any
  onRemove?: (...args: any[]) => any
  label?: string
  placeholder?: string
  className?: string
}

// PromoCodeInput — the discount-code field in a checkout. onApply(code) should return (or resolve to)
// {ok, message} so the field can show the result inline; anything falsy is treated as an invalid code.
export default function PromoCodeInput({ applied, onApply, onRemove, label = 'Promo code', placeholder = 'Enter a code', className }: PromoCodeInputProps) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!c || !onApply) return
    setBusy(true); setMsg(null)
    try {
      const r = await onApply(c)
      if (r && r.ok) { setCode(''); setMsg({ ok: true, text: r.message || 'Code applied.' }) }
      else setMsg({ ok: false, text: (r && r.message) || 'That code is not valid.' })
    } catch {
      setMsg({ ok: false, text: 'We could not check that code. Try again.' })
    } finally { setBusy(false) }
  }

  if (applied) {
    return (
      <div className={cx('flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5', className)}>
        <Tag size={15} className="shrink-0 text-emerald-600" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium text-emerald-800">{applied.code}</span>
          {applied.description && <span className="ml-2 text-emerald-700">{applied.description}</span>}
        </span>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove code ${applied.code}`}
            className="shrink-0 rounded-md p-1 text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <X size={14} />
          </button>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className={className}>
      {label && <label htmlFor="promo-code" className="mb-1.5 block text-sm font-medium text-ink-700">{label}</label>}
      <div className="flex gap-2">
        <input id="promo-code" value={code} onChange={(e) => { setCode((e.target as any).value); setMsg(null) }}
          placeholder={placeholder} autoComplete="off" spellCheck="false"
          className={cx('min-w-0 flex-1 rounded-xl border bg-surface px-3.5 py-2.5 text-sm uppercase tracking-wide text-ink-900 placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-400 transition-colors',
            'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40',
            msg && !msg.ok ? 'border-rose-400' : 'border-ink-200 hover:border-ink-300')} />
        <button type="submit" disabled={!code.trim() || busy}
          className={cx('shrink-0 rounded-xl border border-ink-200 px-4 text-sm font-medium transition',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            !code.trim() || busy ? 'cursor-not-allowed text-ink-300' : 'text-ink-700 hover:bg-ink-50')}>
          {busy ? 'Checking…' : 'Apply'}
        </button>
      </div>
      {msg && <p className={cx('mt-1.5 text-xs', msg.ok ? 'text-emerald-600' : 'text-rose-600')} role="status">{msg.text}</p>}
    </form>
  )
}
