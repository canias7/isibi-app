import { Accessibility, Car, Clock, MapPin, Train } from 'lucide-react'
import MapEmbed from './MapEmbed.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface VenueInfoProps {
  name?: string
  address?: any
  lat?: any
  lon?: any
  hours?: any[]
  transport?: any[]
  parking?: any
  accessibility?: any
  note?: ReactNode
  mapHeight?: number
  className?: string
}

// VenueInfo — "how to find us and what to expect": address, opening hours, transport, parking, access.
// Pairs the map with the practical details so a location page is one component, not six.
export default function VenueInfo({
  name, address, lat, lon, hours = [], transport = [], parking, accessibility, note, mapHeight = 240, className,
}: VenueInfoProps) {
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long' })
  return (
    <div className={cx('grid gap-6 lg:grid-cols-2', className)}>
      <MapEmbed lat={lat} lon={lon} name={name} address={address} height={mapHeight} />
      <div className="space-y-5">
        {address && (
          <div className="flex gap-3">
            <MapPin size={16} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
            <div className="text-sm">
              {name && <p className="font-medium text-ink-900">{name}</p>}
              <p className="text-ink-600">{address}</p>
            </div>
          </div>
        )}
        {hours.length > 0 && (
          <div className="flex gap-3">
            <Clock size={16} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
            <dl className="min-w-0 flex-1 text-sm">
              {hours.map((h, i) => (
                // Today's row is emphasised — it is the only one most visitors are looking for.
                <div key={i} className={cx('flex justify-between gap-4 py-0.5', h.day === today ? 'font-medium text-ink-900' : 'text-ink-600')}>
                  <dt>{h.day}</dt>
                  <dd className={cx('tabular-nums', h.closed && 'text-ink-400')}>{h.closed ? 'Closed' : h.hours}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {transport.length > 0 && (
          <div className="flex gap-3">
            <Train size={16} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
            <ul className="min-w-0 flex-1 space-y-1 text-sm text-ink-600">
              {transport.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}
        {parking && (
          <div className="flex gap-3"><Car size={16} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" /><p className="text-sm text-ink-600">{parking}</p></div>
        )}
        {accessibility && (
          <div className="flex gap-3"><Accessibility size={16} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" /><p className="text-sm text-ink-600">{accessibility}</p></div>
        )}
        {note && <p className="rounded-xl bg-ink-50 p-3.5 text-sm text-ink-600">{note}</p>}
      </div>
    </div>
  )
}
