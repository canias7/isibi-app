/**
 * Road haulage primitives — empty running, driving hours, lane rates, fuel
 * surcharge, pallet networks and vehicle utilisation.
 *
 * The miles run with nothing in the trailer, whether a shift is legal, what
 * a lane really pays after the return leg, what a surcharge recovers, where
 * a network hub costs more than it saves and how much of a vehicle's day
 * is loaded are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e4 ? `£${(a / 1e3).toFixed(0)}k` : a < 10 ? `£${a.toFixed(2)}` : `£${Math.round(a).toLocaleString("en-GB")}`
  return v < 0 ? `−${s}` : s
}
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/* ------------------------------------------------------------------ *
 * EmptyRunning — loaded against empty miles, by vehicle. The cost of
 * an empty mile is the same as a loaded one and it earns nothing, so
 * the RATE PER LOADED MILE is what a job has to cover.
 * ------------------------------------------------------------------ */
export function EmptyRunning({
  vehicles,
  costPerMile,
  className = "",
}: {
  vehicles: { name: string; loadedMiles: number; emptyMiles: number; revenue: number }[]
  costPerMile: number
  className?: string
}) {
  const rows = vehicles
    .map((v) => {
      const total = v.loadedMiles + v.emptyMiles
      const cost = total * costPerMile
      return {
        ...v,
        total,
        empty: v.emptyMiles / Math.max(total, 1),
        cost,
        margin: v.revenue - cost,
        perLoadedMile: v.revenue / Math.max(v.loadedMiles, 1),
        breakEvenRate: cost / Math.max(v.loadedMiles, 1),
      }
    })
    .sort((a, b) => b.empty - a.empty)
  const loaded = rows.reduce((a, r) => a + r.loadedMiles, 0)
  const empty = rows.reduce((a, r) => a + r.emptyMiles, 0)
  const fleetEmpty = empty / Math.max(loaded + empty, 1)
  const max = Math.max(...rows.map((r) => r.total))
  const losing = rows.filter((r) => r.margin < 0)
  const worst = rows[0]

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.total.toLocaleString()} miles · {(r.empty * 100).toFixed(0)}% empty
              </span>
            </div>
            <div className="mt-0.5 flex h-4 gap-px" style={{ width: `${(r.total / max) * 100}%` }}>
              <div className="rounded-l-[2px] bg-foreground" style={{ width: `${(1 - r.empty) * 100}%` }} title={`loaded ${r.loadedMiles.toLocaleString()}`} />
              <div
                className="rounded-r-[2px]"
                style={{
                  width: `${r.empty * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: "1px solid currentColor",
                  outlineOffset: -1,
                }}
                title={`empty ${r.emptyMiles.toLocaleString()}`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              earns {r.perLoadedMile.toFixed(2)} a loaded mile against {r.breakEvenRate.toFixed(2)} to break even ·{" "}
              {r.margin >= 0 ? "+" : ""}
              {money(r.margin)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched is EMPTY running, which costs the same per mile as loaded and earns nothing —{" "}
        {(fleetEmpty * 100).toFixed(0)}% of {(loaded + empty).toLocaleString()} fleet miles, so every job has to
        recover roughly {(1 / Math.max(1 - fleetEmpty, 1e-9)).toFixed(2)}× its own distance · the break-even rate is
        DERIVED per vehicle rather than quoted from a rate card ·{" "}
        {losing.length === 0
          ? "every vehicle covers its cost"
          : `${losing.length} ${plural(losing.length, "vehicle does", "vehicles do")} not, and ${worst.name} runs ${(worst.empty * 100).toFixed(0)}% empty, which is a backload problem rather than a pricing one`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DrivePeriods — a driver's day against the rules. Compliance is a
 * question about durations and breaks TOGETHER, and a tachograph
 * printout is a list of events.
 * ------------------------------------------------------------------ */
export function DrivePeriods({
  segments,
  maxContinuousDriveMin = 270,
  minBreakMin = 45,
  maxDailyDriveMin = 540,
  className = "",
}: {
  /** each period of the shift, in order */
  segments: { kind: "drive" | "other work" | "break" | "poa"; minutes: number }[]
  maxContinuousDriveMin?: number
  minBreakMin?: number
  maxDailyDriveMin?: number
  className?: string
}) {
  let t = 0
  let sinceBreak = 0
  const laid = segments.map((s) => {
    const start = t
    t += s.minutes
    // a break only resets the driving clock if it is long enough
    if (s.kind === "break" && s.minutes >= minBreakMin) sinceBreak = 0
    else if (s.kind === "drive") sinceBreak += s.minutes
    // the clock HOLDS through other work and a short break; only a qualifying
    // break resets it, so the trace must carry the value rather than drop to zero
    return { ...s, start, end: t, sinceBreak }
  })
  const shift = t
  const drive = laid.filter((s) => s.kind === "drive").reduce((a, s) => a + s.minutes, 0)
  const overRun = laid.find((s) => s.sinceBreak !== null && s.sinceBreak > maxContinuousDriveMin)
  const overDaily = drive > maxDailyDriveMin
  const breaks = laid.filter((s) => s.kind === "break")
  const qualifying = breaks.filter((s) => s.minutes >= minBreakMin)
  const fill = (k: string) =>
    k === "drive"
      ? "currentColor"
      : k === "other work"
        ? "color-mix(in oklch, currentColor 45%, transparent)"
        : k === "break"
          ? "color-mix(in oklch, currentColor 12%, transparent)"
          : "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)"
  const hm = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}`

  return (
    <div className={className}>
      <div className="relative flex h-7 overflow-hidden rounded-[3px] border border-foreground/30">
        {laid.map((s, i) => (
          <div
            key={i}
            className="border-r border-background last:border-r-0"
            style={{ width: `${(s.minutes / Math.max(shift, 1)) * 100}%`, background: fill(s.kind) }}
            title={`${s.kind} · ${s.minutes} min`}
          />
        ))}
      </div>
      {/* the derived half: driving since the last qualifying break */}
      <div className="relative mt-1 h-9 rounded-[2px] border border-foreground/15">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline
            points={laid
              .map((s) => `${(s.end / Math.max(shift, 1)) * 100},${100 - ((s.sinceBreak ?? 0) / Math.max(maxContinuousDriveMin * 1.15, 1)) * 100}`)
              .join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/70" style={{ bottom: `${(1 / 1.15) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>00:00</span>
        <span>dashed: {hm(maxContinuousDriveMin)} continuous</span>
        <span>{hm(shift)}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Driving</dt>
          <dd className="font-medium tabular-nums">{hm(drive)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Shift</dt>
          <dd className="font-medium tabular-nums">{hm(shift)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Breaks</dt>
          <dd className="font-medium tabular-nums">
            {qualifying.length}/{breaks.length}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Compliant</dt>
          <dd className="font-medium">{overRun || overDaily ? "no" : "yes"}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The lower trace is driving SINCE THE LAST QUALIFYING BREAK, which is the rule — a break shorter than{" "}
        {minBreakMin} minutes does not reset it, and {breaks.length - qualifying.length} of the{" "}
        {breaks.length} {plural(breaks.length, "break", "breaks")} here{" "}
        {breaks.length - qualifying.length === 1 ? "does" : "do"} not ·{" "}
        {overRun
          ? `the continuous limit is passed after ${hm(overRun.sinceBreak!)} of driving, which no list of tachograph events shows on its own`
          : "the continuous limit holds all day"}
        {overDaily ? ` · daily driving reaches ${hm(drive)}, over the ${hm(maxDailyDriveMin)} limit` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * LaneRate — spot against contract on each lane, with the ROUND TRIP
 * economics derived. A lane is priced one way and run both ways, and
 * the return leg is what decides whether it is worth taking.
 * ------------------------------------------------------------------ */
export function LaneRate({
  lanes,
  costPerMile,
  className = "",
}: {
  lanes: {
    name: string
    miles: number
    contractRate: number
    spotRate: number
    /** what a backload on the return leg realistically pays */
    backloadRate?: number
  }[]
  costPerMile: number
  className?: string
}) {
  const rows = lanes
    .map((l) => {
      const legCost = l.miles * costPerMile
      const back = l.backloadRate ?? 0
      // out and back: both legs cost, one or both earn
      const roundCost = legCost * 2
      const contractRound = l.contractRate + back
      const spotRound = l.spotRate + back
      return {
        ...l,
        legCost,
        roundCost,
        contractRound,
        spotRound,
        contractMargin: contractRound - roundCost,
        spotMargin: spotRound - roundCost,
        gap: (l.spotRate - l.contractRate) / Math.max(l.contractRate, 1e-9),
        needsBackload: l.contractRate < roundCost,
      }
    })
    .sort((a, b) => b.gap - a.gap)
  const max = Math.max(...rows.map((r) => Math.max(r.spotRound, r.contractRound, r.roundCost)))
  const spotAbove = rows.filter((r) => r.spotRate > r.contractRate)
  const needBack = rows.filter((r) => r.needsBackload)
  const losers = rows.filter((r) => r.contractMargin < 0)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.miles} miles · contract {money(r.contractRate)} · spot {money(r.spotRate)}
              </span>
            </div>
            {/* two LANES rather than two overlapping bars: a lane priced above
                spot is ordinary on a trunk route, and drawn one over the other
                the wider fill hides the narrower one entirely */}
            <div className="relative mt-0.5 h-5 rounded-[2px] bg-muted">
              <div className="absolute inset-x-0 top-0.5 h-2 rounded-[1px] bg-foreground/22" style={{ width: `${(r.spotRound / max) * 100}%` }} title={`spot round trip ${money(r.spotRound)}`} />
              <div className="absolute inset-x-0 bottom-0.5 h-2 rounded-[1px] bg-foreground/55" style={{ width: `${(r.contractRound / max) * 100}%` }} title={`contract round trip ${money(r.contractRound)}`} />
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${clamp((r.roundCost / max) * 100, 0, 99)}%` }} title={`round trip cost ${money(r.roundCost)}`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              round trip costs {money(r.roundCost)} · contract{" "}
              {r.contractMargin >= 0 ? "+" : ""}
              {money(r.contractMargin)}
              {r.backloadRate ? ` including ${money(r.backloadRate)} back` : " with nothing back"}
              {r.needsBackload ? " — needs a backload to stand up" : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The mark is the ROUND TRIP cost, because a lane is priced one way and run both ways · {needBack.length} of{" "}
        {rows.length} lanes cannot cover the return leg from the outbound rate alone, so the backload is the trade
        rather than the rate ·{" "}
        {spotAbove.length === 0
          ? "spot is below contract on every lane, so the book is worth defending"
          : `spot is above contract on ${spotAbove.length} ${plural(spotAbove.length, "lane", "lanes")}, up to ${(rows[0].gap * 100).toFixed(0)}% on ${rows[0].name}`}
        {losers.length > 0 ? `, and ${losers.length} ${plural(losers.length, "lane loses", "lanes lose")} money as contracted` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * FuelSurcharge — what the mechanism recovers against what fuel
 * actually did. A surcharge lags by construction, and the LAG is the
 * cost, which a table of percentages never shows.
 * ------------------------------------------------------------------ */
export function FuelSurcharge({
  months,
  baselinePence,
  fuelShareOfCost,
  height = 190,
  className = "",
}: {
  /** the pump price each month and the surcharge actually applied */
  months: { label: string; pencePerLitre: number; surchargePercent: number }[]
  /** the price the contract was written at */
  baselinePence: number
  /** fuel as a share of the total cost of running a vehicle */
  fuelShareOfCost: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!months.length) return null

  const rows = months.map((m) => {
    // the surcharge the formula SHOULD produce at this month's price
    const due = ((m.pencePerLitre - baselinePence) / Math.max(baselinePence, 1e-9)) * fuelShareOfCost * 100
    return { ...m, due, gap: m.surchargePercent - due }
  })
  const under = rows.filter((r) => r.gap < -0.25)
  const over = rows.filter((r) => r.gap > 0.25)
  const meanGap = rows.reduce((a, r) => a + r.gap, 0) / Math.max(rows.length, 1)
  const worst = rows.reduce((a, r) => (r.gap < a.gap ? r : a), rows[0])
  const lo = Math.min(0, ...rows.map((r) => Math.min(r.due, r.surchargePercent))) - 1
  const hi = Math.max(...rows.map((r) => Math.max(r.due, r.surchargePercent))) + 1
  const px = (i: number) => (rows.length < 2 ? 50 : (i / (rows.length - 1)) * 100)
  const py = (v: number) => 100 - ((v - lo) / Math.max(hi - lo, 1e-9)) * 94 - 3

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon
            points={`${rows.map((r, i) => `${px(i)},${py(r.due)}`).join(" ")} ${[...rows].reverse().map((r, i) => `${px(rows.length - 1 - i)},${py(r.surchargePercent)}`).join(" ")}`}
            fill="currentColor"
            opacity={0.15}
          />
          <line x1={0} y1={py(0)} x2={100} y2={py(0)} stroke="currentColor" strokeWidth={0.6} opacity={0.4} />
          <polyline points={rows.map((r, i) => `${px(i)},${py(r.due)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 2" vectorEffect="non-scaling-stroke" />
          <polyline points={rows.map((r, i) => `${px(i)},${py(r.surchargePercent)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-0.5 flex text-[9px] text-muted-foreground">
        {rows.map((r) => (
          <span key={r.label} className="min-w-0 flex-1 truncate text-center">
            {r.label}
          </span>
        ))}
      </div>
      <div className="mt-1 text-center text-[10px] text-muted-foreground">solid: applied · dashed: due at that month's price</div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Mean gap</dt>
          <dd className="font-medium tabular-nums">
            {meanGap >= 0 ? "+" : ""}
            {meanGap.toFixed(2)} pts
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Under-recovered</dt>
          <dd className="font-medium tabular-nums">{under.length} mo</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Over-recovered</dt>
          <dd className="font-medium tabular-nums">{over.length} mo</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Worst month</dt>
          <dd className="font-medium">{worst.label}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The dashed line is what the formula OWES at each month's pump price and the solid one is what was billed, so
        the shaded gap is the lag · a surcharge reviewed monthly is always behind a price that moves weekly, and the
        cost of that is {Math.abs(meanGap).toFixed(2)} points on average — {worst.label} was{" "}
        {Math.abs(worst.gap).toFixed(2)} points short, which on a{" "}
        {(fuelShareOfCost * 100).toFixed(0)}% fuel share is real money on every load that month
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PalletNetwork — sending a part load through a hub against running
 * it direct. The hub wins on small consignments and loses on big
 * ones, and the CROSSOVER is what a traffic office needs.
 * ------------------------------------------------------------------ */
export function PalletNetwork({
  consignments,
  hubRatePerPallet,
  directCostPerMile,
  vehiclePallets = 26,
  className = "",
}: {
  consignments: { name: string; pallets: number; miles: number }[]
  hubRatePerPallet: number
  directCostPerMile: number
  vehiclePallets?: number
  className?: string
}) {
  const rows = consignments
    .map((c) => {
      const hub = c.pallets * hubRatePerPallet
      // direct means running there and back with one customer's freight
      const direct = c.miles * 2 * directCostPerMile
      return {
        ...c,
        hub,
        direct,
        cheaper: hub <= direct ? ("hub" as const) : ("direct" as const),
        saving: Math.abs(hub - direct),
        // the pallet count at which the hub stops being cheaper on this run
        crossover: direct / Math.max(hubRatePerPallet, 1e-9),
        fill: c.pallets / Math.max(vehiclePallets, 1),
      }
    })
    .sort((a, b) => a.pallets - b.pallets)
  const max = Math.max(...rows.map((r) => Math.max(r.hub, r.direct)))
  const viaHub = rows.filter((r) => r.cheaper === "hub")
  const saved = rows.reduce((a, r) => a + r.saving, 0)
  const meanCross = rows.reduce((a, r) => a + Math.min(r.crossover, vehiclePallets), 0) / Math.max(rows.length, 1)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.pallets} {plural(r.pallets, "pallet", "pallets")} · {r.miles} miles ·{" "}
                {(r.fill * 100).toFixed(0)}% of a trailer
              </span>
            </div>
            <div className="mt-0.5 space-y-px">
              <div className="h-2.5 rounded-[1px] bg-muted">
                <div
                  className="h-full rounded-[1px]"
                  style={{
                    width: `${(r.hub / max) * 100}%`,
                    background: r.cheaper === "hub" ? "currentColor" : "color-mix(in oklch, currentColor 26%, transparent)",
                  }}
                  title={`hub ${money(r.hub)}`}
                />
              </div>
              <div className="h-2.5 rounded-[1px] bg-muted">
                <div
                  className="h-full rounded-[1px]"
                  style={{
                    width: `${(r.direct / max) * 100}%`,
                    background: r.cheaper === "direct" ? "currentColor" : "color-mix(in oklch, currentColor 26%, transparent)",
                  }}
                  title={`direct ${money(r.direct)}`}
                />
              </div>
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              hub {money(r.hub)} · direct {money(r.direct)} → {r.cheaper}, saving {money(r.saving)} · crosses over at{" "}
              {r.crossover.toFixed(1)} pallets
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Upper bar is the pallet network at {money(hubRatePerPallet)} a pallet, lower is running it direct, and the
        filled one is the cheaper · the CROSSOVER is derived per consignment, because it depends on the distance —
        it averages {meanCross.toFixed(1)} pallets here, and a traffic office deciding by habit gets it wrong at both
        ends · {viaHub.length} of {rows.length} should go through the hub, worth {money(saved)} across the day
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * VehicleUtilisation — where a vehicle's day goes, with the LOADED
 * share derived. A truck is a fixed cost per day and only one part of
 * that day is billable, which a mileage report cannot show.
 * ------------------------------------------------------------------ */
export function VehicleUtilisation({
  days,
  dailyFixedCost,
  className = "",
}: {
  /** minutes in each state, per vehicle-day */
  days: { name: string; loaded: number; empty: number; loading: number; waiting: number; idle: number }[]
  dailyFixedCost?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!days.length) return null

  const parts: [keyof (typeof days)[number], string, string][] = [
    ["loaded", "Loaded", "currentColor"],
    ["empty", "Empty", "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"],
    ["loading", "Loading", "color-mix(in oklch, currentColor 48%, transparent)"],
    ["waiting", "Waiting", "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 6px)"],
    ["idle", "Idle", "color-mix(in oklch, currentColor 10%, transparent)"],
  ]
  const rows = days.map((d) => {
    const total = parts.reduce((a, [k]) => a + (d[k] as number), 0)
    return { ...d, total, utilisation: d.loaded / Math.max(total, 1) }
  })
  const totals = parts.map(([k]) => rows.reduce((a, r) => a + (r[k] as number), 0))
  const grand = totals.reduce((a, v) => a + v, 0)
  const loadedShare = totals[0] / Math.max(grand, 1)
  const waitShare = totals[3] / Math.max(grand, 1)
  const max = Math.max(...rows.map((r) => r.total))
  const worst = rows.reduce((a, r) => (r.utilisation < a.utilisation ? r : a), rows[0])
  const hm = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}`

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {hm(r.total)} · {(r.utilisation * 100).toFixed(0)}% loaded
              </span>
            </div>
            <div className="mt-0.5 flex h-4 rounded-[2px] border border-foreground/20" style={{ width: `${(r.total / max) * 100}%` }}>
              {parts.map(([k, label, bg]) => (
                <div
                  key={label}
                  className="min-w-0 first:rounded-l-[2px] last:rounded-r-[2px]"
                  style={{ width: `${((r[k] as number) / Math.max(r.total, 1)) * 100}%`, background: bg }}
                  title={`${label}: ${hm(r[k] as number)}`}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground tabular-nums">
        {parts.map(([, label, bg], i) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25" style={{ background: bg }} />
            {label} · {((totals[i] / Math.max(grand, 1)) * 100).toFixed(0)}%
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Only the solid part is BILLABLE — {(loadedShare * 100).toFixed(0)}% of the fleet's{" "}
        {(grand / 60).toFixed(0)} vehicle-hours · a vehicle is a fixed cost whether it moves or not
        {dailyFixedCost ? `, ${money(dailyFixedCost)} a day` : ""}, so the {(waitShare * 100).toFixed(0)}% spent
        waiting at somebody else's gate
        {dailyFixedCost ? ` costs ${money(dailyFixedCost * rows.length * waitShare)} across these vehicles` : " is the largest recoverable item here"}{" "}
        · {worst.name} is the weakest at {(worst.utilisation * 100).toFixed(0)}%, which a mileage report shows as a
        quiet day rather than a lost one
      </p>
    </div>
  )
}
