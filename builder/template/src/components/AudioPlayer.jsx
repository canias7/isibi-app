import { useRef, useState } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'
import { cx } from '../lib/cx.js'

// AudioPlayer — podcast episodes, voice notes, course audio. Native <audio> under a styled shell.
const fmt = (s) => (isNaN(s) ? '0:00' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`)

export default function AudioPlayer({ src, title, subtitle, className }) {
  const el = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(0)
  const toggle = () => {
    if (!el.current) return
    if (playing) { el.current.pause() } else { el.current.play().catch(() => {}) }
    setPlaying(!playing)
  }
  return (
    <div className={cx('card-surface flex items-center gap-4 p-4', className)}>
      <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-500 text-brandfg transition hover:bg-brand-600">
        {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        {title && <p className="truncate text-sm font-medium text-ink-900">{title}</p>}
        {subtitle && <p className="truncate text-xs text-ink-500">{subtitle}</p>}
        <div className="mt-2 flex items-center gap-2">
          <input type="range" min={0} max={dur || 0} value={time} aria-label="Seek"
            onChange={(e) => { const v = Number(e.target.value); setTime(v); if (el.current) el.current.currentTime = v }}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-ink-200
              [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500" />
          <span className="shrink-0 text-xs tabular-nums text-ink-400">{fmt(time)} / {fmt(dur)}</span>
          <Volume2 size={14} className="shrink-0 text-ink-300" />
        </div>
      </div>
      <audio ref={el} src={src} preload="metadata" onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.target.currentTime)} onLoadedMetadata={(e) => setDur(e.target.duration)} />
    </div>
  )
}
