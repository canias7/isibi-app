import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cx } from '../lib/cx.js'

// CodeBlock — a code sample with a filename bar, optional line numbers and copy.
// Always dark (code reads best on a dark ground), so it looks deliberate on light and dark themes alike.
// tabs: pass [{label, code}] instead of `code` for a multi-language sample.
export default function CodeBlock({ code = '', filename, language, tabs, showLineNumbers = false, className }) {
  const [tab, setTab] = useState(0)
  const [copied, setCopied] = useState(false)
  const body = tabs && tabs.length ? (tabs[tab] || tabs[0]).code : code
  const copy = () => {
    try {
      navigator.clipboard.writeText(body)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked — the code is still selectable */ }
  }
  const lines = String(body).replace(/\n$/, '').split('\n')
  return (
    <div className={cx('overflow-hidden rounded-xl2 border border-ink-800/40 bg-[#12121a] shadow-soft', className)}>
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2">
        {tabs && tabs.length > 1 ? (
          <div className="flex gap-1">
            {tabs.map((t, i) => (
              <button key={i} type="button" onClick={() => setTab(i)}
                className={cx('rounded-md px-2.5 py-1 text-xs font-medium transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                  i === tab ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80')}>
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="font-mono text-xs text-white/50">{filename || language || 'code'}</span>
        )}
        <button type="button" onClick={copy} aria-label="Copy code"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
          {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed"><code className="font-mono text-white/90">
        {showLineNumbers
          ? lines.map((l, i) => (
              <span key={i} className="block">
                <span className="mr-4 inline-block w-6 select-none text-right text-white/25">{i + 1}</span>{l}
              </span>
            ))
          : body}
      </code></pre>
    </div>
  )
}
