import { AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { cx } from '../lib/cx.js'

// SlaBadge — time left against a service commitment. Turns a due-by timestamp into the one thing an agent
// needs: am I about to breach this? Feed it `minutesLeft` (negative = already breached) or a `dueAt` ISO.
export default function SlaBadge({ minutesLeft, dueAt, met, label = 'First response', compact = false, className }) {
  const mins = minutesLeft != null ? minutesLeft
    : dueAt ? Math.round((new Date(dueAt) - new Date()) / 60000) : null
  if (met) {
    return (
      <span className={cx('inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700', className)}>
        <CheckCircle2 size={12} />{compact ? 'Met' : `${label} met`}
      </span>
    )
  }
  if (mins == null) return null
  const breached = mins < 0
  const soon = mins >= 0 && mins <= 60
  const human = (m) => {
    const a = Math.abs(m)
    if (a < 60) return `${a}m`
    if (a < 1440) return `${Math.floor(a / 60)}h ${a % 60}m`
    return `${Math.floor(a / 1440)}d`
  }
  const tone = breached ? 'bg-rose-50 text-rose-700' : soon ? 'bg-amber-50 text-amber-800' : 'bg-ink-100 text-ink-600'
  const Icon = breached ? AlertCircle : Clock
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums', tone, className)}
      title={dueAt ? `Due ${new Date(dueAt).toLocaleString()}` : undefined}>
      <Icon size={12} />
      {breached
        ? (compact ? `−${human(mins)}` : `Breached ${human(mins)} ago`)
        : (compact ? human(mins) : `${human(mins)} to ${label.toLowerCase()}`)}
    </span>
  )
}
