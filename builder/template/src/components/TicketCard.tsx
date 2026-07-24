import { CalendarDays, MapPin } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface TicketCardProps {
  event?: any
  date?: any
  time?: any
  venue?: any
  seat?: any[]
  holder?: any
  reference?: any
  code?: ReactNode
  tier?: any
  used?: any
  className?: string
}

// TicketCard — the issued ticket/boarding pass: event, seat, holder, reference. Shaped like a physical
// stub — a perforated notch and a torn edge — because that is instantly recognisable as "this is my ticket".
// Pass a `code` node (barcode/QR image from your provider) or let it fall back to the reference in mono.
export default function TicketCard({
  event, date, time, venue, seat = [], holder, reference, code, tier, used, className,
}: TicketCardProps) {
  return (
    <div className={cx('relative flex overflow-hidden rounded-xl2 bg-surface shadow-soft ring-1 ring-ink-100',
      used && 'opacity-60 grayscale', className)}>
      <div className="min-w-0 flex-1 p-5">
        {tier && <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{tier}</p>}
        <h3 className="mt-1 font-display text-lg font-bold tracking-tight text-ink-900">{event}</h3>
        <div className="mt-3 space-y-1.5 text-sm text-ink-600">
          {(date || time) && <p className="flex items-center gap-2"><CalendarDays size={14} className="shrink-0 text-ink-400" />{[date, time].filter(Boolean).join(' · ')}</p>}
          {venue && <p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0 text-ink-400" />{venue}</p>}
        </div>
        {seat.length > 0 && (
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-dashed border-ink-200 pt-3">
            {seat.map((s, i) => (
              <div key={i}>
                <dt className="text-[11px] uppercase tracking-wider text-ink-400">{s.label}</dt>
                <dd className="font-display text-base font-semibold tabular-nums text-ink-900">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {holder && <p className="mt-3 text-xs text-ink-400">Issued to {holder}</p>}
      </div>
      {/* The notch pair is what sells the stub: two half-circles in the page colour, punched out of the seam. */}
      <span className="absolute -top-3 right-[7.5rem] h-6 w-6 rounded-full bg-canvas sm:right-[8.5rem]" aria-hidden="true" />
      <span className="absolute -bottom-3 right-[7.5rem] h-6 w-6 rounded-full bg-canvas sm:right-[8.5rem]" aria-hidden="true" />
      <div className="flex w-30 shrink-0 flex-col items-center justify-center gap-2 border-l border-dashed border-ink-200 bg-ink-50/60 px-4 py-5 sm:w-34">
        {code || (
          <div className="flex h-20 w-16 items-end justify-center gap-[2px]" aria-hidden="true">
            {/* A deterministic bar pattern from the reference — decorative, never a scannable code. */}
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className="w-[3px] bg-ink-800"
                style={{ height: `${40 + ((String(reference || 'x').charCodeAt(i % String(reference || 'x').length) * (i + 3)) % 60)}%` }} />
            ))}
          </div>
        )}
        {reference && <p className="text-center font-mono text-[10px] uppercase tracking-wider text-ink-500">{reference}</p>}
        {used && <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">Used</p>}
      </div>
    </div>
  )
}
