import { MapPin } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { cx } from '../lib/cx.js'

// EventSchedule — a conference/festival agenda: sessions down the page by time, optionally split by track.
// WeekSchedule is a recurring weekly grid; this is a single day's running order, which is a different read.
// sessions: [{time, duration, title, track, room, speakers:[{name,avatar}], type, to}]
export default function EventSchedule({ sessions = [], tracks, day, onSelect, className }) {
  const byTime = sessions.reduce((acc, s) => { (acc[s.time] ||= []).push(s); return acc }, {})
  const times = Object.keys(byTime)
  const trackTone = (t) => {
    const list = tracks || [...new Set(sessions.map((s) => s.track).filter(Boolean))]
    const tones = ['bg-brand-50 text-brand-700', 'bg-accent-50 text-accent-700', 'bg-emerald-50 text-emerald-700', 'bg-sky-50 text-sky-700']
    return tones[Math.max(0, list.indexOf(t)) % tones.length]
  }
  return (
    <div className={className}>
      {day && <h3 className="mb-4 font-display text-lg font-semibold text-ink-900">{day}</h3>}
      <div className="space-y-1">
        {times.map((t) => (
          <div key={t} className="flex gap-4 border-t border-ink-100 py-4 first:border-t-0">
            <span className="w-16 shrink-0 pt-0.5 font-medium tabular-nums text-ink-500">{t}</span>
            <div className="min-w-0 flex-1 space-y-2">
              {byTime[t].map((s, i) => {
                const inner = (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      {s.track && <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', trackTone(s.track))}>{s.track}</span>}
                      {s.type && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600">{s.type}</span>}
                      {s.duration && <span className="text-[11px] text-ink-400">{s.duration}</span>}
                    </div>
                    <p className="mt-1.5 font-medium text-ink-900">{s.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      {(s.speakers || []).map((sp, j) => (
                        <span key={j} className="inline-flex items-center gap-1.5 text-sm text-ink-600">
                          <Avatar name={sp.name} src={sp.avatar} size="xs" />{sp.name}
                        </span>
                      ))}
                      {s.room && <span className="inline-flex items-center gap-1 text-xs text-ink-400"><MapPin size={12} />{s.room}</span>}
                    </div>
                  </>
                )
                const cls = cx('block w-full rounded-xl border border-ink-100 p-3.5 text-left transition',
                  (s.to || onSelect) && 'hover:border-ink-200 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500')
                return onSelect || s.to
                  ? <button key={i} type="button" onClick={() => onSelect && onSelect(s)} className={cls}>{inner}</button>
                  : <div key={i} className={cls}>{inner}</div>
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
