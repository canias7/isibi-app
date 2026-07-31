/**
 * Private hire primitives — deadhead miles, waiting by zone, what a driver
 * actually clears, where a booking dies, vehicle idle time and whether a
 * surge brought any cars.
 *
 * Earnings per TOTAL mile rather than per paid mile, which side of the market
 * is waiting, the hourly net after everything, the cost of each place a
 * booking can fail, the hours a vehicle is neither earning nor off, and
 * whether a multiplier produced supply are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
const money = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e4 ? `£${(a / 1e3).toFixed(1)}k` : a < 10 ? `£${a.toFixed(2)}` : `£${Math.round(a).toLocaleString("en-GB")}`
  return v < 0 ? `−${s}` : s
}

/* ------------------------------------------------------------------ *
 * DeadheadRatio — paid miles against every mile driven, with EARNINGS
 * PER TOTAL MILE derived. A fare is quoted per paid mile and a car
 * wears out per mile, so the rate a driver is actually paid is the one
 * divided by the whole day, and it is always a good deal lower.
 * ------------------------------------------------------------------ */
export function DeadheadRatio({
  shifts,
  costPerMile,
  className = "",
}: {
  shifts: { label: string; paidMiles: number; deadMiles: number; fares: number }[]
  /** fuel, tyres, servicing and depreciation, per mile driven */
  costPerMile: number
  className?: string
}) {
  const rows = shifts
    .map((s) => {
      const total = s.paidMiles + s.deadMiles
      return {
        ...s,
        total,
        utilisation: s.paidMiles / Math.max(total, 1e-9),
        perPaidMile: s.fares / Math.max(s.paidMiles, 1e-9),
        perTotalMile: s.fares / Math.max(total, 1e-9),
        net: s.fares - total * costPerMile,
      }
    })
    .sort((a, b) => b.utilisation - a.utilisation)
  const max = Math.max(...rows.map((r) => r.total), 1)
  const paid = rows.reduce((a, r) => a + r.paidMiles, 0)
  const dead = rows.reduce((a, r) => a + r.deadMiles, 0)
  const fares = rows.reduce((a, r) => a + r.fares, 0)
  const perPaid = fares / Math.max(paid, 1)
  const perTotal = fares / Math.max(paid + dead, 1)
  const net = fares - (paid + dead) * costPerMile
  const best = rows[0]
  const worst = rows[rows.length - 1]

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.total.toFixed(0)} miles · {(r.utilisation * 100).toFixed(0)}% with somebody in the car
              </span>
            </div>
            <div className="mt-0.5 flex h-5 rounded-[2px] bg-muted" style={{ width: `${(r.total / max) * 100}%` }}>
              <div className="rounded-l-[2px] bg-foreground/55" style={{ width: `${r.utilisation * 100}%` }} title={`${r.paidMiles.toFixed(0)} paid miles`} />
              <div
                className="rounded-r-[2px]"
                style={{
                  width: `${(1 - r.utilisation) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)",
                  outline: "1px solid currentColor",
                  outlineOffset: -1,
                }}
                title={`${r.deadMiles.toFixed(0)} miles empty`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.perPaidMile)} a paid mile is {money(r.perTotalMile)} a mile DRIVEN ·{" "}
              {money(r.net)} after {money(r.total * costPerMile)} of running cost
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched miles are EMPTY — driving to a pickup, driving back from a drop, driving to where the work is · the
        fare card says {money(perPaid)} a mile and the car is actually paid {money(perTotal)} a mile, because{" "}
        {((dead / Math.max(paid + dead, 1)) * 100).toFixed(0)}% of {(paid + dead).toFixed(0)} miles had nobody in it
        · at {money(costPerMile)} a mile to run, {money(fares)} of fares nets {money(net)} ·{" "}
        {best.label} runs at {(best.utilisation * 100).toFixed(0)}% loaded against{" "}
        {(worst.utilisation * 100).toFixed(0)}% for {worst.label}, which is the difference between a shift worth
        working and one that only looks like it
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ZoneWait — who is waiting, where, and when. A market has two waits
 * and only one of them is usually measured: the rider waiting for a
 * car and the driver waiting for a job are the same shortage seen from
 * opposite ends, and the map of which is which IS the supply picture.
 * ------------------------------------------------------------------ */
export function ZoneWait({
  zones,
  hours,
  className = "",
}: {
  /** riderWaitMin and driverWaitMin, one per hour, per zone */
  zones: { name: string; riderWaitMin: number[]; driverWaitMin: number[] }[]
  hours: string[]
  className?: string
}) {
  const cells = zones.map((z) =>
    hours.map((_, i) => {
      const rider = z.riderWaitMin[i] ?? 0
      const driver = z.driverWaitMin[i] ?? 0
      // one signed number: positive means riders wait (too few cars),
      // negative means drivers wait (too many)
      return { rider, driver, net: rider - driver }
    })
  )
  const scale = Math.max(1, ...cells.flat().map((c) => Math.abs(c.net)))
  const flat = cells.flat()
  const riderShort = flat.filter((c) => c.net > 2).length
  const driverIdle = flat.filter((c) => c.net < -2).length
  const worst = flat.reduce((a, c) => (c.net > a.net ? c : a), flat[0])
  const worstAt = cells.flatMap((row, zi) => row.map((c, hi) => ({ c, zi, hi }))).reduce((a, x) => (x.c.net > a.c.net ? x : a), { c: flat[0], zi: 0, hi: 0 })

  return (
    <div className={className}>
      <div className="space-y-px">
        {zones.map((z, zi) => (
          <div key={z.name} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-[10px]">{z.name}</span>
            <div className="flex flex-1 gap-px">
              {hours.map((h, hi) => {
                const c = cells[zi][hi]
                const mag = Math.abs(c.net) / scale
                return (
                  <div
                    key={h}
                    className="min-w-0 flex-1 rounded-[1px] border border-foreground/10"
                    style={{
                      height: 16,
                      background:
                        c.net >= 0
                          ? `color-mix(in oklch, currentColor ${(mag * 82).toFixed(0)}%, transparent)`
                          : `repeating-linear-gradient(135deg, currentColor 0 ${(0.5 + mag * 2).toFixed(1)}px, transparent ${(0.5 + mag * 2).toFixed(1)}px 4px)`,
                    }}
                    title={`${z.name} ${h}: riders wait ${c.rider.toFixed(1)} min, drivers wait ${c.driver.toFixed(1)} min`}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex gap-px pl-[6.5rem] text-[9px] text-muted-foreground">
        {hours.map((h, i) => (
          <span key={h} className="min-w-0 flex-1 truncate text-center">
            {i % 3 === 0 ? h : ""}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25 bg-foreground/70" /> riders
          waiting — too few cars
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25" style={{ background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)" }} />{" "}
          drivers waiting — too many
        </span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        One signed number per cell: rider wait minus driver wait, so SOLID is a shortage and HATCHED is a surplus —
        two separate heat maps would have to be read against each other and nobody does that ·{" "}
        {riderShort} of {flat.length} zone-hours have riders waiting more than two minutes longer than drivers, and{" "}
        {driverIdle} have it the other way · the sharpest shortage is {zones[worstAt.zi].name} at{" "}
        {hours[worstAt.hi]}, {worst.net.toFixed(1)} minutes · moving one car between two cells on this grid is worth
        more than adding one to the fleet
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DriverEarnings — gross down to what actually reaches a driver, with
 * the HOURLY NET derived. Every figure in this trade is quoted gross;
 * the only one that answers "is this worth doing" is what is left per
 * hour after commission, fuel, the vehicle and the licence.
 * ------------------------------------------------------------------ */
export function DriverEarnings({
  weeks,
  hoursPerWeek,
  className = "",
}: {
  weeks: { label: string; gross: number; commission: number; fuel: number; vehicle: number; licensing: number }[]
  hoursPerWeek: number
  className?: string
}) {
  const keys = ["commission", "fuel", "vehicle", "licensing"] as const
  const labels: Record<(typeof keys)[number], string> = {
    commission: "Platform commission",
    fuel: "Fuel",
    vehicle: "Vehicle and insurance",
    licensing: "Licensing and plate",
  }
  const rows = weeks.map((w) => {
    const deductions = keys.reduce((a, k) => a + w[k], 0)
    const net = w.gross - deductions
    return { ...w, deductions, net, perHour: net / Math.max(hoursPerWeek, 1e-9), takeHome: net / Math.max(w.gross, 1e-9) }
  })
  const max = Math.max(...rows.map((r) => r.gross), 1)
  const gross = rows.reduce((a, r) => a + r.gross, 0)
  const net = rows.reduce((a, r) => a + r.net, 0)
  const perHour = net / Math.max(rows.length * hoursPerWeek, 1)
  const totals = keys.map((k) => ({ k, v: rows.reduce((a, r) => a + r[k], 0) }))
  const biggest = totals.reduce((a, t) => (t.v > a.v ? t : a), totals[0])
  const shade = (i: number) => `color-mix(in oklch, currentColor ${20 + i * 16}%, transparent)`
  const worst = rows.reduce((a, r) => (r.perHour < a.perHour ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-[10px]">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {money(r.gross)} gross → {money(r.net)} net · {money(r.perHour)}/h
              </span>
            </div>
            <div className="mt-0.5 flex h-4 rounded-[2px] bg-muted" style={{ width: `${(r.gross / max) * 100}%` }}>
              <div className="rounded-l-[2px] bg-foreground/75" style={{ width: `${(r.net / Math.max(r.gross, 1e-9)) * 100}%` }} title={`net ${money(r.net)}`} />
              {keys.map((k, i) => (
                <div key={k} className="last:rounded-r-[2px]" style={{ width: `${(r[k] / Math.max(r.gross, 1e-9)) * 100}%`, background: shade(i) }} title={`${labels[k]}: ${money(r[k])}`} />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-[1px] bg-foreground/75" /> what the driver keeps
        </span>
        {keys.map((k, i) => (
          <span key={k} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25" style={{ background: shade(i) }} />
            {labels[k]}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Everything in this trade is quoted GROSS and the only figure that answers the question is{" "}
        {money(perHour)} an hour — {money(net)} kept out of {money(gross)},{" "}
        {((net / Math.max(gross, 1)) * 100).toFixed(0)}%, over {hoursPerWeek} hours a week · the largest single
        deduction is {labels[biggest.k].toLowerCase()} at {money(biggest.v)} ·{" "}
        {worst.perHour === rows[0].perHour && rows.length === 1
          ? "one week is a sample of one"
          : `the worst week clears ${money(worst.perHour)} an hour, and the gross that week was ${money(worst.gross)} — a big gross week and a good week are not the same thing`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CancellationPoint — where in a booking's life it died, with the COST
 * OF EACH derived. A cancellation rate is one number covering events
 * that cost nothing and events that cost a driver twenty minutes and
 * a tank of fuel, and only the second kind is worth chasing.
 * ------------------------------------------------------------------ */
export function CancellationPoint({
  stages,
  bookings,
  driverCostPerMinute,
  className = "",
}: {
  /** in journey order, from booked to at the pickup */
  stages: { name: string; cancelled: number; meanDriverMinutes: number; byRider: number }[]
  bookings: number
  driverCostPerMinute: number
  className?: string
}) {
  const rows = stages.map((s) => ({
    ...s,
    rate: s.cancelled / Math.max(bookings, 1),
    cost: s.cancelled * s.meanDriverMinutes * driverCostPerMinute,
    riderShare: s.cancelled > 0 ? s.byRider / s.cancelled : null,
  }))
  const maxCost = Math.max(...rows.map((r) => r.cost), 1)
  const cancelled = rows.reduce((a, r) => a + r.cancelled, 0)
  const cost = rows.reduce((a, r) => a + r.cost, 0)
  const costliest = rows.reduce((a, r) => (r.cost > a.cost ? r : a), rows[0])
  const commonest = rows.reduce((a, r) => (r.cancelled > a.cancelled ? r : a), rows[0])
  const free = rows.filter((r) => r.meanDriverMinutes === 0)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.cancelled} · {(r.rate * 100).toFixed(1)}% of bookings · {r.meanDriverMinutes} driver-min each
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px]"
                style={{
                  width: `${clamp((r.cost / maxCost) * 100, r.cost > 0 ? 2 : 0, 100)}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)",
                  outline: r.cost > 0 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`${money(r.cost)} of driver time`}
              />
              {/* count as a separate mark, because a common free cancellation
                  and a rare expensive one both need to be visible */}
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${clamp((r.cancelled / Math.max(cancelled, 1)) * 100, 0, 99)}%` }} title={`${((r.cancelled / Math.max(cancelled, 1)) * 100).toFixed(0)}% of all cancellations`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.cost > 0 ? `${money(r.cost)} of driver time burned` : "costs nothing — nobody had moved yet"}
              {r.riderShare !== null ? ` · ${(r.riderShare * 100).toFixed(0)}% cancelled by the rider` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is the DRIVER TIME each stage burns and the mark is its share of the count, because those are
        different rankings and a single cancellation rate averages a free event with an expensive one ·{" "}
        {cancelled} of {bookings} bookings died ({((cancelled / Math.max(bookings, 1)) * 100).toFixed(1)}%), costing{" "}
        {money(cost)} of driver time ·{" "}
        {costliest.name === commonest.name
          ? `${costliest.name} is both the commonest and the dearest, so it is the only one worth a policy`
          : `${commonest.name} happens most and ${costliest.name} costs most — a fee at the wrong stage annoys people and saves nothing`}
        {free.length > 0 ? ` · ${free.length} ${plural(free.length, "stage costs", "stages cost")} nothing at all and should never carry a charge` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * VehicleIdle — a vehicle's day in three states, with the COST OF IDLE
 * derived. A car is financed by the month and earns by the minute, so
 * the hours it is available and doing nothing are the ones the whole
 * business turns on — and they are invisible in a trips report.
 * ------------------------------------------------------------------ */
export function VehicleIdle({
  vehicles,
  dayHours,
  standingCostPerDay,
  className = "",
}: {
  /** hours in each state; the remainder of the day is off the road */
  vehicles: { name: string; engagedHours: number; availableHours: number; fares: number }[]
  dayHours: number
  /** finance, insurance and plate, per vehicle per day, whether it moves or not */
  standingCostPerDay: number
  className?: string
}) {
  const rows = vehicles
    .map((v) => {
      const off = Math.max(0, dayHours - v.engagedHours - v.availableHours)
      const onRoad = v.engagedHours + v.availableHours
      return {
        ...v,
        off,
        onRoad,
        engagedShare: v.engagedHours / Math.max(onRoad, 1e-9),
        perEngagedHour: v.fares / Math.max(v.engagedHours, 1e-9),
        // the standing cost falls on the hours that earned, whatever the rest did
        perEarningHour: (v.fares - standingCostPerDay) / Math.max(v.engagedHours, 1e-9),
      }
    })
    .sort((a, b) => b.engagedShare - a.engagedShare)
  const engaged = rows.reduce((a, r) => a + r.engagedHours, 0)
  const available = rows.reduce((a, r) => a + r.availableHours, 0)
  const off = rows.reduce((a, r) => a + r.off, 0)
  const fares = rows.reduce((a, r) => a + r.fares, 0)
  const standing = rows.length * standingCostPerDay
  const idleCost = (available / Math.max(engaged + available, 1e-9)) * standing
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
                {r.engagedHours.toFixed(1)} engaged of {r.onRoad.toFixed(1)} on the road ·{" "}
                {(r.engagedShare * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-0.5 flex h-5 rounded-[2px] bg-muted">
              <div className="rounded-l-[2px] bg-foreground/65" style={{ width: `${(r.engagedHours / dayHours) * 100}%` }} title={`${r.engagedHours.toFixed(1)} h with a fare`} />
              <div
                style={{
                  width: `${(r.availableHours / dayHours) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)",
                  outline: r.availableHours > 0 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`${r.availableHours.toFixed(1)} h on the road with nothing to do`}
              />
              <div className="rounded-r-[2px]" style={{ width: `${(r.off / dayHours) * 100}%` }} title={`${r.off.toFixed(1)} h off the road`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.fares)} of fares · {money(r.perEngagedHour)} an engaged hour,{" "}
              {money(r.perEarningHour)} after the {money(standingCostPerDay)} the vehicle costs regardless
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Solid is with a fare, hatched is ON THE ROAD AND EMPTY, and the plain remainder is off the road — the middle
        band is the one a trips report cannot show and the one the business turns on ·{" "}
        {engaged.toFixed(1)} engaged hours against {available.toFixed(1)} available and {off.toFixed(1)} off, so{" "}
        {((available / Math.max(engaged + available, 1e-9)) * 100).toFixed(0)}% of road time earned nothing while{" "}
        {money(standing)} of standing cost ran anyway — {money(idleCost)} of it against those empty hours ·{" "}
        {best.name} is engaged {(best.engagedShare * 100).toFixed(0)}% of its road time and {worst.name}{" "}
        {(worst.engagedShare * 100).toFixed(0)}%, on {money(fares)} of fares between them
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SurgeResponse — the multiplier against the cars that actually turned
 * up, with the ELASTICITY derived. A surge is justified as a supply
 * signal, so the only test of it is whether supply moved; a multiplier
 * that raises the price and brings no cars is simply a price rise.
 * ------------------------------------------------------------------ */
