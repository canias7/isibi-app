/**
 * Contact-centre primitives — staffing, service level, abandonment,
 * shrinkage, occupancy, forecast accuracy and adherence.
 *
 * The agents Erlang C actually requires, the service level a given
 * headcount buys, the calls lost before answer, the hours shrinkage
 * removes, the occupancy that follows and the forecast error are all
 * DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) =>
  "£" + (Math.abs(v) < 10 ? Math.abs(v).toFixed(2) : Math.round(Math.abs(v)).toLocaleString("en-GB"))

/** Erlang C: the probability an arriving call has to wait. */
function erlangC(agents: number, traffic: number) {
  const n = Math.max(1, Math.floor(agents))
  if (traffic >= n) return 1
  let sum = 0
  let term = 1
  for (let k = 0; k < n; k++) {
    if (k > 0) term = (term * traffic) / k
    sum += term
  }
  const last = (term * traffic) / n
  const top = last * (n / (n - traffic))
  return top / (sum + top)
}

/** the fraction answered within the target, given agents and handling time */
function serviceLevel(agents: number, traffic: number, ahtS: number, targetS: number) {
  const pw = erlangC(agents, traffic)
  const n = Math.max(1, Math.floor(agents))
  if (traffic >= n) return 0
  return clamp(1 - pw * Math.exp((-(n - traffic) * targetS) / Math.max(ahtS, 1e-9)), 0, 1)
}

/* ------------------------------------------------------------------ *
 * ErlangStaffing — agents required by half hour. The point is that
 * requirement is NOT proportional to volume: the queue is non-linear,
 * so a quiet interval still needs a floor.
 * ------------------------------------------------------------------ */
