import { useState } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface InlineEditProps {
  value?: string
  onSave?: (...args: any[]) => any
  placeholder?: string
  as?: any
  className?: string
}

// InlineEdit — click a value to edit it in place (admin tables, profile fields, quick renames).
export default function InlineEdit({ value = '', onSave, placeholder = 'Empty', as = 'input', className }: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const commit = () => { setEditing(false); if (draft !== value && onSave) onSave(draft) }
  if (!editing) {
    return (
      <button type="button" onClick={() => { setDraft(value); setEditing(true) }}
        className={cx('group inline-flex items-center gap-1.5 rounded px-1 -mx-1 text-left text-sm transition hover:bg-ink-100', className)}>
        <span className={value ? 'text-ink-900' : 'text-ink-300'}>{value || placeholder}</span>
        <Pencil size={12} className="opacity-0 transition group-hover:opacity-50" />
      </button>
    )
  }
  const Field = as === 'textarea' ? 'textarea' : 'input'
  return (
    <span className={cx('inline-flex items-center gap-1', className)}>
      <Field autoFocus value={draft} onChange={(e) => setDraft((e.target as any).value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && as !== 'textarea') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="rounded-lg border border-brand-400 px-2 py-1 text-sm outline-none ring-2 ring-brand-500/20" />
      <button type="button" aria-label="Save" onClick={commit} className="text-emerald-600 hover:text-emerald-700"><Check size={15} /></button>
      <button type="button" aria-label="Cancel" onClick={() => setEditing(false)} className="text-ink-400 hover:text-ink-600"><X size={15} /></button>
    </span>
  )
}
