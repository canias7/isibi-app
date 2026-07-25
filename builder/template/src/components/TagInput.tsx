import { useState } from 'react'
import { X } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface TagInputProps {
  value?: any[]
  onChange?: (...args: any[]) => any
  label?: ReactNode
  placeholder?: string
  max?: number
  className?: string
}

// TagInput — free-form tags/keywords (categories, skills, recipients). value is an array of strings.
export default function TagInput({ value = [], onChange, label, placeholder = 'Add and press Enter', max, className }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim()
    if (!t || value.includes(t) || (max && value.length >= max)) return setDraft('')
    onChange && onChange([...value, t]); setDraft('')
  }
  return (
    <div className={className}>
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-800">{label}</span>}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-ink-200 bg-surface px-2.5 py-2 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-brand-100 px-2 py-1 text-xs font-medium text-brand-700">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange && onChange(value.filter((x) => x !== t))}
              className="opacity-60 transition hover:opacity-100"><X size={12} /></button>
          </span>
        ))}
        <input value={draft} onChange={(e) => setDraft((e.target as any).value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } else if (e.key === 'Backspace' && !draft && value.length) onChange && onChange(value.slice(0, -1)) }}
          onBlur={add} placeholder={value.length ? '' : placeholder}
          className="min-w-32 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-ink-400" />
      </div>
    </div>
  )
}
