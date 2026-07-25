import { useState } from 'react'
import Input from './Input.tsx'
import Textarea from './Textarea.tsx'
import PhoneInput from './PhoneInput.tsx'
import FileDropzone from './FileDropzone.tsx'
import Button from './Button.tsx'
import { cx } from '../lib/cx.js'

interface ApplicationFormProps {
  title?: string
  role?: any
  onSubmit?: (...args: any[]) => any
  busy?: boolean
  questions?: any[]
  requireCv?: boolean
  submitLabel?: string
  consent?: any
  className?: string
}

// ApplicationForm — apply for a role/place/grant: contact details, CV, cover note, plus any custom questions.
// questions: [{id, label, type:'text'|'textarea'|'select'|'checkbox', options, required, hint}]
export default function ApplicationForm({
  title = 'Apply for this role', role, onSubmit, busy = false, questions = [],
  requireCv = true, submitLabel = 'Submit application', consent, className,
}: ApplicationFormProps) {
  const [v, setV] = useState<Record<string, any>>({ phone: {} })
  const [files, setFiles] = useState<any[]>([])
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }))
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v.email || '').trim())
  const missing = questions.filter((q) => q.required && !v[q.id])
  const ready = v.name && emailOk && (!requireCv || files.length > 0) && !missing.length && (!consent || v.consent)
  return (
    <form className={cx('card-surface p-6', className)}
      onSubmit={(e) => { e.preventDefault(); if (ready && !busy) onSubmit && onSubmit({ ...v, files }) }}>
      <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
      {role && <p className="mt-0.5 text-sm text-ink-500">{role}</p>}
      <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" value={v.name || ''} onChange={(e) => set('name', (e.target as any).value)} autoComplete="name" required />
          <Input label="Email" type="email" value={v.email || ''} onChange={(e) => set('email', (e.target as any).value)} autoComplete="email" required
            error={v.email && !emailOk ? 'Enter a valid email address.' : undefined} />
        </div>
        <PhoneInput value={v.phone} onChange={(p) => set('phone', p)} label="Phone (optional)" />
        {requireCv && <FileDropzone label="CV / résumé" value={files} onChange={setFiles} accept=".pdf,.doc,.docx" max={2} hint="PDF or Word, up to 10 MB" />}
        <Textarea label="Cover note" rows={5} value={v.cover || ''} onChange={(e) => set('cover', (e.target as any).value)}
          placeholder="Why this role, and what you would bring to it." />
        {questions.map((q) => {
          if (q.type === 'textarea') return <Textarea key={q.id} label={q.label} hint={q.hint} rows={3} value={v[q.id] || ''} onChange={(e) => set(q.id, (e.target as any).value)} required={q.required} />
          if (q.type === 'select') return (
            <label key={q.id} className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">{q.label}</span>
              <select value={v[q.id] || ''} onChange={(e) => set(q.id, (e.target as any).value)} required={q.required}
                className="w-full rounded-xl border border-ink-200 bg-surface px-3.5 py-2.5 text-sm text-ink-900 transition-colors hover:border-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40">
                <option value="">Choose…</option>
                {(q.options || []).map((o) => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
              </select>
            </label>
          )
          if (q.type === 'checkbox') return (
            <label key={q.id} className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" checked={!!v[q.id]} onChange={(e) => set(q.id, (e.target as any).checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded accent-brand-600" />
              <span className="text-ink-700">{q.label}</span>
            </label>
          )
          return <Input key={q.id} label={q.label} hint={q.hint} value={v[q.id] || ''} onChange={(e) => set(q.id, (e.target as any).value)} required={q.required} />
        })}
        {consent && (
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" checked={!!v.consent} onChange={(e) => set('consent', (e.target as any).checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded accent-brand-600" />
            <span className="text-ink-600">{consent}</span>
          </label>
        )}
      </div>
      <Button type="submit" disabled={!ready || busy} className="mt-6 w-full justify-center">
        {busy ? 'Sending…' : submitLabel}
      </Button>
    </form>
  )
}
