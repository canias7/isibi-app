import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface RepeaterFieldProps {
  value?: any[]
  onChange?: (...args: any[]) => any
  renderRow?: any
  newRow?: (...args: any[]) => any
  label?: ReactNode
  addLabel?: string
  min?: number
  max?: number
  reorderable?: boolean
  className?: string
}

// RepeaterField — the add/remove/reorder rows control that every real form eventually needs: line items,
// work history, team members, ingredients, options, custom fields.
// The caller renders each row via `renderRow(row, index, update)`; this owns the array mechanics.
export default function RepeaterField({
  value = [], onChange, renderRow, newRow = () => ({}), label, addLabel = 'Add another',
  min = 0, max, reorderable = false, className,
}: RepeaterFieldProps) {
  const update = (i, patch) => onChange && onChange(value.map((r, j) => (i === j ? { ...r, ...patch } : r)))
  const remove = (i) => onChange && onChange(value.filter((_, j) => j !== i))
  const move = (i, dir) => {
    const j = i + dir
    if (!onChange || j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const full = max != null && value.length >= max
  return (
    <div className={className}>
      {label && <p className="mb-2 text-sm font-medium text-ink-700">{label}</p>}
      <ul className="space-y-2">
        {value.map((row, i) => (
          <li key={row.id ?? i} className="flex items-start gap-2">
            {reorderable && (
              // Keyboard-operable reordering: a drag handle alone is unusable without a mouse.
              <span className="flex shrink-0 flex-col pt-2 text-ink-300">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move row ${i + 1} up`}
                  className="rounded px-0.5 leading-none transition hover:text-ink-600 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">▲</button>
                <GripVertical size={13} aria-hidden="true" />
                <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label={`Move row ${i + 1} down`}
                  className="rounded px-0.5 leading-none transition hover:text-ink-600 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">▼</button>
              </span>
            )}
            <div className="min-w-0 flex-1">{renderRow(row, i, (patch) => update(i, patch))}</div>
            <button type="button" onClick={() => remove(i)} disabled={value.length <= min} aria-label={`Remove row ${i + 1}`}
              className={cx('mt-1.5 shrink-0 rounded-lg p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                value.length <= min ? 'cursor-not-allowed text-ink-200' : 'text-ink-400 hover:bg-ink-100 hover:text-rose-600')}>
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => onChange && onChange([...value, newRow()])} disabled={full}
        className={cx('mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          full ? 'cursor-not-allowed text-ink-300' : 'text-brand-600 hover:bg-brand-50')}>
        <Plus size={15} />{full ? `Maximum of ${max}` : addLabel}
      </button>
    </div>
  )
}
