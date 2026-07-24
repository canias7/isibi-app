import { Link2, Check } from 'lucide-react'
import { useState } from 'react'
import { cx } from '../lib/cx.js'

// ShareButtons — share the current page/record. Uses the native share sheet when available, else copies the link.
export default function ShareButtons({ url, title = '', className }) {
  const [copied, setCopied] = useState(false)
  const link = url || (typeof location !== 'undefined' ? location.href : '')
  const share = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) { await navigator.share({ title, url: link }); return }
      await navigator.clipboard.writeText(link)
      setCopied(true); setTimeout(() => setCopied(false), 1600)
    } catch {}
  }
  const targets = [
    { label: 'X', href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}&text=${encodeURIComponent(title)}` },
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}` },
    { label: 'Email', href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(link)}` },
  ]
  return (
    <div className={cx('flex flex-wrap items-center gap-2', className)}>
      <button type="button" onClick={share}
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-600 transition hover:bg-ink-50">
        {copied ? <Check size={13} className="text-emerald-500" /> : <Link2 size={13} />}
        {copied ? 'Link copied' : 'Share'}
      </button>
      {targets.map((t) => (
        <a key={t.label} href={t.href} target="_blank" rel="noopener noreferrer"
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-600 transition hover:bg-ink-50">
          {t.label}
        </a>
      ))}
    </div>
  )
}