export function SurgeResponse({
  intervals,
  className = "",
}: {
  /** in time order */
  intervals: { label: string; multiplier: number; carsOnline: number; requests: number }[]
  className?: string
}) {
  const base = intervals.find((i) => i.multiplier <= 1) ?? intervals[0]
  const rows = intervals.map((i) => ({
    ...i,
    // supply response relative to the unsurged baseline
    supplyLift: i.carsOnline / Math.max(base.carsOnline, 1e-9) - 1,
    priceLift: i.multiplier - 1,
    unmet: Math.max(0, i.requests - i.carsOnline),
  }))
  const surged = rows.filter((r) => r.priceLift > 0.02)
  // elasticity as a RATIO OF SUMS, not a mean of ratios. Averaging per-interval
  // ratios lets the smallest price lift dominate — a ×1.1 interval with a 5%
  // supply bump scores 0.48 and drags the whole figure above a threshold the
  // peak never comes close to
  const liftSum = surged.reduce((a, r) => a + r.supplyLift, 0)
  const priceSum = surged.reduce((a, r) => a + r.priceLift, 0)
  const elasticity = surged.length && priceSum > 0 ? liftSum / priceSum : null
  const maxCars = Math.max(...rows.map((r) => Math.max(r.carsOnline, r.requests)), 1)
  const maxMult = Math.max(...rows.map((r) => r.multiplier), 1.2)
  const unmet = rows.reduce((a, r) => a + r.unmet, 0)
  const peak = rows.reduce((a, r) => (r.multiplier > a.multiplier ? r : a), rows[0])

  return (
    <div className={className}>
      <div className="relative flex items-stretch gap-px rounded-[2px] border border-foreground/15" style={{ height: 140 }}>
        {rows.map((r) => (
          <div key={r.label} className="relative min-w-0 flex-1" title={`${r.label}: ×${r.multiplier.toFixed(2)}, ${r.carsOnline} cars, ${r.requests} requests`}>
            <div className="absolute inset-x-0 bottom-0 bg-foreground/40" style={{ height: `${(r.carsOnline / maxCars) * 100}%` }} />
            <span className="absolute inset-x-0 border-t border-dashed border-foreground/70" style={{ bottom: `${(r.requests / maxCars) * 100}%` }} />
          </div>
        ))}
        {/* the multiplier as a line over the top, on its own scale and said so */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          <polyline
            points={rows.map((r, i) => `${(i / Math.max(rows.length - 1, 1)) * 100},${100 - (r.multiplier / maxMult) * 92 - 4}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] tabular-nums text-muted-foreground">
        <span>{rows[0].label}</span>
        <span>bars are cars · dashes are requests · line is the multiplier, to ×{maxMult.toFixed(1)}</span>
        <span>{rows[rows.length - 1].label}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Peak</dt>
          <dd className="font-medium tabular-nums">×{peak.multiplier.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Supply then</dt>
          <dd className="font-medium tabular-nums">
            {peak.supplyLift >= 0 ? "+" : ""}
            {(peak.supplyLift * 100).toFixed(0)}%
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Elasticity</dt>
          <dd className="font-medium tabular-nums">{elasticity === null ? "—" : elasticity.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Unmet</dt>
          <dd className="font-medium tabular-nums">{unmet}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A surge is defended as a SUPPLY SIGNAL, so the test is whether supply moved — the line is the multiplier and
        the bars are the cars that answered it ·{" "}
        {elasticity === null
          ? "no interval here is surged, so there is no response to measure and the multiplier line is flat by construction"
          : elasticity < 0.2
            ? `supply moved ${elasticity.toFixed(2)} for every unit of price across ${surged.length} surged ${plural(surged.length, "interval", "intervals")}, which is a price rise wearing the language of a signal`
            : `supply moved ${elasticity.toFixed(2)} for every unit of price across ${surged.length} surged ${plural(surged.length, "interval", "intervals")}, so the signal is doing what it claims`}{" "}
        · {unmet} requests went unserved at the peak of ×{peak.multiplier.toFixed(2)}, where the dashes sit above the
        bars
      </p>
    </div>
  )
}
