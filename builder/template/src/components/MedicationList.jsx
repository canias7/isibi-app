import { Pill } from 'lucide-react'
import StatusPill from './StatusPill.jsx'
import { cx } from '../lib/cx.js'

// MedicationList — an active prescription/repeat list. Also fits supplements, feed schedules, dosing plans.
// meds: [{name, strength, form, dose, frequency, prescriber, started, status, note}]
export default function MedicationList({ meds = [], title = 'Medications', actions, emptyText = 'No medications recorded.', className }) {
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>
        {actions}
      </div>
      {meds.length === 0
        ? <p className="px-5 py-10 text-center text-sm text-ink-400">{emptyText}</p>
        : (
          <ul className="divide-y divide-ink-100">
            {meds.map((m, i) => (
              <li key={i} className="flex gap-3 px-5 py-4">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                  <Pill size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="font-medium text-ink-900">{m.name}</p>
                    {m.strength && <span className="text-sm tabular-nums text-ink-600">{m.strength}</span>}
                    {m.form && <span className="text-xs text-ink-400">{m.form}</span>}
                  </div>
                  {/* Dose and frequency are the instruction — they go on their own line and stay legible. */}
                  {(m.dose || m.frequency) && (
                    <p className="mt-0.5 text-sm text-ink-700">{[m.dose, m.frequency].filter(Boolean).join(' · ')}</p>
                  )}
                  <p className="mt-1 text-xs text-ink-400">
                    {[m.prescriber && `Prescribed by ${m.prescriber}`, m.started && `Started ${m.started}`].filter(Boolean).join(' · ')}
                  </p>
                  {m.note && <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">{m.note}</p>}
                </div>
                {m.status && <StatusPill status={m.status} className="shrink-0" />}
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}
