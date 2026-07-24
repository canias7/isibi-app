import { useState } from 'react'
import { Check, Copy, Eye, EyeOff, Trash2 } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface ApiKeyRowProps {
  name?: string
  value?: string
  created?: any
  lastUsed?: any
  scope?: any
  onRevoke?: (...args: any[]) => any
  revealable?: boolean
  className?: string
}

// ApiKeyRow — one credential in a developer-settings list: masked value, reveal, copy, revoke.
// Masking by default is the point — a key on screen is a key in a screenshot.
export default function ApiKeyRow({ name, value = '', created, lastUsed, scope, onRevoke, revealable = true, className }: ApiKeyRowProps) {
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)
  const masked = value ? `${value.slice(0, 7)}${'•'.repeat(Math.max(4, Math.min(20, value.length - 11)))}${value.slice(-4)}` : ''
  const copy = () => {
    try {
      navigator.clipboard.writeText(value)
      setCopied(true); setTimeout(() => setCopied(false), 1600)
    } catch {}
  }
  return (
    <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5', className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-ink-900">{name}</p>
          {scope && <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">{scope}</span>}
        </div>
        <p className="mt-1 font-mono text-xs text-ink-500">{shown ? value : masked}</p>
      </div>
      <div className="flex items-center gap-4 text-xs text-ink-400">
        {created && <span className="hidden sm:block">Created {created}</span>}
        {lastUsed && <span className="hidden md:block">Last used {lastUsed}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {revealable && (
          <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? `Hide ${name}` : `Reveal ${name}`}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            {shown ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
        <button type="button" onClick={copy} aria-label={`Copy ${name}`}
          className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
        </button>
        {onRevoke && (
          <button type="button" onClick={onRevoke} aria-label={`Revoke ${name}`}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
