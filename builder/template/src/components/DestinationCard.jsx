import { Link } from 'react-router-dom'
import { Plane, Sun, Thermometer } from 'lucide-react'
import { cx } from '../lib/cx.js'

// DestinationCard — an inspiration tile for a place: city, region, resort, park. Full-bleed image with the
// copy laid over it, because for destinations the photo IS the pitch.
export default function DestinationCard({
  name, country, image, alt, to, fromPrice, flightTime, temperature, season, tall = false, className,
}) {
  return (
    <Link to={to}
      className={cx('group relative block overflow-hidden rounded-xl2 bg-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        tall ? 'aspect-[3/4]' : 'aspect-[4/3]', className)}>
      {image && <img src={image} alt={alt || name} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
      {/* The scrim is what keeps white text legible over an unpredictable photo. */}
      <span className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/25 to-transparent" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-canvas">
        {country && <p className="text-xs font-medium uppercase tracking-wider opacity-70">{country}</p>}
        <h3 className="mt-0.5 font-display text-xl font-bold tracking-tight">{name}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs opacity-90">
          {flightTime && <span className="inline-flex items-center gap-1"><Plane size={12} />{flightTime}</span>}
          {temperature && <span className="inline-flex items-center gap-1"><Thermometer size={12} />{temperature}</span>}
          {season && <span className="inline-flex items-center gap-1"><Sun size={12} />{season}</span>}
        </div>
        {fromPrice && (
          <p className="mt-3 text-sm">
            <span className="opacity-70">from </span>
            <span className="font-display text-base font-semibold">{fromPrice}</span>
          </p>
        )}
      </div>
    </Link>
  )
}
