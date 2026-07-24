import { cx } from '../lib/cx.js'

// ConsentBlock — scroll-to-read terms with an explicit agreement checkbox. Waivers, treatment consent,
// contracts, terms acceptance. The checkbox stays disabled until the text has been scrolled to the bottom
// when `requireScroll` is on, so "I have read this" means something.
import { useRef, useState } from 'react'

export default function ConsentBlock({
  title, terms, children, checked = false, onChange, label = 'I have read and agree to the above.',
  requireScroll = true, height = 200, meta, className,
}) {
  const [read, setRead] = useState(!requireScroll)
  const box = useRef(null)
  const onScroll = () => {
    const el = box.current
    if (!el || read) return
    // 8px of slack: sub-pixel heights mean scrollTop rarely lands exactly on the bottom.
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setRead(true)
  }
  return (
    <div className={cx('rounded-xl2 border border-ink-200', className)}>
      {title && <h3 className="border-b border-ink-100 px-5 py-3.5 font-display text-base font-semibold text-ink-900">{title}</h3>}
      <div ref={box} onScroll={onScroll} style={{ maxHeight: height }}
        className="overflow-y-auto px-5 py-4 text-sm leading-relaxed text-ink-600 [&>*+*]:mt-3">
        {children || <p>{terms}</p>}
      </div>
      <div className="border-t border-ink-100 bg-ink-50/60 px-5 py-3.5">
        <label className={cx('flex items-start gap-3 text-sm', read ? 'cursor-pointer' : 'cursor-not-allowed opacity-60')}>
          <input type="checkbox" checked={checked} disabled={!read} onChange={(e) => onChange && onChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" />
          <span className="text-ink-800">{label}</span>
        </label>
        {!read && <p className="mt-1.5 pl-7 text-xs text-ink-400">Scroll to the end to continue.</p>}
        {meta && read && <p className="mt-1.5 pl-7 text-xs text-ink-400">{meta}</p>}
      </div>
    </div>
  )
}
