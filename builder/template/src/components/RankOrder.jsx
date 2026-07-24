import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { cx } from '../lib/cx.js'

// RankOrder — put these in order of preference. Priorities, feature voting, tie-breakers, playlist order.
// Drag AND arrow buttons: drag alone excludes keyboard and screen-reader users entirely, and this is often
// a required survey question.
// value: array of items [{id, label, hint}] in current order.
export default function RankOrder({ value = [], onChange, label, topLabel = 'Most important', bottomLabel = 'Least important', className }) {
  const move = (i, dir) => {
    const j = i + dir
    if (!onChange || j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const drop = (from, to) => {
    if (!onChange || from === to || from == null) return
    const next = [...value]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }
  return (
    <div className={className}>
      {label && <p className="mb-2 text-sm font-medium text-ink-700">{label}</p>}
      <p className="mb-2 text-xs text-ink-400">{topLabel} at the top</p>
      <ol className="space-y-1.5">
        {value.map((item, i) => (
          <li key={item.id ?? i} draggable
            onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i))}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); drop(Number(e.dataTransfer.getData('text/plain')), i) }}
            className="flex items-center gap-3 rounded-xl border border-ink-200 bg-surface p-3">
            <GripVertical size={15} className="shrink-0 cursor-grab text-ink-300" aria-hidden="true" />
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold tabular-nums text-brand-700">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink-800">{item.label}</span>
              {item.hint && <span className="block text-xs text-ink-400">{item.hint}</span>}
            </span>
            <span className="flex shrink-0 flex-col">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${item.label} up`}
                className="rounded p-0.5 text-ink-400 transition hover:text-ink-800 disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <ChevronUp size={14} />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label={`Move ${item.label} down`}
                className="rounded p-0.5 text-ink-400 transition hover:text-ink-800 disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <ChevronDown size={14} />
              </button>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-ink-400">{bottomLabel} at the bottom</p>
    </div>
  )
}
