/**
 * Live-events primitives — ticket sales, seating yield, run of show, staffing,
 * bar spend and egress.
 *
 * The pace against capacity, the revenue each price band actually delivers, the
 * float in a running order, the staff a curve demands, the spend per head by
 * dwell, and the time to clear a venue are all DERIVED. An egress time taken as
 * a prop cannot show which exit is the constraint.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
// Rounds to whole units above £1 and to pence below it. A flat whole-unit
// format printed a £0.10-per-minute figure as "£0" while the sentence beside
// it quoted the £4,034 that same rate produces across an audience.
const money = (v: number) =>
  "£" +
  (Math.abs(v) < 10
    ? Math.abs(v).toFixed(2)
    : Math.round(Math.abs(v)).toLocaleString("en-GB"))

/* ------------------------------------------------------------------ *
 * TicketSales — cumulative sales against capacity and against the point
 * the show breaks even, with the sell-out date extrapolated.
 * ------------------------------------------------------------------ */
export function TicketSales({
  sales,
  capacity,
  breakEvenTickets,
  daysToShow,
  height = 200,
  className = "",
}: {
  /** tickets sold on each day since on-sale */
  sales: number[]
  capacity: number
  breakEvenTickets: number
  daysToShow: number
  height?: number
  className?: string
}) {
  const cumulative = sales.reduce<number[]>((a, v) => [...a, (a[a.length - 1] ?? 0) + v], [])
  const sold = cumulative[cumulative.length - 1] ?? 0
  const recent = sales.slice(-7)
  const rate = recent.reduce((a, v) => a + v, 0) / Math.max(recent.length, 1)
  const daysToSellOut = rate > 0 ? (capacity - sold) / rate : Infinity
  const daysToBreakEven = sold >= breakEvenTickets ? 0 : rate > 0 ? (breakEvenTickets - sold) / rate : Infinity
  const projected = sold + rate * (daysToShow - sales.length)

  const axisDays = Math.max(daysToShow, sales.length)
  const px = (d: number) => (d / axisDays) * 100
  const py = (n: number) => 100 - (n / (capacity * 1.04)) * 100

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(capacity)} x2={100} y2={py(capacity)} stroke="currentColor" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.6} />
          <line x1={0} y1={py(breakEvenTickets)} x2={100} y2={py(breakEvenTickets)} stroke="currentColor" strokeWidth={0.5} strokeDasharray="1 2" opacity={0.55} />
          <polygon points={`0,100 ${cumulative.map((c, i) => `${px(i)},${py(c)}`).join(" ")} ${px(cumulative.length - 1)},100`} fill="currentColor" opacity={0.13} />
          <polyline points={cumulative.map((c, i) => `${px(i)},${py(c)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          <polyline
            points={`${px(sales.length - 1)},${py(sold)} ${px(daysToShow)},${py(Math.min(projected, capacity))}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.1}
            strokeDasharray="3 2"
            opacity={0.65}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="absolute right-1 -translate-y-full bg-background px-1 text-[9px] text-muted-foreground" style={{ top: `${py(capacity)}%` }}>
          capacity {capacity.toLocaleString()}
        </span>
        <span className="absolute right-1 -translate-y-full bg-background px-1 text-[9px] text-muted-foreground" style={{ top: `${py(breakEvenTickets)}%` }}>
          break-even
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>on sale</span>
        <span>show day {daysToShow}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Sold</dt>
          <dd className="font-medium tabular-nums">{sold.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Recent rate</dt>
          <dd className="font-medium tabular-nums">{rate.toFixed(0)}/day</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Break-even</dt>
          <dd className="font-medium tabular-nums">
            {daysToBreakEven === 0 ? "passed" : Number.isFinite(daysToBreakEven) ? `${Math.ceil(daysToBreakEven)} d` : "not at this rate"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Projected</dt>
          <dd className="font-medium tabular-nums">{Math.min(Math.round(projected), capacity).toLocaleString()}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Dashed projection is the last seven days' rate carried forward, not a forecast ·{" "}
        {projected >= capacity
          ? `sells out in about ${Math.ceil(daysToSellOut)} days at this rate, which is ${Math.max(0, daysToShow - sales.length - Math.ceil(daysToSellOut))} days before the show`
          : `lands at ${Math.round(projected).toLocaleString()} of ${capacity.toLocaleString()}, ${(((capacity - projected) / capacity) * 100).toFixed(0)}% short — and ticket sales accelerate in the final fortnight, which this line cannot know`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SeatingYield — revenue per seat by band, so the band that fills first
 * and earns least is visible.
 * ------------------------------------------------------------------ */
export function SeatingYield({
  bands,
  className = "",
}: {
  bands: { name: string; seats: number; sold: number; price: number }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!bands.length) return null

  const rows = bands.map((b) => ({
    ...b,
    fill: b.sold / Math.max(b.seats, 1),
    revenue: b.sold * b.price,
    perSeat: (b.sold * b.price) / Math.max(b.seats, 1),
    lost: (b.seats - b.sold) * b.price,
  }))
  const totalSeats = rows.reduce((a, r) => a + r.seats, 0)
  const totalSold = rows.reduce((a, r) => a + r.sold, 0)
  const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0)
  const totalLost = rows.reduce((a, r) => a + r.lost, 0)
  const maxPerSeat = Math.max(...rows.map((r) => r.price))
  const worstLoss = rows.reduce((a, r) => (r.lost > a.lost ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.sold.toLocaleString()} of {r.seats.toLocaleString()} at {money(r.price)}
              </span>
            </div>
            <div className="relative mt-0.5 h-5 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/20" style={{ width: `${(r.price / maxPerSeat) * 100}%` }} title={`price ${money(r.price)}`} />
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground" style={{ width: `${(r.perSeat / maxPerSeat) * 100}%` }} title={`yield ${money(r.perSeat)} per seat`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.fill * 100).toFixed(0)}% full · {money(r.perSeat)} a seat against a {money(r.price)} price ·{" "}
              {money(r.lost)} unsold
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Fill</dt>
          <dd className="font-medium tabular-nums">{((totalSold / Math.max(totalSeats, 1)) * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Revenue</dt>
          <dd className="font-medium tabular-nums">{money(totalRevenue)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Yield per seat</dt>
          <dd className="font-medium tabular-nums">{money(totalRevenue / Math.max(totalSeats, 1))}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Pale is the face price, solid is the revenue each seat in that band actually delivered — the gap is the empty
        seats · {money(totalLost)} of face value is unsold, {((worstLoss.lost / Math.max(totalLost, 1)) * 100).toFixed(0)}%
        of it in {worstLoss.name}, which is where a discount or a release would earn most
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RunOfShow — the running order with the float against the curfew
 * derived, so an overrun is visible before it happens.
 * ------------------------------------------------------------------ */
export function RunOfShow({
  items,
  doorsMinute,
  curfewMinute,
  className = "",
}: {
  items: { name: string; minutes: number; changeoverMinutes?: number; fixed?: boolean }[]
  doorsMinute: number
  curfewMinute: number
  className?: string
}) {
  let cursor = doorsMinute
  const laid = items.map((it) => {
    const start = cursor
    cursor += it.minutes + (it.changeoverMinutes ?? 0)
    return { ...it, start, end: start + it.minutes, changeoverEnd: cursor }
  })
  const finish = cursor
  const float = curfewMinute - finish
  const flexible = laid.filter((l) => !l.fixed).reduce((a, l) => a + l.minutes, 0)
  const span = Math.max(curfewMinute, finish) - doorsMinute
  const px = (m: number) => ((m - doorsMinute) / Math.max(span, 1)) * 100
  const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`

  return (
    <div className={className}>
      <div className="relative h-9 rounded-[3px] border border-foreground/30 bg-muted">
        {laid.map((l) => (
          <div
            key={l.name}
            className="absolute inset-y-0 flex items-center justify-center overflow-hidden border-r border-background text-[9px] whitespace-nowrap"
            style={{
              left: `${px(l.start)}%`,
              width: `${Math.max(0.6, px(l.end) - px(l.start))}%`,
              background: l.fixed ? "currentColor" : "color-mix(in oklch, currentColor 42%, transparent)",
              color: l.fixed ? "var(--background)" : undefined,
            }}
            title={`${l.name}: ${clock(l.start)}–${clock(l.end)}`}
          >
            {px(l.end) - px(l.start) > 9 ? l.name : ""}
          </div>
        ))}
        {laid
          .filter((l) => (l.changeoverMinutes ?? 0) > 0)
          .map((l) => (
            <div
              key={`${l.name}-co`}
              className="absolute inset-y-0"
              style={{
                left: `${px(l.end)}%`,
                width: `${px(l.changeoverEnd) - px(l.end)}%`,
                background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 5px)",
              }}
              title={`changeover ${l.changeoverMinutes} min`}
            />
          ))}
        <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${px(curfewMinute)}%` }} title="curfew" />
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] tabular-nums text-muted-foreground">
        <span>doors {clock(doorsMinute)}</span>
        <span>curfew {clock(curfewMinute)}</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {laid.map((l) => (
          <li key={`${l.name}-row`} className="flex items-center gap-2">
            <span aria-hidden className="w-3">
              {l.fixed ? "◆" : "·"}
            </span>
            <span className="w-16 shrink-0 text-right text-muted-foreground">{clock(l.start)}</span>
            <span className="flex-1 truncate">{l.name}</span>
            <span className="w-24 shrink-0 text-right text-muted-foreground">
              {l.minutes}′{l.changeoverMinutes ? ` + ${l.changeoverMinutes}′ over` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Solid blocks are fixed times, hatched is changeover · the show finishes at {clock(finish)} against a{" "}
        {clock(curfewMinute)} curfew, so there is{" "}
        {float >= 0 ? `${float} minutes of float` : `${-float} minutes of OVERRUN`} — and only {flexible} minutes of
        the running order can be cut at all
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * StaffingCurve — the staff a demand curve requires, computed from the
 * service rate rather than rostered from a guess.
 * ------------------------------------------------------------------ */
export function StaffingCurve({
  demand,
  servedPerStaffPerHour,
  rostered,
  minutesPerSample = 30,
  height = 200,
  className = "",
}: {
  /** customers arriving in each interval */
  demand: number[]
  servedPerStaffPerHour: number
  /** staff actually on shift in each interval */
  rostered: number[]
  minutesPerSample?: number
  height?: number
  className?: string
}) {
  // NOTHING TO DRAW IS NOT A CHART OF NOTHING. An empty array made every
  // scale here degenerate and wrote NaN into an SVG attribute, which the
  // browser drops — so the chart rendered as a blank box rather than as the
  // empty state the page around it is showing. `useRows` hands back `[]`
  // before the query settles and on every site whose owner has added nothing.
  if (!demand.length || !rostered.length) return null

  const perStaff = (servedPerStaffPerHour * minutesPerSample) / 60
  const required = demand.map((d) => Math.ceil(d / Math.max(perStaff, 1e-9)))
  const gaps = required.map((r, i) => r - (rostered[i] ?? 0))
  const short = gaps.filter((g) => g > 0)
  const surplus = gaps.filter((g) => g < 0)
  const unserved = gaps.reduce((a, g, i) => a + (g > 0 ? Math.min(demand[i], g * perStaff) : 0), 0)
  const max = Math.max(...required, ...rostered) * 1.08

  return (
    <div className={className}>
      <div className="relative flex items-end gap-px" style={{ height }}>
        {required.map((r, i) => (
          <div key={i} className="relative flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              className="w-full"
              style={{
                height: `${(r / max) * 100}%`,
                background: gaps[i] > 0 ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 28%, transparent)",
              }}
              title={`needs ${r}, rostered ${rostered[i] ?? 0}`}
            />
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          <polyline
            points={rostered.map((s, i) => `${((i + 0.5) / rostered.length) * 100},${100 - (s / max) * 100}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0:00</span>
        <span>{((demand.length * minutesPerSample) / 60).toFixed(1)} h</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Peak need</dt>
          <dd className="font-medium tabular-nums">{Math.max(...required)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Short intervals</dt>
          <dd className="font-medium tabular-nums">{short.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Not served</dt>
          <dd className="font-medium tabular-nums">{Math.round(unserved).toLocaleString()}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Bars are the staff each interval NEEDS at {servedPerStaffPerHour} served an hour, the line is who is rostered ·{" "}
        {short.length
          ? `${short.length} intervals are short and about ${Math.round(unserved).toLocaleString()} customers go unserved, while ${surplus.length} intervals carry spare staff — the total headcount can be right and the shape still wrong`
          : "the roster covers every interval"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * BarSpend — spend per head against dwell time, with the revenue each
 * extra minute is worth derived by regression.
 * ------------------------------------------------------------------ */
export function BarSpend({
  observations,
  attendance,
  height = 200,
  className = "",
}: {
  observations: { dwellMinutes: number; spend: number }[]
  attendance: number
  height?: number
  className?: string
}) {
  // NOTHING TO DRAW IS NOT A CHART OF NOTHING. An empty array made every
  // scale here degenerate and wrote NaN into an SVG attribute, which the
  // browser drops — so the chart rendered as a blank box rather than as the
  // empty state the page around it is showing. `useRows` hands back `[]`
  // before the query settles and on every site whose owner has added nothing.
  if (!observations.length) return null

  const n = observations.length || 1
  const mx = observations.reduce((a, o) => a + o.dwellMinutes, 0) / n
  const my = observations.reduce((a, o) => a + o.spend, 0) / n
  const num = observations.reduce((a, o) => a + (o.dwellMinutes - mx) * (o.spend - my), 0)
  const den = observations.reduce((a, o) => a + (o.dwellMinutes - mx) ** 2, 0)
  const perMinute = den === 0 ? 0 : num / den
  const intercept = my - perMinute * mx
  const maxD = Math.max(...observations.map((o) => o.dwellMinutes))
  const maxS = Math.max(...observations.map((o) => o.spend))
  const extraTen = perMinute * 10 * attendance

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line
            x1={0}
            y1={100 - (intercept / (maxS * 1.06)) * 100}
            x2={100}
            y2={100 - ((intercept + perMinute * maxD) / (maxS * 1.06)) * 100}
            stroke="currentColor"
            strokeWidth={0.7}
            opacity={0.75}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0">
          {observations.map((o, i) => (
            <span
              key={i}
              className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/70"
              style={{ left: `${(o.dwellMinutes / (maxD * 1.04)) * 100}%`, top: `${100 - (o.spend / (maxS * 1.06)) * 100}%` }}
              title={`${o.dwellMinutes} min, ${money(o.spend)}`}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 min in the venue</span>
        <span>{maxD} min</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Base spend</dt>
          <dd className="font-medium tabular-nums">{money(intercept)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Per extra minute</dt>
          <dd className="font-medium tabular-nums">{money(perMinute)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mean per head</dt>
          <dd className="font-medium tabular-nums">{money(my)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Every extra minute in the venue is worth {money(perMinute)} a head, so opening doors ten minutes earlier is
        worth about {money(extraTen)} across {attendance.toLocaleString()} people — which is the argument for a support
        act, and the reason a late doors call costs more than the staff it saves
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * EgressFlow — the time to clear the venue, with the binding exit
 * FOUND rather than named, since a total capacity figure hides it.
 * ------------------------------------------------------------------ */
export function EgressFlow({
  exits,
  attendance,
  targetMinutes,
  className = "",
}: {
  /** each exit's width and the share of the crowd that will use it */
  exits: { name: string; widthMm: number; crowdShare: number }[]
  attendance: number
  targetMinutes: number
  className?: string
}) {
  // the conventional flow rate: 80 persons per minute per 550 mm unit of width
  const UNIT = 550
  const RATE = 80
  const rows = exits
    .map((e) => {
      const units = e.widthMm / UNIT
      const capacityPerMin = units * RATE
      const people = attendance * e.crowdShare
      return { ...e, units, capacityPerMin, people, minutes: people / Math.max(capacityPerMin, 1e-9) }
    })
    .sort((a, b) => b.minutes - a.minutes)
  const clearTime = rows[0]?.minutes ?? 0
  const totalCapacity = rows.reduce((a, r) => a + r.capacityPerMin, 0)
  const idealMinutes = attendance / Math.max(totalCapacity, 1e-9)
  const max = Math.max(targetMinutes * 1.25, ...rows.map((r) => r.minutes))

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.widthMm} mm · {r.units.toFixed(1)} units · {(r.crowdShare * 100).toFixed(0)}% of the crowd
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(r.minutes / max) * 100}%`,
                  background: r.minutes > targetMinutes ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 48%, transparent)",
                  outline: r.minutes > targetMinutes ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${(targetMinutes / max) * 100}%` }} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {Math.round(r.people).toLocaleString()} people at {r.capacityPerMin.toFixed(0)}/min ·{" "}
              {r.minutes.toFixed(1)} min
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Clear time</dt>
          <dd className="font-medium tabular-nums">{clearTime.toFixed(1)} min</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Target</dt>
          <dd className="font-medium tabular-nums">{targetMinutes} min</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">If evenly split</dt>
          <dd className="font-medium tabular-nums">{idealMinutes.toFixed(1)} min</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        The venue clears when the LAST exit clears, so {rows[0]?.name} at {clearTime.toFixed(1)} minutes sets the time
        whatever the others do · the summed capacity would give {idealMinutes.toFixed(1)} minutes if the crowd
        distributed itself evenly, and it never does —{" "}
        {clearTime > targetMinutes
          ? `${(clearTime - targetMinutes).toFixed(1)} minutes over target, which is a signage and stewarding problem before it is a door problem`
          : "inside the target on the stated split"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * WeatherContingency — the revenue at risk from an outdoor date, with
 * the expected loss and the fair price of cover DERIVED from the
 * historical rainfall record rather than assumed.
 * ------------------------------------------------------------------ */
export function WeatherContingency({
  history,
  attendance,
  spendPerHead,
  refundThresholdMm,
  premium,
  className = "",
}: {
  /** rainfall on the same calendar date in each past year */
  history: { year: number; rainfallMm: number }[]
  attendance: number
  spendPerHead: number
  /** rainfall at which the show is abandoned and tickets refunded */
  refundThresholdMm: number
  /** what the insurer is asking */
  premium?: number
  className?: string
}) {
  // NOTHING TO DRAW IS NOT A CHART OF NOTHING. An empty array made every
  // scale here degenerate and wrote NaN into an SVG attribute, which the
  // browser drops — so the chart rendered as a blank box rather than as the
  // empty state the page around it is showing. `useRows` hands back `[]`
  // before the query settles and on every site whose owner has added nothing.
  if (!history.length) return null

  const sorted = [...history].sort((a, b) => a.rainfallMm - b.rainfallMm)
  const exceed = sorted.filter((h) => h.rainfallMm >= refundThresholdMm)
  const probability = exceed.length / Math.max(sorted.length, 1)
  const exposure = attendance * spendPerHead
  const expectedLoss = probability * exposure
  const fairOdds = probability > 0 ? 1 / probability : Infinity
  const max = Math.max(refundThresholdMm * 1.3, ...sorted.map((h) => h.rainfallMm))

  return (
    <div className={className}>
      <div className="relative flex items-end gap-px" style={{ height: 130 }}>
        {[...history]
          .sort((a, b) => a.year - b.year)
          .map((h) => (
            <div key={h.year} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <div
                className="w-full rounded-t-[1px]"
                style={{
                  height: `${(h.rainfallMm / max) * 100}%`,
                  background: h.rainfallMm >= refundThresholdMm ? "currentColor" : "color-mix(in oklch, currentColor 30%, transparent)",
                }}
                title={`${h.year}: ${h.rainfallMm} mm`}
              />
            </div>
          ))}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground" style={{ bottom: `${(refundThresholdMm / max) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{Math.min(...history.map((h) => h.year))}</span>
        <span>{Math.max(...history.map((h) => h.year))}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Exposure</dt>
          <dd className="font-medium tabular-nums">{money(exposure)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Probability</dt>
          <dd className="font-medium tabular-nums">{(probability * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Expected loss</dt>
          <dd className="font-medium tabular-nums">{money(expectedLoss)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{premium === undefined ? "Fair odds" : "Loading"}</dt>
          <dd className="font-medium tabular-nums">
            {premium === undefined
              ? Number.isFinite(fairOdds)
                ? `${fairOdds.toFixed(0)}:1`
                : "—"
              : `${((premium / Math.max(expectedLoss, 1e-9) - 1) * 100).toFixed(0)}%`}
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {exceed.length} of {sorted.length} years exceeded {refundThresholdMm} mm on this date, which is the whole basis
        of the probability — a shorter record would give a different answer and no more certainty ·{" "}
        {premium === undefined
          ? `the expected loss is ${money(expectedLoss)}, and any premium above that is what the insurer charges for taking the variance`
          : premium > expectedLoss
            ? `the ${money(premium)} premium is ${((premium / Math.max(expectedLoss, 1e-9) - 1) * 100).toFixed(0)}% above the expected loss, which is the price of not having to survive the bad year`
            : `the ${money(premium)} premium is BELOW the expected loss, which is worth taking and worth checking twice`}
      </p>
    </div>
  )
}
