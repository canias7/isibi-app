import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Button from './Button.tsx'
import { cx } from '../lib/cx.js'

interface InviteMembersProps {
  onInvite?: (...args: any[]) => any
  busy?: boolean
  roles?: any[]
  title?: string
  subtitle?: string
  submitLabel?: string
  className?: string
}

// InviteMembers — the "invite your team" block: N email+role rows, add/remove, submit all at once.
// onInvite(rows) receives [{email, role}]. roles: [{value, label, hint}].
export default function InviteMembers({
  onInvite, busy = false, roles = [{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }],
  title = 'Invite your team', subtitle = 'They will get an email with a link to join.', submitLabel = 'Send invites', className,
}: InviteMembersProps) {
  const [rows, setRows] = useState([{ email: '', role: roles[0].value }])
  const set = (i, patch) => setRows((r) => r.map((row, j) => (i === j ? { ...row, ...patch } : row)))
  const valid = rows.filter((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email.trim()))
  const submit = (e) => {
    e.preventDefault()
    if (!valid.length || !onInvite) return
    onInvite(valid.map((r) => ({ email: r.email.trim(), role: r.role })))
    setRows([{ email: '', role: roles[0].value }])
  }
  return (
    <form onSubmit={submit} className={cx('card-surface p-5', className)}>
      <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      <div className="mt-4 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <input type="email" value={row.email} onChange={(e) => set(i, { email: (e.target as any).value })}
              placeholder="name@company.com" aria-label={`Email for invite ${i + 1}`}
              className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-surface px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 transition-colors hover:border-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
            <select value={row.role} onChange={(e) => set(i, { role: (e.target as any).value })} aria-label={`Role for invite ${i + 1}`}
              className="shrink-0 rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-sm text-ink-700 transition-colors hover:border-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40">
              {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button type="button" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} disabled={rows.length === 1}
              aria-label={`Remove invite ${i + 1}`}
              className={cx('shrink-0 rounded-xl px-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                rows.length === 1 ? 'cursor-not-allowed text-ink-200' : 'text-ink-400 hover:bg-ink-100 hover:text-rose-600')}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setRows((r) => [...r, { email: '', role: roles[0].value }])}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-brand-600 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <Plus size={15} />Add another
        </button>
        <Button type="submit" disabled={!valid.length || busy}>
          {busy ? 'Sending…' : `${submitLabel}${valid.length > 1 ? ` (${valid.length})` : ''}`}
        </Button>
      </div>
    </form>
  )
}
