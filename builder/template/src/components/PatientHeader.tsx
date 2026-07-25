import { AlertTriangle } from 'lucide-react'
import Avatar from './Avatar.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface PatientHeaderProps {
  name?: string
  avatar?: string
  recordNumber?: any
  dob?: any
  age?: any
  sex?: any
  phone?: any
  alerts?: any[]
  fields?: any[]
  actions?: ReactNode
  className?: string
}

// PatientHeader — the identity banner at the top of a clinical record: who, DOB, record number, and the
// ALERTS. Allergies and flags render first and loudest; that ordering is the point of the component.
export default function PatientHeader({
  name, avatar, recordNumber, dob, age, sex, phone, alerts = [], fields = [], actions, className,
}: PatientHeaderProps) {
  const facts = [
    recordNumber && { label: 'Record no.', value: recordNumber, mono: true },
    dob && { label: 'Date of birth', value: age ? `${dob} (${age})` : dob },
    sex && { label: 'Sex', value: sex },
    phone && { label: 'Phone', value: phone },
    ...fields,
  ].filter(Boolean)
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      {alerts.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-rose-200 bg-rose-50 px-5 py-2.5">
          <AlertTriangle size={15} className="shrink-0 text-rose-600" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">Alerts</span>
          {alerts.map((a, i) => (
            <span key={i} className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-rose-800 ring-1 ring-inset ring-rose-200">{a}</span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-start gap-4 p-5">
        <Avatar name={name} src={avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink-900">{name}</h2>
          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            {facts.map((f, i) => (
              <div key={i}>
                <dt className="text-xs text-ink-400">{f.label}</dt>
                <dd className={cx('text-sm font-medium text-ink-800', f.mono ? 'font-mono' : 'tabular-nums')}>{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}
