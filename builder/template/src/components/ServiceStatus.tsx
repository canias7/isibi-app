import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react'
import { cx } from '../lib/cx.js'

const STATES = {
  operational: { label: 'Operational', icon: CheckCircle2, dot: 'bg-emerald-500', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  degraded: { label: 'Degraded', icon: AlertTriangle, dot: 'bg-amber-500', text: 'text-amber-700', bar: 'bg-amber-500' },
  partial: { label: 'Partial outage', icon: AlertTriangle, dot: 'bg-amber-500', text: 'text-amber-700', bar: 'bg-amber-500' },
  down: { label: 'Major outage', icon: XCircle, dot: 'bg-rose-500', text: 'text-rose-700', bar: 'bg-rose-500' },
  maintenance: { label: 'Maintenance', icon: MinusCircle, dot: 'bg-sky-500', text: 'text-sky-700', bar: 'bg-sky-500' },
}

interface ServiceStatusProps {
  services?: any[]
  overall?: any
  title?: string
  updated?: any
  days?: number
  className?: string
}

// ServiceStatus — the status-page board: overall state plus a per-service uptime strip.
// services: [{name, status, uptime, history:['operational','down',…]}]  — history is oldest first, one entry
// per day, drawn as the familiar bar strip.
export default function ServiceStatus({ services = [], overall, title = 'System status', updated, days = 60, className }: ServiceStatusProps) {
  const worst = overall || (services.some((s) => s.status === 'down') ? 'down'
    : services.some((s) => s.status === 'partial' || s.status === 'degraded') ? 'degraded'
    : services.some((s) => s.status === 'maintenance') ? 'maintenance' : 'operational')
  const top = STATES[worst] || STATES.operational
  const TopIcon = top.icon
  return (
    <div className={cx('card-surface overflow-hidden', className)}>
      <div className={cx('flex flex-wrap items-center gap-3 px-5 py-4',
        worst === 'operational' ? 'bg-emerald-50' : worst === 'down' ? 'bg-rose-50' : 'bg-amber-50')}>
        <TopIcon size={20} className={cx('shrink-0', top.text)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className={cx('font-display text-base font-semibold', top.text)}>
            {worst === 'operational' ? 'All systems operational' : top.label}
          </h3>
          {title && <p className="text-xs text-ink-500">{title}</p>}
        </div>
        {updated && <span className="shrink-0 text-xs text-ink-500">Updated {updated}</span>}
      </div>
      <ul className="divide-y divide-ink-100">
        {services.map((s, i) => {
          const st = STATES[s.status] || STATES.operational
          const history = (s.history || []).slice(-days)
          return (
            <li key={i} className="px-5 py-4">
              <div className="flex items-center gap-3">
                <span className={cx('h-2 w-2 shrink-0 rounded-full', st.dot)} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">{s.name}</span>
                {s.uptime != null && <span className="shrink-0 text-xs tabular-nums text-ink-400">{s.uptime}%</span>}
                <span className={cx('shrink-0 text-xs font-medium', st.text)}>{st.label}</span>
              </div>
              {history.length > 0 && (
                <div className="mt-2 flex gap-[2px]" role="img" aria-label={`${s.name} history`}>
                  {history.map((h, j) => (
                    <span key={j} className={cx('h-6 flex-1 rounded-[1px]', (STATES[h] || STATES.operational).bar)} title={h} />
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
