import { Play } from 'lucide-react'
import { cx } from '../lib/cx.js'

// VideoChapters — the timestamp list beside a lesson, talk or podcast. onSeek(seconds) lets the page jump the
// player; without it the list is still a readable outline of what's covered.
// chapters: [{title, start, note}] where start is seconds (or 'MM:SS').
const toSeconds = (t) => (typeof t === 'number' ? t
  : String(t).split(':').reverse().reduce((s, p, i) => s + Number(p) * 60 ** i, 0))
const stamp = (s) => {
  const n = Math.max(0, Math.floor(s))
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), sec = n % 60
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(sec).padStart(2, '0')}`
}

export default function VideoChapters({ chapters = [], current, onSeek, title = 'Chapters', duration, className }) {
  const at = typeof current === 'number' ? current : -1
  // The active chapter is the LAST one whose start is behind the playhead.
  const activeIdx = chapters.reduce((best, c, i) => (toSeconds(c.start) <= at ? i : best), -1)
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      <div className="flex items-baseline justify-between border-b border-ink-100 px-5 py-3.5">
        <h3 className="font-display text-sm font-semibold text-ink-900">{title}</h3>
        <span className="text-xs text-ink-400">{chapters.length} sections{duration && ` · ${duration}`}</span>
      </div>
      <ol className="max-h-96 divide-y divide-ink-100 overflow-y-auto">
        {chapters.map((c, i) => {
          const s = toSeconds(c.start)
          return (
            <li key={i}>
              <button type="button" onClick={() => onSeek && onSeek(s)} disabled={!onSeek}
                className={cx('flex w-full items-start gap-3 px-5 py-3 text-left transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
                  i === activeIdx ? 'bg-brand-50' : onSeek && 'hover:bg-ink-50')}>
                <span className={cx('mt-0.5 shrink-0 font-mono text-xs tabular-nums', i === activeIdx ? 'text-brand-600' : 'text-ink-400')}>
                  {stamp(s)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block text-sm', i === activeIdx ? 'font-medium text-brand-900' : 'text-ink-800')}>{c.title}</span>
                  {c.note && <span className="mt-0.5 block text-xs text-ink-500">{c.note}</span>}
                </span>
                {i === activeIdx && <Play size={13} className="mt-1 shrink-0 fill-brand-600 text-brand-600" />}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
