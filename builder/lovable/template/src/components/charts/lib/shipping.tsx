/**
 * Maritime and freight primitives — port calls, laytime, bunker consumption,
 * container utilisation, freight indices and route deviation.
 *
 * Demurrage and despatch, the cubic-law fuel saving from slow steaming, the
 * stowage utilisation that is actually binding (weight or slots), the index
 * volatility and the added distance are all DERIVED. Laytime that takes its
 * own demurrage figure as a prop is an invoice, not a calculation.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) => "$" + Math.round(Math.abs(v)).toLocaleString("en-US")

/* ------------------------------------------------------------------ *
 * PortCall — the call broken into its phases, with the share of time
 * actually spent working cargo derived.
 * ------------------------------------------------------------------ */
export function PortCall({
  phases,
  className = "",
}: {
  /** in order; hours is the duration of that phase */
  phases: { name: string; hours: number; productive?: boolean }[]
  className?: string
}) {
  const total = phases.reduce((a, p) => a + p.hours, 0)
  const working = phases.filter((p) => p.productive).reduce((a, p) => a + p.hours, 0)
  const idle = total - working
  let cursor = 0
  const laid = phases.map((p) => {
    const from = cursor
    cursor += p.hours
    return { ...p, from, to: cursor }
  })
  const worstIdle = laid.filter((p) => !p.productive).reduce((a, p) => (p.hours > a.hours ? p : a), { name: "—", hours: 0, from: 0, to: 0, productive: false })

  return (
    <div className={className}>
      <div className="flex h-8 w-full overflow-hidden rounded-[3px] border border-foreground/30">
        {laid.map((p) => (
          <div
            key={p.name}
            className="border-r border-foreground/25 last:border-r-0"
            style={{
              width: `${(p.hours / Math.max(total, 1e-9)) * 100}%`,
              background: p.productive
                ? "color-mix(in oklch, currentColor 48%, transparent)"
                : "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 5px)",
            }}
            title={`${p.name}: ${p.hours} h`}
          />
        ))}
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {laid.map((p) => (
          <li key={p.name} className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-[2px] border border-foreground/35"
              style={{
                background: p.productive
                  ? "color-mix(in oklch, currentColor 48%, transparent)"
                  : "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 5px)",
              }}
              aria-hidden
            />
            <span className="w-32 shrink-0 truncate">{p.name}</span>
            <span className="text-muted-foreground">
              {p.hours} h · hour {p.from.toFixed(0)}–{p.to.toFixed(0)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10px] text-muted-foreground tabular-nums">
        {total.toFixed(0)} h alongside, {working.toFixed(0)} h of it working cargo (
        {((working / Math.max(total, 1e-9)) * 100).toFixed(0)}%) · the longest unproductive phase is {worstIdle.name} at{" "}
        {worstIdle.hours} h, and {idle.toFixed(0)} h of idle time is what the charterer is paying for
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Laytime — the statement of facts against allowed laytime. Demurrage
 * or despatch is SOLVED, never supplied.
 * ------------------------------------------------------------------ */
export function Laytime({
  allowedHours,
  events,
  demurrageRatePerDay,
  despatchRatePerDay,
  className = "",
}: {
  allowedHours: number
  /** counting: whether this period counts against laytime */
  events: { name: string; hours: number; counting: boolean }[]
  demurrageRatePerDay: number
  /** conventionally half the demurrage rate; defaults to that */
  despatchRatePerDay?: number
  className?: string
}) {
  const counted = events.filter((e) => e.counting).reduce((a, e) => a + e.hours, 0)
  const excepted = events.filter((e) => !e.counting).reduce((a, e) => a + e.hours, 0)
  const over = counted - allowedHours
  const despatchRate = despatchRatePerDay ?? demurrageRatePerDay / 2
  const amount = over > 0 ? (over / 24) * demurrageRatePerDay : (-over / 24) * despatchRate

  const elapsed = counted + excepted
  const axis = Math.max(allowedHours, counted) * 1.08
  let run = 0
  const laid = events.map((e) => {
    const from = e.counting ? run : run
    if (e.counting) run += e.hours
    return { ...e, from, to: e.counting ? run : from }
  })

  return (
    <div className={className}>
      <div className="relative h-8 rounded-[3px] border border-foreground/30 bg-muted">
        {laid
          .filter((e) => e.counting)
          .map((e) => (
            <div
              key={e.name}
              className="absolute inset-y-0 border-r border-foreground/30"
              style={{ left: `${(e.from / axis) * 100}%`, width: `${(e.hours / axis) * 100}%`, background: "color-mix(in oklch, currentColor 40%, transparent)" }}
              title={`${e.name}: ${e.hours} h counting`}
            />
          ))}
        {over > 0 && (
          <div
            className="absolute inset-y-0 border border-foreground"
            style={{ left: `${(allowedHours / axis) * 100}%`, width: `${(over / axis) * 100}%`, background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" }}
          />
        )}
        <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${(allowedHours / axis) * 100}%` }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] text-muted-foreground tabular-nums">
        <span>0 h</span>
        <span>allowed {allowedHours} h</span>
        <span>{axis.toFixed(0)} h</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {events.map((e) => (
          <li key={e.name} className="flex items-center gap-2">
            <span aria-hidden className="w-3">
              {e.counting ? "●" : "○"}
            </span>
            <span className="w-40 shrink-0 truncate">{e.name}</span>
            <span className="text-muted-foreground">
              {e.hours} h {e.counting ? "counting" : "excepted"}
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Laytime used</dt>
          <dd className="font-medium tabular-nums">{counted.toFixed(1)} h</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{over > 0 ? "On demurrage" : "Saved"}</dt>
          <dd className="font-medium tabular-nums">{Math.abs(over).toFixed(1)} h</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{over > 0 ? "Demurrage" : "Despatch"}</dt>
          <dd className="font-medium tabular-nums">{money(amount)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {elapsed.toFixed(0)} h elapsed of which {excepted.toFixed(0)} h is excepted and does not count ·{" "}
        {over > 0
          ? `${(over / 24).toFixed(2)} days over at ${money(demurrageRatePerDay)}/day — once on demurrage, always on demurrage, so the exceptions stop applying`
          : `${(-over / 24).toFixed(2)} days saved at the despatch rate of ${money(despatchRate)}/day`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * BunkerConsumption — fuel against speed. The cubic law means a small
 * speed cut is a large saving, and the saving is COMPUTED from the
 * reference point rather than tabulated.
 * ------------------------------------------------------------------ */
export function BunkerConsumption({
  referenceKnots,
  referenceTonnesPerDay,
  distanceNm,
  fuelPricePerTonne,
  charterCostPerDay = 0,
  height = 200,
  className = "",
}: {
  referenceKnots: number
  referenceTonnesPerDay: number
  distanceNm: number
  fuelPricePerTonne: number
  /** the daily cost of the ship, which is what makes slow steaming stop paying */
  charterCostPerDay?: number
  height?: number
  className?: string
}) {
  const speeds = Array.from({ length: 40 }, (_, i) => referenceKnots * (0.6 + (i / 39) * 0.5))
  const rows = speeds.map((v) => {
    const tpd = referenceTonnesPerDay * Math.pow(v / referenceKnots, 3)
    const days = distanceNm / (v * 24)
    const fuel = tpd * days
    return { v, tpd, days, fuel, fuelCost: fuel * fuelPricePerTonne, total: fuel * fuelPricePerTonne + days * charterCostPerDay }
  })
  const cheapest = rows.reduce((a, r) => (r.total < a.total ? r : a), rows[0])
  const atReference = rows.reduce((a, r) => (Math.abs(r.v - referenceKnots) < Math.abs(a.v - referenceKnots) ? r : a), rows[0])
  const saving = atReference.total - cheapest.total

  const maxTotal = Math.max(...rows.map((r) => r.total))
  const px = (v: number) => ((v - speeds[0]) / (speeds[speeds.length - 1] - speeds[0])) * 100
  const py = (c: number) => 100 - (c / maxTotal) * 94 - 3

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline points={rows.map((r) => `${px(r.v)},${py(r.fuelCost)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.1} strokeDasharray="4 2" vectorEffect="non-scaling-stroke" />
          {charterCostPerDay > 0 && (
            <polyline points={rows.map((r) => `${px(r.v)},${py(r.days * charterCostPerDay)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="1 2" vectorEffect="non-scaling-stroke" />
          )}
          <polyline points={rows.map((r) => `${px(r.v)},${py(r.total)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          <line x1={px(cheapest.v)} y1={0} x2={px(cheapest.v)} y2={100} stroke="currentColor" strokeWidth={0.5} opacity={0.55} />
          <line x1={px(referenceKnots)} y1={0} x2={px(referenceKnots)} y2={100} stroke="currentColor" strokeWidth={0.4} strokeDasharray="2 2" opacity={0.45} />
        </svg>
        <span
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground bg-background"
          style={{ left: `${px(cheapest.v)}%`, top: `${py(cheapest.total)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{speeds[0].toFixed(1)} kn</span>
        <span>{speeds[speeds.length - 1].toFixed(1)} kn</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
        <span className="flex items-center gap-1.5">
          <svg width={18} height={6} aria-hidden>
            <line x1={0} y1={3} x2={18} y2={3} stroke="currentColor" strokeWidth={1.6} />
          </svg>
          total
        </span>
        <span className="flex items-center gap-1.5">
          <svg width={18} height={6} aria-hidden>
            <line x1={0} y1={3} x2={18} y2={3} stroke="currentColor" strokeWidth={1.4} strokeDasharray="4 2" />
          </svg>
          fuel
        </span>
        {charterCostPerDay > 0 && (
          <span className="flex items-center gap-1.5">
            <svg width={18} height={6} aria-hidden>
              <line x1={0} y1={3} x2={18} y2={3} stroke="currentColor" strokeWidth={1.4} strokeDasharray="1 2" />
            </svg>
            time charter
          </span>
        )}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Fuel goes as the cube of speed, so {referenceKnots} kn → {cheapest.v.toFixed(1)} kn cuts burn by{" "}
        {(100 - (cheapest.fuel / atReference.fuel) * 100).toFixed(0)}% and adds{" "}
        {(cheapest.days - atReference.days).toFixed(1)} days ·{" "}
        {charterCostPerDay > 0
          ? `net ${saving >= 0 ? "saving" : "cost"} ${money(saving)} once the ship's ${money(charterCostPerDay)}/day is counted — that daily cost is what stops slow steaming going all the way down`
          : `${money(saving)} saved on fuel alone`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ContainerUtilisation — slots against deadweight, so the constraint
 * that is actually binding is visible instead of assumed.
 * ------------------------------------------------------------------ */
export function ContainerUtilisation({
  legs,
  slotCapacityTeu,
  deadweightTonnes,
  className = "",
}: {
  legs: { name: string; teu: number; tonnes: number }[]
  slotCapacityTeu: number
  deadweightTonnes: number
  className?: string
}) {
  const rows = legs.map((l) => {
    const slots = l.teu / Math.max(1, slotCapacityTeu)
    const weight = l.tonnes / Math.max(1, deadweightTonnes)
    return { ...l, slots, weight, binding: slots >= weight ? ("slots" as const) : ("weight" as const), used: Math.max(slots, weight) }
  })
  const weightBound = rows.filter((r) => r.binding === "weight")
  const mean = rows.reduce((a, r) => a + r.used, 0) / Math.max(1, rows.length)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.teu.toLocaleString()} TEU · {r.tonnes.toLocaleString()} t
              </span>
            </div>
            <div className="mt-0.5 space-y-px">
              <div className="relative h-3 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground/45" style={{ width: `${clamp(r.slots * 100, 0, 100)}%` }} />
                {r.binding === "slots" && <span className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: `${clamp(r.slots * 100, 0, 100)}%` }} />}
              </div>
              <div className="relative h-3 rounded-[1px] bg-muted">
                <div
                  className="h-full rounded-[1px] border border-foreground/50"
                  style={{ width: `${clamp(r.weight * 100, 0, 100)}%`, background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 5px)" }}
                />
                {r.binding === "weight" && <span className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: `${clamp(r.weight * 100, 0, 100)}%` }} />}
              </div>
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.slots * 100).toFixed(0)}% of slots, {(r.weight * 100).toFixed(0)}% of deadweight — {r.binding} bind
              first
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Solid bar is slot utilisation, hatched is deadweight · mean {(mean * 100).toFixed(0)}% on the binding
        constraint ·{" "}
        {weightBound.length
          ? `${weightBound.map((r) => r.name).join(", ")} ${weightBound.length === 1 ? "runs" : "run"} out of deadweight before running out of slots, so counting empty slots there understates how full the ship is`
          : "every leg fills its slots before its deadweight"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * FreightIndex — an index series with volatility and drawdown derived,
 * because the level alone tells a charterer nothing about risk.
 * ------------------------------------------------------------------ */
export function FreightIndex({
  points,
  height = 200,
  className = "",
}: {
  points: { label: string; value: number }[]
  height?: number
  className?: string
}) {
  const values = points.map((p) => p.value)
  const returns = values.map((v, i) => (i === 0 ? 0 : Math.log(v / values[i - 1]))).slice(1)
  const meanR = returns.reduce((a, r) => a + r, 0) / Math.max(1, returns.length)
  const sd = Math.sqrt(returns.reduce((a, r) => a + (r - meanR) ** 2, 0) / Math.max(1, returns.length - 1))
  const annualised = sd * Math.sqrt(52) * 100

  let peak = values[0]
  let maxDd = 0
  let ddAt = 0
  values.forEach((v, i) => {
    peak = Math.max(peak, v)
    const dd = (peak - v) / peak
    if (dd > maxDd) {
      maxDd = dd
      ddAt = i
    }
  })

  const max = Math.max(...values) * 1.05
  const min = Math.min(...values) * 0.95
  const px = (i: number) => (i / Math.max(1, values.length - 1)) * 100
  const py = (v: number) => 100 - ((v - min) / (max - min)) * 100
  const mean = values.reduce((a, v) => a + v, 0) / values.length

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(mean)} x2={100} y2={py(mean)} stroke="currentColor" strokeWidth={0.4} strokeDasharray="3 2" opacity={0.5} />
          <polygon points={`0,100 ${values.map((v, i) => `${px(i)},${py(v)}`).join(" ")} 100,100`} fill="currentColor" opacity={0.11} />
          <polyline points={values.map((v, i) => `${px(i)},${py(v)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
          <line x1={px(ddAt)} y1={0} x2={px(ddAt)} y2={100} stroke="currentColor" strokeWidth={0.5} opacity={0.5} />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Latest</dt>
          <dd className="font-medium tabular-nums">{values[values.length - 1].toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mean</dt>
          <dd className="font-medium tabular-nums">{Math.round(mean).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Volatility</dt>
          <dd className="font-medium tabular-nums">{annualised.toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Max drawdown</dt>
          <dd className="font-medium tabular-nums">{(maxDd * 100).toFixed(0)}%</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Annualised volatility of {annualised.toFixed(0)}% is what makes a fixed-rate contract worth paying for · the
        deepest fall was {(maxDd * 100).toFixed(0)}% into {points[ddAt]?.label}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RouteDeviation — the great-circle distance against the route actually
 * sailed, with the extra distance, time and fuel derived.
 * ------------------------------------------------------------------ */
export function RouteDeviation({
  routes,
  speedKnots,
  tonnesPerDay,
  fuelPricePerTonne,
  className = "",
}: {
  routes: { name: string; directNm: number; sailedNm: number; reason?: string }[]
  speedKnots: number
  tonnesPerDay: number
  fuelPricePerTonne: number
  className?: string
}) {
  const rows = routes
    .map((r) => {
      const extraNm = r.sailedNm - r.directNm
      const extraDays = extraNm / Math.max(1e-9, speedKnots * 24)
      return { ...r, extraNm, extraDays, extraCost: extraDays * tonnesPerDay * fuelPricePerTonne, ratio: r.sailedNm / Math.max(1, r.directNm) }
    })
    .sort((a, b) => b.ratio - a.ratio)
  const max = Math.max(...rows.map((r) => r.sailedNm))
  const totalCost = rows.reduce((a, r) => a + r.extraCost, 0)
  const worst = rows[0]

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.directNm.toLocaleString()} → {r.sailedNm.toLocaleString()} nm
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-l-[2px] bg-foreground/50" style={{ width: `${(r.directNm / max) * 100}%` }} />
              <div
                className="absolute inset-y-0 border-y border-r border-foreground/60"
                style={{
                  left: `${(r.directNm / max) * 100}%`,
                  width: `${(r.extraNm / max) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                }}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              +{r.extraNm.toLocaleString()} nm ({((r.ratio - 1) * 100).toFixed(1)}%) · +{r.extraDays.toFixed(1)} days ·{" "}
              {money(r.extraCost)}
              {r.reason ? ` · ${r.reason}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Solid is the great-circle distance, hatched is the deviation actually sailed · {worst.name} is worst at{" "}
        {((worst.ratio - 1) * 100).toFixed(1)}% longer, and the deviations together cost {money(totalCost)} in fuel at{" "}
        {speedKnots} kn
      </p>
    </div>
  )
}
