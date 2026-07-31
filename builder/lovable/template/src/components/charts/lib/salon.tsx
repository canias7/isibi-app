/**
 * Hair and beauty salon primitives — chair hours, the service mix, rebooking,
 * retail attach, a stylist's actual day, what a no-show costs and colour stock.
 *
 * What a chair earns against what it costs, which service fills the day versus
 * which one pays for it, what a rebooked client is worth, the margin retail
 * adds per chair-hour, where a column actually goes, whether a deposit would
 * have caught a no-show and which shade runs out first are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
const money = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e5 ? `£${(a / 1e3).toFixed(0)}k` : a >= 1e4 ? `£${(a / 1e3).toFixed(1)}k` : a < 10 ? `£${a.toFixed(2)}` : `£${Math.round(a).toLocaleString("en-GB")}`
  return v < 0 ? `−${s}` : s
}
const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`

/* ------------------------------------------------------------------ *
 * StationHours — every chair against the hours it was open, with the
 * RENT BREAK-EVEN derived. A rented chair and an employed stylist are
 * different businesses sharing a room, and a single occupancy figure
 * hides which of the two the salon is actually running.
 * ------------------------------------------------------------------ */
export function StationHours({
  chairs,
  openHoursPerWeek,
  employedCostPerHour,
  className = "",
}: {
  chairs: {
    name: string
    /** hours actually booked and paid for */
    bookedHours: number
    /** takings through this chair */
    takings: number
    /** self-employed chairs pay rent instead of drawing a wage */
    rentPerWeek?: number
  }[]
  openHoursPerWeek: number
  /** wage plus on-costs for an employed stylist */
  employedCostPerHour: number
  className?: string
}) {
  const rows = chairs
    .map((c) => {
      const rented = c.rentPerWeek !== undefined
      const occupancy = c.bookedHours / Math.max(openHoursPerWeek, 1e-9)
      // an employed chair contributes takings less the wage for every hour it
      // was open, not just the hours it was busy — that is the whole risk
      const employedCost = rented ? 0 : openHoursPerWeek * employedCostPerHour
      const contribution = rented ? (c.rentPerWeek ?? 0) : c.takings - employedCost
      return {
        ...c,
        rented,
        occupancy,
        employedCost,
        contribution,
        perOpenHour: c.takings / Math.max(openHoursPerWeek, 1e-9),
        perBookedHour: c.bookedHours > 0 ? c.takings / c.bookedHours : null,
      }
    })
    .sort((a, b) => b.contribution - a.contribution)
  const maxTakings = Math.max(...rows.map((r) => r.takings), 1)
  const rentRows = rows.filter((r) => r.rented)
  // what a rented chair must bill for employing that stylist to have been the
  // better deal — the number the conversation about "going self-employed" is
  // really about and which nobody works out
  const meanRent = rentRows.length ? rentRows.reduce((a, r) => a + (r.rentPerWeek ?? 0), 0) / rentRows.length : 0
  const breakEven = meanRent + openHoursPerWeek * employedCostPerHour
  const beaters = rows.filter((r) => !r.rented && r.takings > breakEven)
  const meanOcc = rows.reduce((a, r) => a + r.occupancy, 0) / Math.max(rows.length, 1)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">
                <span aria-hidden className="mr-1 inline-block w-3 text-muted-foreground">
                  {r.rented ? "▢" : "▣"}
                </span>
                {r.name}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {r.bookedHours.toFixed(0)} of {openHoursPerWeek} h · {(r.occupancy * 100).toFixed(0)}% ·{" "}
                {r.rented ? "rented" : "employed"}
              </span>
            </div>
            {/* takings and cost as two LANES, not one over the other: the
                employed cost is identical on every chair, so drawn on top it
                covers the very number that distinguishes them — and on a chair
                that loses money it is the WIDER of the two */}
            <div className="relative mt-0.5 h-5 rounded-[2px] bg-muted">
              <div
                className="absolute inset-x-0 top-0.5 h-2 rounded-[1px] bg-foreground/45"
                style={{ width: `${(r.takings / maxTakings) * 100}%` }}
                title={`takings ${money(r.takings)}`}
              />
              <div
                className="absolute inset-x-0 bottom-0.5 h-2 rounded-[1px]"
                style={{
                  width: `${((r.rented ? (r.rentPerWeek ?? 0) : r.employedCost) / maxTakings) * 100}%`,
                  background: r.rented
                    ? "color-mix(in oklch, currentColor 28%, transparent)"
                    : "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: r.rented ? undefined : "1px solid currentColor",
                  outlineOffset: -1,
                }}
                title={r.rented ? `rent kept ${money(r.rentPerWeek ?? 0)}` : `cost of employing ${money(r.employedCost)}`}
              />
              <span
                className="absolute inset-y-0 w-0.5 bg-foreground"
                style={{ left: `${clamp((breakEven / maxTakings) * 100, 0, 99)}%` }}
                title={`break-even against renting ${money(breakEven)}`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.takings)} through the chair ·{" "}
              {r.rented
                ? `${money(r.rentPerWeek ?? 0)} of rent is what the salon keeps, whatever the chair took`
                : `${money(r.contribution)} left after ${money(r.employedCost)} of wage and on-costs`}
              {r.perBookedHour !== null ? ` · ${money(r.perBookedHour)} an hour while busy` : " · never booked"}
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Mean occupancy</dt>
          <dd className="font-medium tabular-nums">{(meanOcc * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rented chairs</dt>
          <dd className="font-medium tabular-nums">
            {rentRows.length}/{rows.length}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Break-even</dt>
          <dd className="font-medium tabular-nums">{money(breakEven)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Best chair</dt>
          <dd className="truncate font-medium">{rows[0].name}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The upper lane is what went THROUGH the chair and the lower one is what it costs — hatched for an employed
        chair, which is {money(employedCostPerHour)} an hour for every hour the salon is OPEN, and plain for a rented
        one, which is the same rent whatever the chair takes · the mark is the
        break-even: {money(breakEven)} a week is what an employed chair has to bill to beat renting it out at{" "}
        {money(meanRent)} ·{" "}
        {rentRows.length === 0
          ? "no chair is rented, so the comparison is a hypothetical the salon should still know"
          : beaters.length === 0
            ? `no employed chair clears it, which is an argument the landlord side of the business is winning`
            : `${beaters.length} employed ${plural(beaters.length, "chair clears", "chairs clear")} it`}{" "}
        · occupancy averages {(meanOcc * 100).toFixed(0)}%, and the empty hours are paid for either way
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ServiceMix — services by how much CHAIR TIME they consume against
 * how much money they make. A cut is quick and cheap and a colour is
 * three hours and dear, so a bar chart of revenue and a bar chart of
 * bookings tell opposite stories about the same day.
 * ------------------------------------------------------------------ */
export function ServiceMix({
  services,
  className = "",
}: {
  services: { name: string; bookings: number; minutes: number; price: number; materialCost?: number }[]
  className?: string
}) {
  const rows = services
    .map((s) => {
      const chairHours = (s.bookings * s.minutes) / 60
      const revenue = s.bookings * s.price
      const materials = s.bookings * (s.materialCost ?? 0)
      const margin = revenue - materials
      return { ...s, chairHours, revenue, materials, margin, perChairHour: margin / Math.max(chairHours, 1e-9) }
    })
    .sort((a, b) => b.perChairHour - a.perChairHour)
  const totalHours = rows.reduce((a, r) => a + r.chairHours, 0)
  const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0)
  const maxRate = Math.max(...rows.map((r) => r.perChairHour), 1)
  const mostTime = rows.reduce((a, r) => (r.chairHours > a.chairHours ? r : a), rows[0])
  const mostMoney = rows.reduce((a, r) => (r.margin > a.margin ? r : a), rows[0])
  const best = rows[0]
  const worst = rows[rows.length - 1]

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.bookings} × {r.minutes} min · {money(r.price)}
              </span>
            </div>
            {/* two measures on one row, each on its own scale, because the
                POINT is that they disagree — one bar would hide it */}
            <div className="mt-0.5 space-y-px">
              <div className="relative h-2.5 rounded-[1px] bg-muted">
                <div
                  className="absolute inset-y-0 rounded-[1px] bg-foreground/25"
                  style={{ width: `${(r.chairHours / Math.max(totalHours, 1e-9)) * 100}%` }}
                  title={`${r.chairHours.toFixed(1)} chair-hours, ${((r.chairHours / Math.max(totalHours, 1e-9)) * 100).toFixed(0)}% of the week`}
                />
              </div>
              <div className="relative h-2.5 rounded-[1px] bg-muted">
                <div
                  className="absolute inset-y-0 rounded-[1px] bg-foreground/70"
                  style={{ width: `${(r.margin / Math.max(totalRevenue, 1e-9)) * 100}%` }}
                  title={`${money(r.margin)} of margin`}
                />
              </div>
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.chairHours.toFixed(1)} chair-hours ·{" "}
              {money(r.margin)} of margin
              {r.materials > 0 ? ` after ${money(r.materials)} of product` : " with no product cost"} ·{" "}
              <span className="font-medium text-foreground/70">{money(r.perChairHour)} an hour</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-[1px] bg-foreground/25" /> share of chair time
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-[1px] bg-foreground/70" /> share of margin
        </span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Sorted by MARGIN PER CHAIR-HOUR, which is the only rate a salon actually sells — there are{" "}
        {totalHours.toFixed(0)} chair-hours in the week and no more · {best.name} returns {money(best.perChairHour)} an
        hour against {money(worst.perChairHour)} for {worst.name}, ×{(best.perChairHour / Math.max(worst.perChairHour, 1e-9)).toFixed(1)}{" "}
        ·{" "}
        {mostTime.name === mostMoney.name
          ? `${mostTime.name} takes the most time AND makes the most money, which is the easy case`
          : `${mostTime.name} takes the most time and ${mostMoney.name} makes the most money, which is why the diary and the till disagree`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RebookRate — clients who booked the next appointment before leaving,
 * by stylist, with the ANNUAL VALUE of the difference derived. A
 * rebooked client comes back on a rhythm and a walk-out comes back
 * when they remember, which is a different number of visits a year.
 * ------------------------------------------------------------------ */
export function RebookRate({
  stylists,
  meanSpend,
  rebookedWeeks,
  walkOutWeeks,
  className = "",
}: {
  stylists: { name: string; clients: number; rebooked: number }[]
  meanSpend: number
  /** weeks between visits when the next one is already in the book */
  rebookedWeeks: number
  /** weeks between visits when it is not */
  walkOutWeeks: number
  className?: string
}) {
  const rows = stylists
    .map((s) => {
      const rate = s.rebooked / Math.max(s.clients, 1)
      const visitsRebooked = 52 / Math.max(rebookedWeeks, 1e-9)
      const visitsWalk = 52 / Math.max(walkOutWeeks, 1e-9)
      // annual value of this stylist's book at their actual rebook rate
      const annual = s.clients * meanSpend * (rate * visitsRebooked + (1 - rate) * visitsWalk)
      const ifAll = s.clients * meanSpend * visitsRebooked
      return { ...s, rate, annual, ifAll, headroom: ifAll - annual }
    })
    .sort((a, b) => b.rate - a.rate)
  const clients = rows.reduce((a, r) => a + r.clients, 0)
  const rebooked = rows.reduce((a, r) => a + r.rebooked, 0)
  const overall = rebooked / Math.max(clients, 1)
  const headroom = rows.reduce((a, r) => a + r.headroom, 0)
  const perClient = meanSpend * (52 / Math.max(rebookedWeeks, 1e-9) - 52 / Math.max(walkOutWeeks, 1e-9))
  const biggestGap = rows.reduce((a, r) => (r.headroom > a.headroom ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.rebooked} of {r.clients} rebooked · {(r.rate * 100).toFixed(0)}%
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/60" style={{ width: `${r.rate * 100}%` }} title={`${(r.rate * 100).toFixed(0)}% rebooked`} />
              <div
                className="absolute inset-y-0 rounded-r-[2px]"
                style={{
                  left: `${r.rate * 100}%`,
                  right: 0,
                  background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 5px)",
                }}
                title={`${r.clients - r.rebooked} left without a next appointment`}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${clamp(overall * 100, 0, 99)}%` }} title={`salon average ${(overall * 100).toFixed(0)}%`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.annual)} a year from this book against {money(r.ifAll)} if everyone rebooked —{" "}
              {money(r.headroom)} on the table
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A rebooked client returns every {rebookedWeeks} weeks and a walk-out every {walkOutWeeks}, which is{" "}
        {(52 / rebookedWeeks).toFixed(1)} visits a year against {(52 / walkOutWeeks).toFixed(1)} — so the rebook is
        worth {money(perClient)} a year per client and is asked for in the four seconds before they reach the door ·
        the salon rebooks {(overall * 100).toFixed(0)}% of {clients} clients, leaving {money(headroom)} a year unbooked
        {rows.length > 1 ? `, most of it (${money(biggestGap.headroom)}) on ${biggestGap.name}'s column` : ""} · the
        mark on each bar is the salon average, not a target — a target nobody set is not a measurement
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RetailAttach — product sold alongside a service, with the margin it
 * adds PER CHAIR-HOUR derived. Retail is argued as a percentage of
 * takings, which makes a shelf look small; against the chair-hour it
 * cost nothing to sell, it is the best-paid minute in the salon.
 * ------------------------------------------------------------------ */
export function RetailAttach({
  lines,
  serviceRatePerChairHour,
  className = "",
}: {
  lines: { name: string; unitsSold: number; price: number; cost: number; servicesInPeriod: number }[]
  /** what an hour in the chair makes on services alone, for comparison */
  serviceRatePerChairHour: number
  className?: string
}) {
  const rows = lines
    .map((l) => {
      const attach = l.unitsSold / Math.max(l.servicesInPeriod, 1)
      const margin = l.unitsSold * (l.price - l.cost)
      return { ...l, attach, margin, unitMargin: l.price - l.cost, marginRate: (l.price - l.cost) / Math.max(l.price, 1e-9) }
    })
    .sort((a, b) => b.margin - a.margin)
  const maxMargin = Math.max(...rows.map((r) => r.margin), 1)
  const totalMargin = rows.reduce((a, r) => a + r.margin, 0)
  const services = Math.max(...rows.map((r) => r.servicesInPeriod), 1)
  const perService = totalMargin / services
  const best = rows[0]
  const bestAttach = rows.reduce((a, r) => (r.attach > a.attach ? r : a), rows[0])
  const thin = rows.filter((r) => r.marginRate < 0.3)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.unitsSold} sold · {money(r.price)} · {(r.marginRate * 100).toFixed(0)}% margin
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/55" style={{ width: `${(r.margin / maxMargin) * 100}%` }} title={`${money(r.margin)} of margin`} />
              {/* attach rate as a separate mark, since a line can be high
                  margin and rarely sold, or the reverse */}
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${clamp(r.attach * 100, 0, 99)}%` }} title={`attached to ${(r.attach * 100).toFixed(0)}% of services`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.margin)} of margin · attached to {(r.attach * 100).toFixed(0)}% of services ·{" "}
              {money(r.unitMargin)} a unit
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is MARGIN and the mark is the attach rate, because those are different questions and a single retail
        percentage answers neither · {money(totalMargin)} of margin across {services} services is{" "}
        {money(perService)} a service, which lands on a chair-hour that already made{" "}
        {money(serviceRatePerChairHour)} — a {((perService / Math.max(serviceRatePerChairHour, 1e-9)) * 100).toFixed(0)}%
        uplift for a conversation at the mirror ·{" "}
        {best.name === bestAttach.name
          ? `${best.name} both sells most often and earns most, so it is the one to keep in stock`
          : `${best.name} earns the most and ${bestAttach.name} attaches most often, which are different shelf decisions`}
        {thin.length > 0 ? ` · ${thin.length} ${plural(thin.length, "line is", "lines are")} under 30% margin and is stock money doing very little` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * StylistColumn — one stylist's day as it actually ran, with the GAPS
 * derived. A day is reviewed as a takings figure, which is the sum of
 * the appointments and says nothing about the forty minutes between
 * two of them that could never be sold.
 * ------------------------------------------------------------------ */
export function StylistColumn({
  appointments,
  dayStart,
  dayEnd,
  minSellableGapMin = 30,
  ratePerHour,
  className = "",
}: {
  /** decimal hours, e.g. 9.5 for 09:30 */
  appointments: { client: string; service: string; start: number; end: number; value: number }[]
  dayStart: number
  dayEnd: number
  /** a gap shorter than this could never have been sold to anybody */
  minSellableGapMin?: number
  ratePerHour: number
  className?: string
}) {
  const sorted = [...appointments].sort((a, b) => a.start - b.start)
  const span = Math.max(dayEnd - dayStart, 1e-9)
  const gaps: { start: number; end: number; sellable: boolean }[] = []
  let cursor = dayStart
  for (const a of sorted) {
    if (a.start > cursor) {
      const mins = (a.start - cursor) * 60
      gaps.push({ start: cursor, end: a.start, sellable: mins >= minSellableGapMin })
    }
    cursor = Math.max(cursor, a.end)
  }
  if (cursor < dayEnd) {
    const mins = (dayEnd - cursor) * 60
    gaps.push({ start: cursor, end: dayEnd, sellable: mins >= minSellableGapMin })
  }
  const booked = sorted.reduce((a, x) => a + (x.end - x.start), 0)
  const takings = sorted.reduce((a, x) => a + x.value, 0)
  const sellableGap = gaps.filter((g) => g.sellable).reduce((a, g) => a + (g.end - g.start), 0)
  const deadGap = gaps.filter((g) => !g.sellable).reduce((a, g) => a + (g.end - g.start), 0)
  const longest = gaps.reduce<{ start: number; end: number; sellable: boolean } | null>((a, g) => (a === null || g.end - g.start > a.end - a.start ? g : a), null)

  return (
    <div className={className}>
      {/* one continuous timeline, so the gaps are drawn at their real width
          instead of vanishing between two list items */}
      <div className="relative h-8 rounded-[2px] border border-foreground/15 bg-muted">
        {sorted.map((a, i) => (
          <div
            key={i}
            className="absolute inset-y-0 border-l border-background bg-foreground/55"
            style={{ left: `${((a.start - dayStart) / span) * 100}%`, width: `${((a.end - a.start) / span) * 100}%` }}
            title={`${hhmm(a.start)}–${hhmm(a.end)} ${a.client} · ${a.service} · ${money(a.value)}`}
          />
        ))}
        {gaps.map((g, i) => (
          <div
            key={`g${i}`}
            className="absolute inset-y-0"
            style={{
              left: `${((g.start - dayStart) / span) * 100}%`,
              width: `${((g.end - g.start) / span) * 100}%`,
              background: g.sellable ? "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 6px)" : undefined,
            }}
            title={`${hhmm(g.start)}–${hhmm(g.end)} · ${((g.end - g.start) * 60).toFixed(0)} min ${g.sellable ? "sellable" : "too short to sell"}`}
          />
        ))}
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] tabular-nums text-muted-foreground">
        <span>{hhmm(dayStart)}</span>
        <span>hatched gaps are long enough to have sold</span>
        <span>{hhmm(dayEnd)}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Takings</dt>
          <dd className="font-medium tabular-nums">{money(takings)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">In the chair</dt>
          <dd className="font-medium tabular-nums">{booked.toFixed(1)} h</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Sellable gap</dt>
          <dd className="font-medium tabular-nums">{(sellableGap * 60).toFixed(0)} min</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Longest gap</dt>
          <dd className="font-medium tabular-nums">{longest ? `${((longest.end - longest.start) * 60).toFixed(0)} min` : "none"}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A day is reviewed as a takings figure and the takings are the appointments — this is the SPACE BETWEEN them,
        which is what a column actually costs · {booked.toFixed(1)} of {span.toFixed(1)} hours were in the chair,{" "}
        {(sellableGap * 60).toFixed(0)} minutes sat in gaps long enough to have sold something at{" "}
        {money(sellableGap * ratePerHour)}, and {(deadGap * 60).toFixed(0)} minutes went in pieces under{" "}
        {minSellableGapMin} minutes that nobody could ever have booked ·{" "}
        {sellableGap * 60 < minSellableGapMin
          ? "the day is effectively full, and more takings means a higher price rather than a fuller book"
          : `moving one appointment can close a ${longest ? ((longest.end - longest.start) * 60).toFixed(0) : "0"}-minute hole, which a takings report never shows`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * NoShowCost — no-shows and late cancellations by NOTICE GIVEN, with
 * the refillable share derived. Every salon knows its no-show rate and
 * the useful split is by how much warning it got, because a week's
 * notice is a rebooking and two hours' notice is an empty chair.
 * ------------------------------------------------------------------ */
export function NoShowCost({
  buckets,
  chairRatePerHour,
  depositRate = 0.25,
  className = "",
}: {
  /** ordered from most notice to least; the last bucket is the true no-show */
  buckets: { label: string; count: number; meanMinutes: number; refilledShare: number }[]
  chairRatePerHour: number
  /** the deposit a booking would have carried, as a share of the service */
  depositRate?: number
  className?: string
}) {
  const rows = buckets.map((b) => {
    const hours = (b.count * b.meanMinutes) / 60
    const lost = hours * (1 - b.refilledShare) * chairRatePerHour
    const value = hours * chairRatePerHour
    return { ...b, hours, value, lost, recovered: value - lost }
  })
  const totalLost = rows.reduce((a, r) => a + r.lost, 0)
  const totalValue = rows.reduce((a, r) => a + r.value, 0)
  const totalCount = rows.reduce((a, r) => a + r.count, 0)
  const maxValue = Math.max(...rows.map((r) => r.value), 1)
  const deposits = rows.reduce((a, r) => a + r.value * depositRate * (1 - r.refilledShare), 0)
  const worst = rows.reduce((a, r) => (r.lost > a.lost ? r : a), rows[0])
  const refillOverall = totalValue > 0 ? 1 - totalLost / totalValue : 0

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.count} × {r.meanMinutes} min · {r.hours.toFixed(1)} chair-hours
              </span>
            </div>
            <div className="relative mt-0.5 h-5 rounded-[2px] bg-muted" style={{ width: `${(r.value / maxValue) * 100}%` }}>
              <div className="absolute inset-y-0 left-0 rounded-l-[2px] bg-foreground/25" style={{ width: `${r.refilledShare * 100}%` }} title={`refilled: ${money(r.recovered)}`} />
              <div
                className="absolute inset-y-0 right-0 rounded-r-[2px]"
                style={{
                  width: `${(1 - r.refilledShare) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)",
                  outline: "1px solid currentColor",
                  outlineOffset: -1,
                }}
                title={`lost: ${money(r.lost)}`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.refilledShare * 100).toFixed(0)}% refilled · {money(r.lost)} gone · a deposit would have held{" "}
              {money(r.value * depositRate * (1 - r.refilledShare))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Split by NOTICE rather than by reason, because notice is the only part of a cancellation the salon can act on
        — {(refillOverall * 100).toFixed(0)}% of the {totalCount} lost bookings were refilled and{" "}
        {money(totalLost)} was not · {worst.label} costs the most at {money(worst.lost)}, which is where a deposit
        earns its keep: a {(depositRate * 100).toFixed(0)}% deposit on the unfilled ones is {money(deposits)} back and,
        far more usefully, a reason to ring · the bar length is the VALUE of each bucket and the hatch is the part
        that stayed empty
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ColourStock — tubes on the shelf against the rate they are used, with
 * WEEKS OF COVER derived. A stock list says how many are left, which is
 * meaningless without the rate; the shade that runs out mid-colour on a
 * Saturday is the one three tubes deep and used every day.
 * ------------------------------------------------------------------ */
export function ColourStock({
  shades,
  orderLeadWeeks,
  className = "",
}: {
  shades: { name: string; onHand: number; usedPerWeek: number; costPerTube: number }[]
  orderLeadWeeks: number
  className?: string
}) {
  const rows = shades
    .map((s) => {
      const cover = s.usedPerWeek > 0 ? s.onHand / s.usedPerWeek : null
      return {
        ...s,
        cover,
        // a shade with no usage is not "infinite cover", it is dead stock
        dead: s.usedPerWeek === 0,
        short: cover !== null && cover < orderLeadWeeks,
        tiedUp: s.onHand * s.costPerTube,
      }
    })
    .sort((a, b) => (a.cover ?? Infinity) - (b.cover ?? Infinity))
  const live = rows.filter((r) => r.cover !== null)
  const maxCover = Math.max(orderLeadWeeks * 2, ...live.map((r) => r.cover ?? 0))
  const short = rows.filter((r) => r.short)
  const dead = rows.filter((r) => r.dead)
  const tiedUp = rows.reduce((a, r) => a + r.tiedUp, 0)
  const deadValue = dead.reduce((a, r) => a + r.tiedUp, 0)

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span aria-hidden className="w-3 text-muted-foreground">
              {r.short ? "!" : r.dead ? "×" : "·"}
            </span>
            <span className="w-28 shrink-0 truncate">{r.name}</span>
            <div className="relative h-3.5 flex-1 rounded-[1px] bg-muted">
              {r.cover !== null && (
                <div
                  className="absolute inset-y-0 rounded-[1px]"
                  style={{
                    width: `${clamp((r.cover / maxCover) * 100, 1, 100)}%`,
                    background: r.short ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)" : "color-mix(in oklch, currentColor 45%, transparent)",
                    outline: r.short ? "1px solid currentColor" : undefined,
                    outlineOffset: -1,
                  }}
                  title={`${r.cover.toFixed(1)} weeks of cover`}
                />
              )}
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${clamp((orderLeadWeeks / maxCover) * 100, 0, 99)}%` }} title={`${orderLeadWeeks} week order lead`} />
            </div>
            <span className="w-40 shrink-0 text-right text-muted-foreground">
              {r.onHand} on hand ·{" "}
              {r.cover === null ? "not used at all" : `${r.cover.toFixed(1)} wk`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is WEEKS OF COVER — on hand divided by the rate it goes out — and the mark is the{" "}
        {orderLeadWeeks}-week order lead, so anything hatched runs out before the delivery arrives ·{" "}
        {short.length === 0
          ? "no shade is inside the lead time, which is the state a colour bar should be in"
          : `${short.length} ${plural(short.length, "shade is", "shades are")} inside it, the tightest ${short[0].name} at ${(short[0].cover ?? 0).toFixed(1)} weeks`}{" "}
        · a shade with no usage is DEAD STOCK, not infinite cover —{" "}
        {dead.length === 0 ? "there is none here" : `${dead.length} of ${rows.length} ${plural(dead.length, "shade has", "shades have")} not moved, ${money(deadValue)} of the ${money(tiedUp)} on the shelf`}
      </p>
    </div>
  )
}
