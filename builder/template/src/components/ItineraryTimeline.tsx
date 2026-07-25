import { Bed, Camera, Car, MapPin, Plane, UtensilsCrossed } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

// ItineraryTimeline — a day-by-day trip plan. Timeline is the generic vertical list; this one groups by DAY
// and types each entry, which is what turns a list of bookings into an itinerary you can follow.
// days: [{date, label, items:[{time, title, detail, type, duration, booked}]}]
const ICONS = { flight: Plane, hotel: Bed, food: UtensilsCrossed, activity: Camera, transport: Car, place: MapPin }

interface ItineraryTimelineProps {
  days?: any[]
  title?: ReactNode
  className?: string
}

export default function ItineraryTimeline({ days = [], title, className }: ItineraryTimelineProps) {
  return (
    <div className={className}>
      {title && <h3 className="mb-5 font-display text-lg font-semibold text-ink-900">{title}</h3>}
      <div className="space-y-8">
        {days.map((d, di) => (
          <section key={di}>
            <div className="mb-3 flex items-baseline gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-brandfg">{di + 1}</span>
              <h4 className="font-display text-base font-semibold text-ink-900">{d.label}</h4>
              <span className="text-sm text-ink-400">{d.date}</span>
            </div>
            <ol className="ml-3.5 space-y-0 border-l border-ink-200 pl-6">
              {d.items.map((it, i) => {
                const Icon = ICONS[it.type] || MapPin
                return (
                  <li key={i} className="relative pb-5 last:pb-0">
                    {/* The node sits ON the rail: half its width back, plus the ring so the line doesn't show through. */}
                    <span className="absolute -left-[2.05rem] top-0.5 grid h-6 w-6 place-items-center rounded-full bg-surface ring-4 ring-canvas">
                      <Icon size={13} className="text-brand-500" aria-hidden="true" />
                    </span>
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      {it.time && <span className="text-sm font-medium tabular-nums text-ink-900">{it.time}</span>}
                      <span className="text-sm font-medium text-ink-900">{it.title}</span>
                      {it.duration && <span className="text-xs text-ink-400">{it.duration}</span>}
                      {it.booked && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Booked</span>}
                    </div>
                    {it.detail && <p className="mt-1 text-sm text-ink-600">{it.detail}</p>}
                  </li>
                )
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  )
}
