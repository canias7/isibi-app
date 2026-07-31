/**
 * Hotel revenue-management primitives — RevPAR, booking pace, lead time,
 * channel mix, length of stay and the displacement a group booking causes.
 *
 * RevPAR from occupancy and rate, the pace gap against the same point last
 * year, the net rate after commission, and the revenue a group displaces are
 * all DERIVED. A RevPAR passed as a prop cannot show that the rate rise bought
 * less than the occupancy it cost.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) => "$" + Math.round(Math.abs(v)).toLocaleString("en-US")

/* ------------------------------------------------------------------ *
 * RevparBridge — the move in RevPAR split into its rate half and its
 * occupancy half, because a headline RevPAR hides which one moved.
 * ------------------------------------------------------------------ */
export function RevparBridge({
  from,
  to,
  rooms,
  className = "",
}: {
  from: { label: string; occupancy: number; adr: number }
  to: { label: string; occupancy: number; adr: number }
  rooms: number
  className?: string
}) {
  const revparFrom = from.occupancy * from.adr
  const revparTo = to.occupancy * to.adr
  // occupancy effect at the old rate, rate effect at the new occupancy
  const occEffect = (to.occupancy - from.occupancy) * from.adr
  const rateEffect = (to.adr - from.adr) * to.occupancy
  const steps = [
    { name: `${from.label} RevPAR`, value: revparFrom, base: true },
    { name: "Occupancy", value: occEffect, base: false },
    { name: "Rate", value: rateEffect, base: false },
    { name: `${to.label} RevPAR`, value: revparTo, base: true },
  ]
  const max = Math.max(revparFrom, revparTo) * 1.15
  let running = 0

  return (
    <div className={className}>
      <div className="space-y-1.5">
        {steps.map((s) => {
          const start = s.base ? 0 : running
          const end = s.base ? s.value : running + s.value
          if (!s.base) running = end
          else running = s.value
          const lo = Math.min(start, end)
          const hi = Math.max(start, end)
          return (
            <div key={s.name} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-[11px]">{s.name}</span>
              <div className="relative h-5 flex-1 rounded-[2px] bg-muted">
                <div
                  className="absolute inset-y-0 rounded-[2px]"
                  style={{
                    left: `${(lo / max) * 100}%`,
                    width: `${Math.max(0.8, ((hi - lo) / max) * 100)}%`,
                    background: s.base
                      ? "color-mix(in oklch, currentColor 55%, transparent)"
                      : s.value >= 0
                        ? "currentColor"
                        : "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                    outline: !s.base && s.value < 0 ? "1px solid currentColor" : undefined,
                    outlineOffset: -1,
                  }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-[11px] tabular-nums">
                {s.base ? "" : s.value >= 0 ? "+" : "−"}
                {money(s.value)}
              </span>
            </div>
          )
        })}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Occupancy</dt>
          <dd className="font-medium tabular-nums">
            {(from.occupancy * 100).toFixed(0)}% → {(to.occupancy * 100).toFixed(0)}%
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">ADR</dt>
          <dd className="font-medium tabular-nums">
            {money(from.adr)} → {money(to.adr)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Room revenue</dt>
          <dd className="font-medium tabular-nums">{money((revparTo - revparFrom) * rooms)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        RevPAR moved {money(revparTo - revparFrom)} ·{" "}
        {Math.abs(rateEffect) > Math.abs(occEffect)
          ? `the rate did ${money(rateEffect)} of it and occupancy ${money(occEffect)} — a rate-led move, which costs nothing extra to serve`
          : `occupancy did ${money(occEffect)} of it and rate ${money(rateEffect)} — an occupancy-led move, and every extra room costs something to clean`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * BookingPace — rooms on the books at each point before arrival,
 * against the same point last year. The gap is derived at every step,
 * not just at the end.
 * ------------------------------------------------------------------ */
export function BookingPace({
  thisYear,
  lastYear,
  capacity,
  height = 200,
  className = "",
}: {
  /** rooms on the books, indexed by days before arrival, furthest out first */
  thisYear: { daysOut: number; rooms: number }[]
  lastYear: { daysOut: number; rooms: number }[]
  capacity: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!thisYear.length || !lastYear.length) return null

  const ty = [...thisYear].sort((a, b) => b.daysOut - a.daysOut)
  const ly = [...lastYear].sort((a, b) => b.daysOut - a.daysOut)
  const lyAt = (d: number) => ly.reduce((a, p) => (Math.abs(p.daysOut - d) < Math.abs(a.daysOut - d) ? p : a), ly[0])?.rooms ?? 0
  const rows = ty.map((p) => ({ ...p, ly: lyAt(p.daysOut), gap: p.rooms - lyAt(p.daysOut) }))
  const maxOut = Math.max(...ty.map((p) => p.daysOut))
  const px = (d: number) => ((maxOut - d) / Math.max(maxOut, 1)) * 100
  const py = (r: number) => 100 - (r / capacity) * 96 - 2
  const now = rows[rows.length - 1]
  const widest = rows.reduce((a, r) => (Math.abs(r.gap) > Math.abs(a.gap) ? r : a), rows[0])

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(capacity)} x2={100} y2={py(capacity)} stroke="currentColor" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.5} />
          <polygon
            points={`${rows.map((r) => `${px(r.daysOut)},${py(r.rooms)}`).join(" ")} ${rows
              .slice()
              .reverse()
              .map((r) => `${px(r.daysOut)},${py(r.ly)}`)
              .join(" ")}`}
            fill="currentColor"
            opacity={0.12}
          />
          <polyline points={rows.map((r) => `${px(r.daysOut)},${py(r.ly)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.1} strokeDasharray="4 2" opacity={0.7} vectorEffect="non-scaling-stroke" />
          <polyline points={rows.map((r) => `${px(r.daysOut)},${py(r.rooms)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute right-1 -translate-y-full bg-background px-1 text-[9px] text-muted-foreground" style={{ top: `${py(capacity)}%` }}>
          {capacity} rooms
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{maxOut} days out</span>
        <span>arrival</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">On the books</dt>
          <dd className="font-medium tabular-nums">
            {now.rooms} of {capacity}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Same time last year</dt>
          <dd className="font-medium tabular-nums">{now.ly}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Pace</dt>
          <dd className="font-medium tabular-nums">
            {now.gap >= 0 ? "+" : "−"}
            {Math.abs(now.gap)}
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Dashed is last year at the same days-out, which is the only fair comparison — a booking curve read against a
        calendar date compares a half-sold week to a sold-out one · the gap was widest at {widest.daysOut} days out
        ({widest.gap >= 0 ? "+" : "−"}
        {Math.abs(widest.gap)}), which is when the decision to discount had to be made
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * BookingWindow — the lead-time distribution, with the median and the
 * share still to come derived.
 * ------------------------------------------------------------------ */
export function BookingWindow({
  buckets,
  daysToArrival,
  height = 190,
  className = "",
}: {
  /** bookings taken at each lead time band */
  buckets: { fromDays: number; toDays: number; bookings: number }[]
  /** how far out we are now */
  daysToArrival: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!buckets.length) return null

  const sorted = [...buckets].sort((a, b) => b.fromDays - a.fromDays)
  const total = sorted.reduce((a, b) => a + b.bookings, 0)
  let run = 0
  const rows = sorted.map((b) => {
    run += b.bookings
    return { ...b, cumulative: run, mid: (b.fromDays + b.toDays) / 2 }
  })
  const medianBucket = rows.find((r) => r.cumulative >= total / 2) ?? rows[rows.length - 1]
  // everything in a band closer than today has not been booked yet
  const stillToCome = sorted.filter((b) => b.toDays <= daysToArrival).reduce((a, b) => a + b.bookings, 0)
  const max = Math.max(...sorted.map((b) => b.bookings))

  return (
    <div className={className}>
      <div className="relative flex items-end gap-1" style={{ height }}>
        {rows.map((r) => (
          <div key={`${r.fromDays}-${r.toDays}`} className="flex h-full flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t-[2px]"
              style={{
                height: `${(r.bookings / max) * 100}%`,
                background: r.toDays <= daysToArrival ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 50%, transparent)",
                outline: r.toDays <= daysToArrival ? "1px solid currentColor" : undefined,
                outlineOffset: -1,
              }}
              title={`${r.fromDays}–${r.toDays} days out: ${r.bookings}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {rows.map((r) => (
          <span key={`${r.fromDays}-lbl`} className="flex-1 truncate text-center text-[9px] text-muted-foreground">
            {r.fromDays}–{r.toDays}
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Median lead</dt>
          <dd className="font-medium tabular-nums">{medianBucket.mid.toFixed(0)} d</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Today</dt>
          <dd className="font-medium tabular-nums">{daysToArrival} d out</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Still to come</dt>
          <dd className="font-medium tabular-nums">{((stillToCome / Math.max(total, 1)) * 100).toFixed(0)}%</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Hatched bands are closer in than today, so they have not happened yet ·{" "}
        {((stillToCome / Math.max(total, 1)) * 100).toFixed(0)}% of a normal week's bookings still arrive after this
        point, which is exactly the number a discount decision at {daysToArrival} days out is gambling
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ChannelMix — volume by channel against the NET rate after commission,
 * so the channel that sells most and earns least is visible.
 * ------------------------------------------------------------------ */
export function ChannelMix({
  channels,
  className = "",
}: {
  channels: { name: string; roomNights: number; adr: number; commission: number; costPerBooking?: number }[]
  className?: string
}) {
  const rows = channels
    .map((c) => {
      const net = c.adr * (1 - c.commission) - (c.costPerBooking ?? 0)
      return { ...c, net, revenue: c.adr * c.roomNights, netRevenue: net * c.roomNights }
    })
    .sort((a, b) => b.netRevenue - a.netRevenue)
  const totalNights = rows.reduce((a, r) => a + r.roomNights, 0)
  const totalGross = rows.reduce((a, r) => a + r.revenue, 0)
  const totalNet = rows.reduce((a, r) => a + r.netRevenue, 0)
  const byVolume = [...rows].sort((a, b) => b.roomNights - a.roomNights)
  const flipped = byVolume[0]?.name !== rows[0]?.name
  const maxAdr = Math.max(...rows.map((r) => r.adr))

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.roomNights.toLocaleString()} nights · {((r.roomNights / Math.max(totalNights, 1)) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/22" style={{ width: `${(r.adr / maxAdr) * 100}%` }} />
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground" style={{ width: `${(r.net / maxAdr) * 100}%` }} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.adr)} gross → {money(r.net)} net after {(r.commission * 100).toFixed(0)}% commission
              {r.costPerBooking ? ` and ${money(r.costPerBooking)} of cost` : ""} · {money(r.netRevenue)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is the rate the guest paid, solid is what the hotel keeps · {money(totalGross - totalNet)} of{" "}
        {money(totalGross)} goes to distribution, which is {(((totalGross - totalNet) / Math.max(totalGross, 1)) * 100).toFixed(0)}% ·{" "}
        {flipped
          ? `${byVolume[0]?.name} sells the most nights and ${rows[0]?.name} earns the most, which is the whole argument for shifting the mix`
          : `${rows[0]?.name} leads on both volume and net revenue`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * LengthOfStay — the arrival-by-nights grid, with the pattern that
 * blocks a high-rate night made visible.
 * ------------------------------------------------------------------ */
export function LengthOfStay({
  arrivals,
  nights,
  counts,
  peakNights = [],
  className = "",
}: {
  arrivals: string[]
  /** stay lengths, in nights */
  nights: number[]
  /** counts[arrival][nights] */
  counts: number[][]
  /** the nights the hotel most wants to sell */
  peakNights?: string[]
  className?: string
}) {
  const max = Math.max(1, ...counts.flat())
  const total = counts.flat().reduce((a, v) => a + v, 0)
  // which arrival/length combinations occupy a peak night
  const occupiesPeak = (ai: number, ni: number) =>
    peakNights.some((p) => {
      const pIdx = arrivals.indexOf(p)
      return pIdx >= ai && pIdx < ai + nights[ni]
    })
  const peakBlocked = counts.reduce((a, row, ai) => a + row.reduce((b, v, ni) => b + (occupiesPeak(ai, ni) ? v : 0), 0), 0)
  const meanLos = counts.reduce((a, row, _ai) => a + row.reduce((b, v, ni) => b + v * nights[ni], 0), 0) / Math.max(total, 1)

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="pr-1.5 pb-1 text-left font-normal text-muted-foreground">arrival \ nights</th>
              {nights.map((n) => (
                <th key={n} className="px-0.5 pb-1 font-medium">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {arrivals.map((a, ai) => (
              <tr key={a}>
                <th className="pr-1.5 text-left font-medium whitespace-nowrap">{a}</th>
                {nights.map((n, ni) => {
                  const v = counts[ai]?.[ni] ?? 0
                  const peak = occupiesPeak(ai, ni)
                  return (
                    <td key={n} className="p-px">
                      <div
                        className="flex h-6 items-center justify-center rounded-[2px]"
                        style={{
                          background: `color-mix(in oklch, currentColor ${((v / max) * 74).toFixed(0)}%, transparent)`,
                          outline: peak && v > 0 ? "1.5px solid currentColor" : undefined,
                          outlineOffset: -1.5,
                        }}
                        title={`${a}, ${n} night${n === 1 ? "" : "s"}: ${v}${peak ? " — occupies a peak night" : ""}`}
                      >
                        <span style={{ color: v / max > 0.55 ? "var(--background)" : undefined }}>{v || ""}</span>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Mean stay {meanLos.toFixed(2)} nights ·{" "}
        {peakNights.length
          ? `outlined cells occupy ${peakNights.join(" or ")} — ${peakBlocked} of ${total} stays (${((peakBlocked / Math.max(total, 1)) * 100).toFixed(0)}%), and a minimum-stay rule aimed at those arrivals turns away every one of them`
          : "no peak nights named"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * GroupDisplacement — what a group booking earns against what it turns
 * away. The displaced transient revenue is COMPUTED from the forecast.
 * ------------------------------------------------------------------ */
export function GroupDisplacement({
  nights,
  groupRooms,
  groupRate,
  ancillaryPerRoom = 0,
  className = "",
}: {
  /** the transient forecast for each night, before the group */
  nights: { label: string; capacity: number; forecastRooms: number; forecastAdr: number }[]
  groupRooms: number
  groupRate: number
  /** food, beverage and meeting spend the group brings per room */
  ancillaryPerRoom?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!nights.length) return null

  const rows = nights.map((n) => {
    const free = Math.max(0, n.capacity - n.forecastRooms)
    const displaced = Math.max(0, groupRooms - free)
    return {
      ...n,
      free,
      displaced,
      groupRevenue: groupRooms * (groupRate + ancillaryPerRoom),
      displacedRevenue: displaced * n.forecastAdr,
    }
  })
  const totalGroup = rows.reduce((a, r) => a + r.groupRevenue, 0)
  const totalDisplaced = rows.reduce((a, r) => a + r.displacedRevenue, 0)
  const net = totalGroup - totalDisplaced
  const worst = rows.reduce((a, r) => (r.displacedRevenue > a.displacedRevenue ? r : a), rows[0])
  const max = Math.max(...rows.map((r) => r.capacity))

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span>{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.forecastRooms} forecast of {r.capacity} · {money(r.forecastAdr)} ADR
              </span>
            </div>
            <div className="relative mt-0.5 h-5 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-l-[2px] bg-foreground/25" style={{ width: `${(r.forecastRooms / max) * 100}%` }} />
              <div
                className="absolute inset-y-0"
                style={{
                  // clamped: without it the block starts past the track and the
                  // bar runs out of the card on a night that is nearly full
                  left: `${(clamp(Math.min(r.forecastRooms, r.capacity - groupRooms + r.displaced), 0, max) / max) * 100}%`,
                  width: `${(clamp(groupRooms, 0, max) / max) * 100}%`,
                  maxWidth: `${(1 - clamp(Math.min(r.forecastRooms, r.capacity - groupRooms + r.displaced), 0, max) / max) * 100}%`,
                  background: "color-mix(in oklch, currentColor 60%, transparent)",
                }}
              />
              {r.displaced > 0 && (
                <div
                  className="absolute inset-y-0 border border-foreground"
                  style={{
                    left: `${((r.capacity - r.displaced) / max) * 100}%`,
                    width: `${(r.displaced / max) * 100}%`,
                    background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  }}
                />
              )}
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(r.capacity / max) * 100}%` }} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.displaced > 0
                ? `${r.displaced} transient rooms displaced, worth ${money(r.displacedRevenue)}`
                : `${r.free} rooms free — the group displaces nobody`}
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Group brings</dt>
          <dd className="font-medium tabular-nums">{money(totalGroup)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Displaces</dt>
          <dd className="font-medium tabular-nums">{money(totalDisplaced)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Net</dt>
          <dd className="font-medium tabular-nums">{net >= 0 ? money(net) : `−${money(net)}`}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Hatched is transient business turned away · the group is worth {money(net)} net{" "}
        {ancillaryPerRoom > 0 ? `once ${money(ancillaryPerRoom)} a room of ancillary spend is counted ` : ""}—{" "}
        {worst.displacedRevenue > 0
          ? `${worst.label} does the damage, and a rate that clears the other nights still loses money on that one`
          : "and it displaces nothing on any night"}
      </p>
    </div>
  )
}
