import { useId } from 'react'
import { Globe } from 'lucide-react'
import { cx } from '../lib/cx.js'

// A short, practical zone list. Pass `zones` to override. IANA names so they survive daylight-saving changes —
// storing "GMT+1" is the classic bug that breaks every October.
export const TIMEZONES = [
  { value: 'Pacific/Auckland', label: 'Auckland' }, { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'Asia/Singapore', label: 'Singapore' }, { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Kolkata', label: 'Mumbai · Kolkata' }, { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Europe/Athens', label: 'Athens' }, { value: 'Europe/Berlin', label: 'Berlin · Paris · Madrid' },
  { value: 'Europe/London', label: 'London · Dublin' }, { value: 'Atlantic/Reykjavik', label: 'Reykjavik (UTC)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo' }, { value: 'America/New_York', label: 'New York · Toronto' },
  { value: 'America/Chicago', label: 'Chicago · Mexico City' }, { value: 'America/Denver', label: 'Denver' },
  { value: 'America/Los_Angeles', label: 'Los Angeles · Vancouver' }, { value: 'Pacific/Honolulu', label: 'Honolulu' },
]

// offsetFor(zone) — the zone's current UTC offset as "+05:30". Computed from the browser rather than
// hardcoded, so it is right on both sides of a daylight-saving switch.
export function offsetFor(zone) {
  try {
    const now = new Date()
    const s = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).format(now)
    const m = s.match(/GMT([+-]\d{1,2}(:\d{2})?)/)
    return m ? `UTC${m[1]}` : ''
  } catch { return '' }
}

// TimezoneSelect — pick a zone, with the current local time shown so the choice is verifiable at a glance.
export default function TimezoneSelect({
  value, onChange, zones = TIMEZONES, label = 'Time zone', hint, detectLabel = 'Use my time zone', className,
}) {
  const id = useId()
  const detected = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return null } })()
  const nowIn = (z) => { try { return new Intl.DateTimeFormat(undefined, { timeZone: z, hour: '2-digit', minute: '2-digit' }).format(new Date()) } catch { return '' } }
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        {label && <label htmlFor={id} className="text-sm font-medium text-ink-700">{label}</label>}
        {detected && detected !== value && onChange && (
          <button type="button" onClick={() => onChange(detected)}
            className="rounded px-1 text-xs font-medium text-brand-600 transition hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            {detectLabel}
          </button>
        )}
      </div>
      <div className="relative">
        <Globe size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <select id={id} value={value || ''} onChange={(e) => onChange && onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-ink-200 bg-surface py-2.5 pl-10 pr-4 text-sm text-ink-900 transition-colors hover:border-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40">
          <option value="">Choose a time zone…</option>
          {zones.map((z) => (
            <option key={z.value} value={z.value}>{z.label} · {offsetFor(z.value)}</option>
          ))}
        </select>
      </div>
      {value && <p className="mt-1.5 text-xs tabular-nums text-ink-500">It is {nowIn(value)} there right now.</p>}
      {hint && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
    </div>
  )
}
