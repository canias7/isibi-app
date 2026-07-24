import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cx } from '../lib/cx.js'

// CopyButton — copy-to-clipboard with confirmation (invite links, API keys, order numbers).
export default function CopyButton({ value, label = 'Copy', copiedLabel = 'Copied', className }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(String(value)) } catch {}
    setDone(true); setTimeout(() => setDone(false), 1600)
  }
  return (
    <button type="button" onClick={copy}
      className={cx('inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-600 transition hover:bg-ink-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', className)}>
      {done ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
      {done ? copiedLabel : label}
    </button>
  )
}
