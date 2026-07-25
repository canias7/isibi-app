import { MapPin, ExternalLink } from 'lucide-react'
import { cx } from '../lib/cx.js'

interface MapEmbedProps {
  lat?: any
  lon?: any
  zoom?: number
  address?: any
  name?: string
  height?: number
  marker?: boolean
  className?: string
}

// MapEmbed — a real map for a location page, with no map library and no API key. Uses OpenStreetMap's public
// embed, so restaurants/venues/stores/property listings get a working map instead of a grey placeholder.
// Pass lat/lon (preferred) or a `query` for the "open in maps" link only.
export default function MapEmbed({
  lat, lon, zoom = 15, address, name, height = 320, marker = true, className,
}: MapEmbedProps) {
  const has = typeof lat === 'number' && typeof lon === 'number'
  // A small bbox around the point is what OSM's embed API takes; the delta shrinks as zoom rises.
  const d = Math.max(0.0015, 0.08 / Math.pow(1.7, zoom - 12))
  const bbox = has ? `${lon - d},${lat - d},${lon + d},${lat + d}` : null
  const src = has
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${marker ? `&marker=${lat},${lon}` : ''}`
    : null
  const link = has
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${zoom}/${lat}/${lon}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(address || name || '')}`
  return (
    <div className={cx('overflow-hidden rounded-xl2 border border-ink-200 bg-ink-100', className)}>
      {src ? (
        <iframe title={name ? `Map of ${name}` : 'Map'} src={src} style={{ height }} loading="lazy"
          className="block w-full border-0" />
      ) : (
        <div style={{ height }} className="grid place-items-center text-sm text-ink-400">
          <span className="flex flex-col items-center gap-2"><MapPin size={20} />Add lat/lon to show the map</span>
        </div>
      )}
      {(name || address) && (
        <div className="flex items-start gap-3 border-t border-ink-100 bg-surface px-4 py-3">
          <MapPin size={16} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-sm">
            {name && <p className="font-medium text-ink-900">{name}</p>}
            {address && <p className="text-ink-500">{address}</p>}
          </div>
          <a href={link} target="_blank" rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            Directions <ExternalLink size={12} />
          </a>
        </div>
      )}
    </div>
  )
}