export function ErlangStaffing({
  intervals,
  ahtSeconds,
  targetSeconds = 20,
  targetServiceLevel = 0.8,
  intervalMinutes = 30,
  className = "",
}: {
  intervals: { label: string; calls: number; scheduled?: number }[]
  ahtSeconds: number
  targetSeconds?: number
  targetServiceLevel?: number
  intervalMinutes?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!intervals.length) return null

  const rows = intervals.map((iv) => {
    const traffic = (iv.calls * ahtSeconds) / (intervalMinutes * 60)
    let need = Math.max(1, Math.ceil(traffic))
    while (serviceLevel(need, traffic, ahtSeconds, targetSeconds) < targetServiceLevel && need < 400) need++
    const sl = iv.scheduled === undefined ? null : serviceLevel(iv.scheduled, traffic, ahtSeconds, targetSeconds)
    return { ...iv, traffic, need, sl, gap: iv.scheduled === undefined ? null : iv.scheduled - need }
  })
  const maxCalls = Math.max(...rows.map((r) => r.calls))
  const maxNeed = Math.max(...rows.map((r) => Math.max(r.need, r.scheduled ?? 0)))
  const short = rows.filter((r) => r.gap !== null && r.gap < 0)
  const busiest = rows.reduce((a, r) => (r.calls > a.calls ? r : a), rows[0])
  const quietest = rows.reduce((a, r) => (r.calls < a.calls ? r : a), rows[0])
  const perCall = busiest.need / Math.max(busiest.calls, 1)
  const perCallQuiet = quietest.need / Math.max(quietest.calls, 1)

  return (
    <div className={className}>
      <div className="flex items-stretch gap-px rounded-[2px] border border-foreground/15" style={{ height: 120 }}>
        {rows.map((r) => (
          <div key={r.label} className="relative min-w-0 flex-1" title={`${r.label}: ${r.calls} calls, ${r.need} agents needed`}>
            <div className="absolute inset-x-0 bottom-0" style={{ height: `${(r.calls / maxCalls) * 100}%`, background: "color-mix(in oklch, currentColor 18%, transparent)" }} />
            <div className="absolute inset-x-[15%] bottom-0" style={{ height: `${(r.need / maxNeed) * 100}%`, background: "currentColor" }} />
            {r.scheduled !== undefined && (
              <span className="absolute inset-x-0 border-t-2 border-foreground/70" style={{ bottom: `${(r.scheduled / maxNeed) * 100}%` }} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex gap-px text-[9px] text-muted-foreground">
        {rows.map((r, i) => (
          <span key={r.label} className="min-w-0 flex-1 truncate text-center">
            {i % 2 === 0 ? r.label : ""}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is calls, solid is agents REQUIRED by Erlang C, and the rule is the roster · requirement is not
        proportional to volume — {busiest.label} needs {perCall.toFixed(3)} agents a call and {quietest.label} needs{" "}
        {perCallQuiet.toFixed(3)}, {(perCallQuiet / Math.max(perCall, 1e-9)).toFixed(1)}× as many, because a queue with
        few servers is far worse than a queue with many ·{" "}
        {short.length === 0
          ? `every interval is covered for ${(targetServiceLevel * 100).toFixed(0)}% in ${targetSeconds} seconds`
          : `${short.length} interval${short.length === 1 ? " is" : "s are"} short, the worst by ${Math.abs(Math.min(...short.map((s) => s.gap!)))} agents`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ServiceLevelCurve — service level against headcount. The curve is
 * a cliff, and the cliff is why "one more agent" is sometimes worth
 * twenty points and sometimes worth nothing.
 * ------------------------------------------------------------------ */
export function ServiceLevelCurve({
  calls,
  ahtSeconds,
  targetSeconds = 20,
  intervalMinutes = 30,
  targetServiceLevel = 0.8,
  agentCostPerHour,
  height = 200,
  className = "",
}: {
  calls: number
  ahtSeconds: number
  targetSeconds?: number
  intervalMinutes?: number
  targetServiceLevel?: number
  agentCostPerHour?: number
  height?: number
  className?: string
}) {
  const traffic = (calls * ahtSeconds) / (intervalMinutes * 60)
  const from = Math.max(1, Math.ceil(traffic))
  const rows = Array.from({ length: 14 }, (_, i) => {
    const n = from + i
    return { n, sl: serviceLevel(n, traffic, ahtSeconds, targetSeconds), occupancy: clamp(traffic / n, 0, 1) }
  })
  const hit = rows.find((r) => r.sl >= targetServiceLevel)
  // a MARGINAL gain needs a previous agent, so the first point has none — it is
  // not a gain of its own absolute level, which would always win
  const gains = rows.slice(1).map((r, i) => r.sl - rows[i].sl)
  const bestGain = Math.max(...gains)
  const bestAt = rows[gains.indexOf(bestGain) + 1]
  const px = (i: number) => (i / (rows.length - 1)) * 100
  const py = (v: number) => 100 - v * 94 - 3

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(targetServiceLevel)} x2={100} y2={py(targetServiceLevel)} stroke="currentColor" strokeWidth={0.9} strokeDasharray="4 2" />
          <polyline points={rows.map((r, i) => `${px(i)},${py(r.sl)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          <polyline points={rows.map((r, i) => `${px(i)},${py(r.occupancy)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.2} strokeDasharray="2 2" opacity={0.6} vectorEffect="non-scaling-stroke" />
        </svg>
        {hit && (
          <span className="absolute inset-y-0 w-px bg-foreground/60" style={{ left: `${px(rows.indexOf(hit))}%` }} title={`${hit.n} agents`} />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{rows[0].n} agents</span>
        <span>solid service level · dotted occupancy</span>
        <span>{rows[rows.length - 1].n}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Traffic</dt>
          <dd className="font-medium tabular-nums">{traffic.toFixed(1)} erlangs</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Need</dt>
          <dd className="font-medium tabular-nums">{hit ? hit.n : "> " + rows[rows.length - 1].n}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Occupancy</dt>
          <dd className="font-medium tabular-nums">{hit ? (hit.occupancy * 100).toFixed(0) + "%" : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Best agent</dt>
          <dd className="font-medium tabular-nums">#{bestAt.n}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The curve is a CLIFF, not a slope — agent {bestAt.n} buys {(bestGain * 100).toFixed(0)} points of service level
        and the one after it buys far less, which is why headcount arguments are unwinnable without this shape ·{" "}
        {hit
          ? `${hit.n} agents reach ${(targetServiceLevel * 100).toFixed(0)}% in ${targetSeconds} seconds at ${(hit.occupancy * 100).toFixed(0)}% occupancy`
          : `${rows[rows.length - 1].n} agents still miss the target`}
        {agentCostPerHour && hit ? ` · ${money(hit.n * agentCostPerHour)} an hour on the floor` : ""} · occupancy falls
        as service level rises, and no roster can maximise both
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AbandonCurve — how long callers wait before hanging up. Average
 * wait says nothing about abandonment; the shape of patience does.
 * ------------------------------------------------------------------ */
export function AbandonCurve({
  buckets,
  targetSeconds,
  height = 190,
  className = "",
}: {
  /** calls answered and abandoned in each wait band */
  buckets: { toSeconds: number; answered: number; abandoned: number }[]
  targetSeconds?: number
  height?: number
  className?: string
}) {
  // NOTHING TO DRAW IS NOT A CHART OF NOTHING. An empty array made every
  // scale here degenerate and wrote NaN into an SVG attribute, which the
  // browser drops — so the chart rendered as a blank box rather than as the
  // empty state the page around it is showing. `useRows` hands back `[]`
  // before the query settles and on every site whose owner has added nothing.
  if (!buckets.length) return null

  const rows = [...buckets].sort((a, b) => a.toSeconds - b.toSeconds)
  const total = rows.reduce((a, b) => a + b.answered + b.abandoned, 0)
  const abandoned = rows.reduce((a, b) => a + b.abandoned, 0)
  let cum = 0
  const withCum = rows.map((b) => {
    cum += b.abandoned
    return { ...b, cumAbandon: cum / Math.max(abandoned, 1), rate: b.abandoned / Math.max(b.answered + b.abandoned, 1) }
  })
  const max = Math.max(...rows.map((b) => b.answered + b.abandoned))
  // the wait by which half of all abandons have happened
  const median = withCum.find((b) => b.cumAbandon >= 0.5)
  const withinTarget =
    targetSeconds === undefined
      ? null
      : rows.filter((b) => b.toSeconds <= targetSeconds).reduce((a, b) => a + b.answered, 0) / Math.max(total, 1)

  return (
    <div className={className}>
      <div className="relative flex items-stretch gap-1" style={{ height }}>
        {withCum.map((b) => (
          <div key={b.toSeconds} className="relative min-w-0 flex-1" title={`to ${b.toSeconds}s: ${b.answered} answered, ${b.abandoned} abandoned`}>
            <div className="absolute inset-x-0 bottom-0 rounded-t-[1px]" style={{ height: `${(b.answered / max) * 100}%`, background: "color-mix(in oklch, currentColor 32%, transparent)" }} />
            <div
              className="absolute inset-x-0 rounded-t-[1px]"
              style={{
                bottom: `${(b.answered / max) * 100}%`,
                height: `${(b.abandoned / max) * 100}%`,
                background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                outline: "1px solid currentColor",
                outlineOffset: -1,
              }}
            />
          </div>
        ))}
        {targetSeconds !== undefined && (
          <span
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground"
            style={{ left: `${(withCum.findIndex((b) => b.toSeconds > targetSeconds) / withCum.length) * 100}%` }}
            title={`${targetSeconds}s target`}
          />
        )}
      </div>
      <div className="mt-0.5 flex gap-1 text-[9px] text-muted-foreground tabular-nums">
        {withCum.map((b) => (
          <span key={b.toSeconds} className="min-w-0 flex-1 truncate text-center">
            {b.toSeconds}s
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Abandon rate</dt>
          <dd className="font-medium tabular-nums">{((abandoned / Math.max(total, 1)) * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Half gone by</dt>
          <dd className="font-medium tabular-nums">{median ? `${median.toSeconds}s` : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{targetSeconds ? `Answered ≤${targetSeconds}s` : "Answered"}</dt>
          <dd className="font-medium tabular-nums">
            {withinTarget === null ? `${total - abandoned}` : `${(withinTarget * 100).toFixed(0)}%`}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched is calls that hung up · half of all abandons happen inside {median ? median.toSeconds : "—"} seconds,
        which is the number a queue announcement has to beat and one an AVERAGE wait time cannot produce · an average
        is computed over the callers who stayed, so improving it by driving the impatient ones away looks like progress
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ShrinkageBudget — paid hours against hours actually on the phone.
 * Rostering to the requirement without this is the single most
 * common reason a centre misses service level every day.
 * ------------------------------------------------------------------ */
export function ShrinkageBudget({
  categories,
  paidHours,
  requiredOnPhone,
  className = "",
}: {
  /** each non-productive category, in hours */
  categories: { name: string; hours: number; plannable: boolean }[]
  paidHours: number
  /** the on-phone hours the forecast says are needed */
  requiredOnPhone?: number
  className?: string
}) {
  const rows = [...categories].sort((a, b) => b.hours - a.hours)
  const total = rows.reduce((a, c) => a + c.hours, 0)
  const onPhone = paidHours - total
  const shrinkage = total / Math.max(paidHours, 1)
  const unplanned = rows.filter((c) => !c.plannable).reduce((a, c) => a + c.hours, 0)
  const needPaid = requiredOnPhone === undefined ? null : requiredOnPhone / Math.max(1 - shrinkage, 1e-9)
  const naive = requiredOnPhone ?? 0
  const max = Math.max(...rows.map((c) => c.hours))

  return (
    <div className={className}>
      <div className="mb-2 flex h-7 overflow-hidden rounded-[3px] border border-foreground/30">
        <div className="bg-foreground/25" style={{ width: `${(onPhone / paidHours) * 100}%` }} title={`on phone: ${onPhone.toFixed(0)} h`} />
        {rows.map((c, i) => (
          <div
            key={c.name}
            className="border-l border-background"
            style={{
              width: `${(c.hours / paidHours) * 100}%`,
              background: c.plannable
                ? `color-mix(in oklch, currentColor ${(84 - i * 9).toFixed(0)}%, transparent)`
                : "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
            }}
            title={`${c.name}: ${c.hours.toFixed(0)} h`}
          />
        ))}
      </div>
      <ul className="space-y-1 text-[10px] tabular-nums">
        {rows.map((c) => (
          <li key={c.name} className="flex items-center gap-2">
            <span aria-hidden className="w-3">
              {c.plannable ? "·" : "~"}
            </span>
            <span className="w-32 shrink-0 truncate">{c.name}</span>
            <div className="h-2 flex-1 rounded-[1px] bg-muted">
              <div className="h-full rounded-[1px] bg-foreground/60" style={{ width: `${(c.hours / max) * 100}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right text-muted-foreground">
              {c.hours.toFixed(0)} h · {((c.hours / paidHours) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Shrinkage is {(shrinkage * 100).toFixed(1)}% of {paidHours.toLocaleString()} paid hours, of which{" "}
        {((unplanned / Math.max(total, 1)) * 100).toFixed(0)}% is unplannable (hatched) ·{" "}
        {needPaid === null
          ? `only ${onPhone.toFixed(0)} hours reach the phone`
          : `${requiredOnPhone!.toLocaleString()} on-phone hours therefore need ${Math.round(needPaid).toLocaleString()} PAID hours, not ${naive.toLocaleString()} — rostering to the requirement is the most common reason a centre misses service level every single day`}{" "}
        · the division is by one MINUS shrinkage, and adding the percentage instead understates it
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * OccupancyBand — occupancy by interval against the band a team can
 * sustain. Above it people burn out and below it they are idle, and
 * both are expensive in different currencies.
 * ------------------------------------------------------------------ */
export function OccupancyBand({
  intervals,
  sustainable = [0.75, 0.88],
  className = "",
}: {
  intervals: { label: string; handledSeconds: number; loggedSeconds: number }[]
  /** the low and high edges of what a team can hold */
  sustainable?: [number, number]
  className?: string
}) {
  const [lo, hi] = sustainable
  const rows = intervals.map((iv) => {
    const occ = iv.handledSeconds / Math.max(iv.loggedSeconds, 1e-9)
    return { ...iv, occ, state: occ > hi ? "over" : occ < lo ? "idle" : "in band" }
  })
  const over = rows.filter((r) => r.state === "over")
  const idle = rows.filter((r) => r.state === "idle")
  const mean = rows.reduce((a, r) => a + r.occ, 0) / Math.max(rows.length, 1)
  const idleSeconds = rows.filter((r) => r.state === "idle").reduce((a, r) => a + r.loggedSeconds * (lo - r.occ), 0)

  return (
    <div className={className}>
      <div className="relative flex items-stretch gap-px rounded-[2px] border border-foreground/15" style={{ height: 130 }}>
        <span className="pointer-events-none absolute inset-x-0 bg-foreground/10" style={{ bottom: `${lo * 100}%`, height: `${(hi - lo) * 100}%` }} />
        {rows.map((r) => (
          <div key={r.label} className="relative min-w-0 flex-1" title={`${r.label}: ${(r.occ * 100).toFixed(0)}%`}>
            <div
              className="absolute inset-x-0 bottom-0"
              style={{
                height: `${clamp(r.occ * 100, 0, 100)}%`,
                background:
                  r.state === "over"
                    ? "currentColor"
                    : r.state === "idle"
                      ? "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 5px)"
                      : "color-mix(in oklch, currentColor 45%, transparent)",
                outline: r.state === "idle" ? "1px solid currentColor" : undefined,
                outlineOffset: -1,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex gap-px text-[9px] text-muted-foreground">
        {rows.map((r, i) => (
          <span key={r.label} className="min-w-0 flex-1 truncate text-center">
            {i % 2 === 0 ? r.label : ""}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The band is {(lo * 100).toFixed(0)}–{(hi * 100).toFixed(0)}%, and BOTH sides of it cost money — solid intervals
        are over it, where handle time creeps up and people leave; hatched are under it, where{" "}
        {(idleSeconds / 3600).toFixed(1)} agent-hours are paid and idle · the mean is {(mean * 100).toFixed(0)}%, which
        is inside the band and describes {rows.length - over.length - idle.length} of {rows.length} intervals · an
        average occupancy is the number least able to show this
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ForecastAccuracy — forecast against actual, scored with MAPE and
 * with the BIAS separated out. A forecast that is 12% out in both
 * directions and one that is 12% low every day need opposite fixes.
 * ------------------------------------------------------------------ */
export function ForecastAccuracy({
  days,
  height = 190,
  className = "",
}: {
  days: { label: string; forecast: number; actual: number }[]
  height?: number
  className?: string
}) {
  const rows = days.map((d) => {
    const err = d.actual - d.forecast
    return { ...d, err, pct: err / Math.max(d.actual, 1e-9) }
  })
  const mape = rows.reduce((a, r) => a + Math.abs(r.pct), 0) / Math.max(rows.length, 1)
  const bias = rows.reduce((a, r) => a + r.pct, 0) / Math.max(rows.length, 1)
  const biasShare = Math.abs(bias) / Math.max(mape, 1e-9)
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.pct)))
  const overForecast = rows.filter((r) => r.err < 0).length

  return (
    <div className={className}>
      <div className="relative flex items-stretch gap-px rounded-[2px] border border-foreground/15" style={{ height }}>
        {rows.map((r) => (
          <div key={r.label} className="relative min-w-0 flex-1" title={`${r.label}: forecast ${r.forecast}, actual ${r.actual} (${(r.pct * 100).toFixed(1)}%)`}>
            <div
              className="absolute inset-x-0"
              style={{
                top: r.pct >= 0 ? `${50 - (r.pct / maxAbs) * 50}%` : "50%",
                height: `${(Math.abs(r.pct) / maxAbs) * 50}%`,
                background: r.pct >= 0 ? "currentColor" : "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 4px)",
                outline: r.pct < 0 ? "1px solid currentColor" : undefined,
                outlineOffset: -1,
              }}
            />
          </div>
        ))}
        <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-foreground/45" />
        <span className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/70" style={{ top: `${50 - (bias / maxAbs) * 50}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{rows[0]?.label}</span>
        <span>solid: under-forecast · hatched: over</span>
        <span>{rows[rows.length - 1]?.label}</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">MAPE</dt>
          <dd className="font-medium tabular-nums">{(mape * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Bias</dt>
          <dd className="font-medium tabular-nums">
            {bias >= 0 ? "+" : ""}
            {(bias * 100).toFixed(1)}%
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Over-forecast</dt>
          <dd className="font-medium tabular-nums">
            {overForecast}/{rows.length}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        MAPE is the size of the error and BIAS is its direction, and they need opposite fixes — the dashed line is the
        bias · {(biasShare * 100).toFixed(0)}% of the average error here is systematic, so{" "}
        {biasShare > 0.4
          ? `the forecast is simply ${bias > 0 ? "low" : "high"} and a constant correction removes most of it`
          : "the error is noise rather than a lean, and a constant correction would not help"}{" "}
        · under-forecasting costs service level and over-forecasting costs money, so the two directions are not
        interchangeable even when the percentage is the same
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AdherenceStrip — scheduled against actual state, per agent, across
 * a shift. Adherence as a percentage cannot show WHEN somebody was
 * off-schedule, and the when is what breaks a service level.
 * ------------------------------------------------------------------ */
export function AdherenceStrip({
  agents,
  shiftStartMinute,
  shiftEndMinute,
  className = "",
}: {
  agents: {
    name: string
    scheduled: { fromMinute: number; toMinute: number; state: "phone" | "break" | "meeting" }[]
    actual: { fromMinute: number; toMinute: number; state: "phone" | "break" | "meeting" | "away" }[]
  }[]
  shiftStartMinute: number
  shiftEndMinute: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!agents.length) return null

  const span = Math.max(shiftEndMinute - shiftStartMinute, 1)
  const px = (m: number) => ((m - shiftStartMinute) / span) * 100
  const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`
  const fill = (s: string) =>
    s === "phone"
      ? "currentColor"
      : s === "break"
        ? "color-mix(in oklch, currentColor 22%, transparent)"
        : s === "meeting"
          ? "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)"
          : "repeating-linear-gradient(135deg, currentColor 0 3px, transparent 3px 6px)"
  const rows = agents.map((a) => {
    // adherence is minute-by-minute agreement, which a percentage hides
    let inAdherence = 0
    for (let m = shiftStartMinute; m < shiftEndMinute; m++) {
      const s = a.scheduled.find((x) => m >= x.fromMinute && m < x.toMinute)?.state
      const t = a.actual.find((x) => m >= x.fromMinute && m < x.toMinute)?.state
      if (s && t && s === t) inAdherence++
    }
    const worstGap = a.actual
      .filter((x) => x.state === "away")
      .reduce((acc, x) => Math.max(acc, x.toMinute - x.fromMinute), 0)
    return { ...a, adherence: inAdherence / span, worstGap }
  })
  const mean = rows.reduce((a, r) => a + r.adherence, 0) / Math.max(rows.length, 1)
  const worst = rows.reduce((a, r) => (r.adherence < a.adherence ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((a) => (
          <li key={a.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{a.name}</span>
              <span className="tabular-nums text-muted-foreground">{(a.adherence * 100).toFixed(0)}% adherent</span>
            </div>
            <div className="relative mt-0.5 h-2.5 rounded-t-[2px] bg-muted">
              {a.scheduled.map((s) => (
                <div
                  key={`s${s.fromMinute}`}
                  className="absolute inset-y-0"
                  style={{ left: `${px(s.fromMinute)}%`, width: `${px(s.toMinute) - px(s.fromMinute)}%`, background: fill(s.state) }}
                  title={`scheduled ${s.state} ${clock(s.fromMinute)}–${clock(s.toMinute)}`}
                />
              ))}
            </div>
            <div className="relative h-2.5 rounded-b-[2px] bg-muted">
              {a.actual.map((s) => (
                <div
                  key={`a${s.fromMinute}`}
                  className="absolute inset-y-0"
                  style={{
                    left: `${px(s.fromMinute)}%`,
                    width: `${px(s.toMinute) - px(s.fromMinute)}%`,
                    background: fill(s.state),
                    outline: s.state === "away" ? "1px solid currentColor" : undefined,
                    outlineOffset: -1,
                  }}
                  title={`actual ${s.state} ${clock(s.fromMinute)}–${clock(s.toMinute)}`}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{clock(shiftStartMinute)}</span>
        <span>upper: scheduled · lower: actual</span>
        <span>{clock(shiftEndMinute)}</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Adherence is computed MINUTE BY MINUTE against the schedule, not as a total of hours worked — someone who takes
        the right break at the wrong time is fully productive and still leaves an interval short · the team averages{" "}
        {(mean * 100).toFixed(0)}%, and {worst.name} at {(worst.adherence * 100).toFixed(0)}% has a{" "}
        {worst.worstGap}-minute unscheduled gap · a percentage cannot show WHEN, and the when is what breaks a service
        level
      </p>
    </div>
  )
}
