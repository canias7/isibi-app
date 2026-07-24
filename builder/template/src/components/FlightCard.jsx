import { ArrowRight, Luggage, Plane } from 'lucide-react'
import { cx } from '../lib/cx.js'

// FlightCard — one flight option in a search result. Also fits trains, coaches and ferries: the shape is
// depart → duration/stops → arrive, plus a fare. Stops are called out because they're the main trade-off.
export default function FlightCard({
  airline, logo, flightNumber, depart, arrive, duration, stops = 0, stopDetail,
  price, fareType, baggage, onSelect, selectLabel = 'Select', nextDay, className,
}) {
  return (
    <div className={cx('card-surface flex flex-wrap items-center gap-x-6 gap-y-4 p-5', className)}>
      <div className="flex min-w-0 shrink-0 items-center gap-2.5">
        {logo ? <img src={logo} alt="" className="h-8 w-8 rounded-lg object-contain" />
          : <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100 text-ink-400"><Plane size={15} /></span>}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">{airline}</p>
          {flightNumber && <p className="text-xs text-ink-400">{flightNumber}</p>}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="text-center">
          <p className="font-display text-xl font-bold tabular-nums leading-none text-ink-900">{depart && depart.time}</p>
          <p className="mt-1 text-xs font-medium text-ink-500">{depart && depart.code}</p>
        </div>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-xs tabular-nums text-ink-500">{duration}</p>
          <div className="my-1 flex items-center gap-1">
            <span className="h-px flex-1 bg-ink-200" />
            <ArrowRight size={12} className="shrink-0 text-ink-300" />
            <span className="h-px flex-1 bg-ink-200" />
          </div>
          <p className={cx('text-xs', stops === 0 ? 'font-medium text-emerald-600' : 'text-ink-500')}>
            {stops === 0 ? 'Direct' : `${stops} stop${stops > 1 ? 's' : ''}`}{stopDetail && ` · ${stopDetail}`}
          </p>
        </div>
        <div className="text-center">
          <p className="font-display text-xl font-bold tabular-nums leading-none text-ink-900">
            {arrive && arrive.time}
            {/* +1 matters enough to be visible without reading the dates. */}
            {nextDay && <sup className="ml-0.5 align-super text-xs font-semibold text-rose-500">+1</sup>}
          </p>
          <p className="mt-1 text-xs font-medium text-ink-500">{arrive && arrive.code}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <p className="font-display text-lg font-bold tabular-nums text-ink-900">{price}</p>
          {fareType && <p className="text-xs text-ink-400">{fareType}</p>}
          {baggage && <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-500"><Luggage size={11} />{baggage}</p>}
        </div>
        {onSelect && (
          <button type="button" onClick={onSelect}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-brandfg transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            {selectLabel}
          </button>
        )}
      </div>
    </div>
  )
}
