/**
 * Emergency service primitives — demand against resource, response-time
 * tails, hospital handover, triage outcomes, station coverage, surge and
 * crew fatigue.
 *
 * Whether a shift pattern matches the calls, what the tail of a response
 * distribution costs, the hours lost at a hospital door, which dispositions
 * a category really produces, what a station move does to coverage, where a
 * surge exhausts the fleet and how tired a crew is are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/* ------------------------------------------------------------------ *
 * CallStack — calls arriving against resources available, hour by
 * hour, with the SHORTFALL derived. A rota is built on a headcount
 * and demand arrives on a clock.
 * ------------------------------------------------------------------ */
export function CallStack({
  hours,
  calls,
  crews,
  meanJobHours = 1.4,
  className = "",
}: {
  hours: string[]
  calls: number[]
  /** crews on duty in each hour */
  crews: number[]
  /** how long a job ties a crew up, door to door */
  meanJobHours?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!hours.length || !calls.length || !crews.length) return null

  const rows = hours.map((h, i) => {
    // demand in crew-hours, which is what a rota actually has to cover
    const demand = calls[i] * meanJobHours
    return { hour: h, calls: calls[i], crews: crews[i], demand, cover: crews[i] / Math.max(demand, 1e-9), short: Math.max(0, demand - crews[i]) }
  })
  const max = Math.max(...rows.map((r) => Math.max(r.demand, r.crews)))
  const shortHours = rows.filter((r) => r.short > 0)
  const totalShort = rows.reduce((a, r) => a + r.short, 0)
  const spare = rows.reduce((a, r) => a + Math.max(0, r.crews - r.demand), 0)
  const worst = rows.reduce((a, r) => (r.short > a.short ? r : a), rows[0])
  const peakCalls = rows.reduce((a, r) => (r.calls > a.calls ? r : a), rows[0])

  return (
    <div className={className}>
      <div className="relative flex items-stretch gap-px rounded-[2px] border border-foreground/15" style={{ height: 150 }}>
        {rows.map((r) => (
          <div key={r.hour} className="relative min-w-0 flex-1" title={`${r.hour}: ${r.calls} calls (${r.demand.toFixed(1)} crew-hours) against ${r.crews} crews`}>
            <div
              className="absolute inset-x-0 bottom-0"
              style={{
                height: `${(r.demand / max) * 100}%`,
                background: r.short > 0 ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 40%, transparent)",
                outline: r.short > 0 ? "1px solid currentColor" : undefined,
                outlineOffset: -1,
              }}
            />
            <span className="absolute inset-x-0 border-t-2 border-foreground/75" style={{ bottom: `${(r.crews / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex gap-px text-[9px] text-muted-foreground">
        {rows.map((r, i) => (
          <span key={r.hour} className="min-w-0 flex-1 truncate text-center">
            {i % 3 === 0 ? r.hour : ""}
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Peak demand</dt>
          <dd className="font-medium tabular-nums">{peakCalls.hour}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Hours short</dt>
          <dd className="font-medium tabular-nums">{shortHours.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Shortfall</dt>
          <dd className="font-medium tabular-nums">{totalShort.toFixed(1)} crew-h</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Spare</dt>
          <dd className="font-medium tabular-nums">{spare.toFixed(1)} crew-h</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Demand is converted to CREW-HOURS at {meanJobHours} hours a job, because a call is not a unit a rota can be
        measured against · the rule is crews on duty, and hatched hours are the ones where the calls arrive faster
        than the fleet can clear them · {shortHours.length} of {rows.length} hours are short by{" "}
        {totalShort.toFixed(1)} crew-hours in total, the worst at {worst.hour} · there are{" "}
        {spare.toFixed(1)} spare crew-hours elsewhere in the same day, which is a shift-pattern problem rather than
        a headcount one
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ResponseTimeTail — the whole distribution against the target, with
 * the 90th percentile derived. A mean response time is met while the
 * tail is what the complaint, and the inquest, are about.
 * ------------------------------------------------------------------ */
export function ResponseTimeTail({
  categories,
  height = 200,
  className = "",
}: {
  categories: {
    name: string
    /** response minutes, one per incident */
    times: number[]
    meanTargetMin: number
    p90TargetMin: number
  }[]
  height?: number
  className?: string
}) {
  const rows = categories.map((c) => {
    const sorted = [...c.times].sort((a, b) => a - b)
    const at = (p: number) => sorted[clamp(Math.floor(p * (sorted.length - 1)), 0, sorted.length - 1)]
    const mean = sorted.reduce((a, v) => a + v, 0) / Math.max(sorted.length, 1)
    return {
      ...c,
      sorted,
      mean,
      p50: at(0.5),
      p90: at(0.9),
      p99: at(0.99),
      // the row's own axis: far enough past p99 and past its own p90 target
      // that a category missing badly still shows the mark it missed
      axis: Math.max(at(0.99) * 1.1, c.p90TargetMin * 1.15),
      meanOk: mean <= c.meanTargetMin,
      p90Ok: at(0.9) <= c.p90TargetMin,
      worst: sorted[sorted.length - 1],
    }
  })
  // EACH row is binned over its OWN range, not a shared one. A shared axis is
  // set by the slowest category, and an immediate-response distribution then
  // occupies four bins of forty and shows no shape at all — while comparing a
  // category 1 minute against a category 3 minute means nothing anyway, since
  // each is judged against its own target
  const trap = rows.filter((r) => r.meanOk && !r.p90Ok)

  return (
    <div className={className}>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.sorted.length.toLocaleString()} incidents · mean {r.mean.toFixed(1)} · p90 {r.p90.toFixed(1)} min
              </span>
            </div>
            {/* the distribution itself, so the tail is visible rather than
                summarised into a number that hides it */}
            <div className="relative mt-1 flex h-8 items-end gap-px">
              {Array.from({ length: 40 }, (_, b) => {
                const lo = (b / 40) * r.axis
                const hi = ((b + 1) / 40) * r.axis
                const n = r.sorted.filter((t) => t >= lo && t < hi).length
                return { n, lo }
              }).map((b, i, all) => {
                const peak = Math.max(1, ...all.map((x) => x.n))
                return (
                  <div
                    key={i}
                    className="min-w-0 flex-1 rounded-t-[1px]"
                    style={{
                      height: `${clamp((b.n / peak) * 100, 0, 100)}%`,
                      background: b.lo > r.p90TargetMin ? "currentColor" : "color-mix(in oklch, currentColor 34%, transparent)",
                    }}
                    title={`${b.lo.toFixed(0)}–${(b.lo + r.axis / 40).toFixed(0)} min: ${b.n}`}
                  />
                )
              })}
              <span className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${clamp((r.meanTargetMin / r.axis) * 100, 0, 100)}%` }} title={`mean target ${r.meanTargetMin} min`} />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/80" style={{ left: `${clamp((r.p90TargetMin / r.axis) * 100, 0, 100)}%` }} title={`p90 target ${r.p90TargetMin} min`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              mean {r.meanOk ? "meets" : "misses"} {r.meanTargetMin} · p90 {r.p90Ok ? "meets" : "misses"}{" "}
              {r.p90TargetMin} · p99 {r.p99.toFixed(1)} · longest {r.worst.toFixed(1)} min
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The whole DISTRIBUTION is drawn, with everything past the 90th-percentile target filled solid, because that
        tail is what a complaint and an inquest are about · each row is on its OWN minute axis, stated beneath it,
        because a shared one is set by the slowest category and flattens the fastest to nothing ·{" "}
        {trap.length === 0
          ? "no category meets its mean target while missing its 90th percentile, which is the honest case"
          : `${trap.length} ${plural(trap.length, "category meets", "categories meet")} the mean target and ${trap.length === 1 ? "misses" : "miss"} the 90th percentile — a service reporting the mean would show green`}{" "}
        · a mean is a promise about the middle and nobody waiting is in the middle
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * HandoverDelay — time lost at hospital doors, with the AMBULANCE
 * HOURS derived. A handover delay is measured per patient and it is
 * spent as fleet capacity, which is a different unit entirely.
 * ------------------------------------------------------------------ */
export function HandoverDelay({
  hospitals,
  targetMin = 15,
  crewCostPerHour,
  className = "",
}: {
  hospitals: { name: string; arrivals: number; meanHandoverMin: number; over60: number }[]
  targetMin?: number
  crewCostPerHour?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!hospitals.length) return null

  const rows = hospitals
    .map((h) => {
      const lostMin = h.arrivals * Math.max(0, h.meanHandoverMin - targetMin)
      return {
        ...h,
        lostHours: lostMin / 60,
        // an ambulance sat at a door is a crew off the road
        crewsEquivalent: lostMin / 60 / 12,
        over60Share: h.over60 / Math.max(h.arrivals, 1),
      }
    })
    .sort((a, b) => b.lostHours - a.lostHours)
  const max = Math.max(...rows.map((r) => r.lostHours))
  const totalHours = rows.reduce((a, r) => a + r.lostHours, 0)
  const arrivals = rows.reduce((a, r) => a + r.arrivals, 0)
  const worstMean = rows.reduce((a, r) => (r.meanHandoverMin > a.meanHandoverMin ? r : a), rows[0])
  const worstTotal = rows[0]

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.arrivals.toLocaleString()} arrivals · mean {r.meanHandoverMin.toFixed(0)} min ·{" "}
                {(r.over60Share * 100).toFixed(1)}% over an hour
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(r.lostHours / max) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: "1px solid currentColor",
                  outlineOffset: -1,
                }}
                title={`${r.lostHours.toFixed(0)} ambulance-hours lost`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.lostHours.toFixed(0)} ambulance-hours past the {targetMin}-minute target ={" "}
              {r.crewsEquivalent.toFixed(1)} crews off the road for a shift
              {crewCostPerHour ? ` · £${Math.round(r.lostHours * crewCostPerHour).toLocaleString()}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A handover delay is recorded per PATIENT and spent as FLEET CAPACITY, which is the conversion this makes —{" "}
        {totalHours.toFixed(0)} ambulance-hours across {arrivals.toLocaleString()} arrivals is{" "}
        {(totalHours / 12).toFixed(1)} crews-worth of shift that never reached a call ·{" "}
        {worstMean.name} has the longest mean at {worstMean.meanHandoverMin.toFixed(0)} minutes and{" "}
        {worstTotal.name} loses the most hours,{" "}
        {worstMean.name === worstTotal.name
          ? "which is the same hospital"
          : "which are different hospitals — volume matters as much as the delay"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * TriageOutcome — what each triage category actually turned into,
 * with the OVER-TRIAGE rate derived. A category is assigned in
 * seconds on a telephone and judged against what was found.
 * ------------------------------------------------------------------ */
export function TriageOutcome({
  categories,
  outcomes,
  counts,
  seriousFrom,
  className = "",
}: {
  categories: string[]
  /** outcomes from most to least serious */
  outcomes: string[]
  /** counts[category][outcome] */
  counts: number[][]
  /** the outcome index at or above which the incident was genuinely serious */
  seriousFrom: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!categories.length || !outcomes.length || !counts.length) return null

  const rows = categories.map((name, ci) => {
    const total = counts[ci].reduce((a, v) => a + v, 0)
    const serious = counts[ci].slice(0, seriousFrom + 1).reduce((a, v) => a + v, 0)
    return { name, total, serious, seriousShare: serious / Math.max(total, 1), row: counts[ci] }
  })
  const shade = (i: number) => `color-mix(in oklch, currentColor ${(84 - i * (72 / Math.max(outcomes.length - 1, 1))).toFixed(0)}%, transparent)`
  const total = rows.reduce((a, r) => a + r.total, 0)
  // the highest category should have the highest serious share; where it does
  // not, the triage is not separating anything
  const inverted = rows.slice(1).filter((r, i) => r.seriousShare > rows[i].seriousShare)
  const top = rows[0]
  const bottom = rows[rows.length - 1]

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.total.toLocaleString()} incidents · {(r.seriousShare * 100).toFixed(0)}% genuinely serious
              </span>
            </div>
            <div className="mt-0.5 flex h-4 overflow-hidden rounded-[2px] border border-foreground/20">
              {r.row.map((v, oi) => (
                <div
                  key={oi}
                  className="border-r border-background last:border-r-0"
                  style={{ width: `${(v / Math.max(r.total, 1)) * 100}%`, background: shade(oi) }}
                  title={`${outcomes[oi]}: ${v.toLocaleString()} (${((v / Math.max(r.total, 1)) * 100).toFixed(1)}%)`}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {outcomes.map((o, i) => (
          <span key={o} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25" style={{ background: shade(i) }} />
            {o}
            {i === seriousFrom ? " ⟨serious to here⟩" : ""}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A triage category is assigned in seconds on a telephone and this is what it turned out to be ·{" "}
        {top.name} produces a serious outcome {(top.seriousShare * 100).toFixed(0)}% of the time against{" "}
        {(bottom.seriousShare * 100).toFixed(0)}% for {bottom.name}, a separation of{" "}
        {((top.seriousShare - bottom.seriousShare) * 100).toFixed(0)} points across{" "}
        {total.toLocaleString()} incidents ·{" "}
        {inverted.length === 0
          ? "the categories rank correctly, which is what a triage system is for"
          : `${inverted.length} ${plural(inverted.length, "category is", "categories are")} out of order — a lower category producing MORE serious outcomes than the one above it means the questions are not separating anything`}{" "}
        · over-triage is the safe direction and it is not free
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * StationCoverage — the population reachable within the standard from
 * each station, with the OVERLAP and the gap derived. Closing a
 * station is argued on its own workload and decided by the hole it
 * leaves.
 * ------------------------------------------------------------------ */
export function StationCoverage({
  areas,
  stations,
  standardMin,
  className = "",
}: {
  /** each area's population and drive time from each station */
  areas: { name: string; population: number; minutesFrom: number[] }[]
  stations: string[]
  standardMin: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!areas.length || !stations.length) return null

  const covered = areas.map((a) => ({
    ...a,
    by: a.minutesFrom.map((m, i) => (m <= standardMin ? i : -1)).filter((i) => i >= 0),
    nearest: a.minutesFrom.indexOf(Math.min(...a.minutesFrom)),
  }))
  const population = covered.reduce((a, c) => a + c.population, 0)
  const reached = covered.filter((c) => c.by.length > 0).reduce((a, c) => a + c.population, 0)
  const soleCover = stations.map((_, si) =>
    covered.filter((c) => c.by.length === 1 && c.by[0] === si).reduce((a, c) => a + c.population, 0),
  )
  const anyCover = stations.map((_, si) => covered.filter((c) => c.by.includes(si)).reduce((a, c) => a + c.population, 0))
  const max = Math.max(...anyCover)
  const gap = population - reached
  const critical = soleCover.indexOf(Math.max(...soleCover))
  const busiest = anyCover.indexOf(Math.max(...anyCover))

  return (
    <div className={className}>
      <ul className="space-y-2">
        {stations.map((s, si) => (
          <li key={s}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{s}</span>
              <span className="tabular-nums text-muted-foreground">
                {anyCover[si].toLocaleString()} within {standardMin} min
              </span>
            </div>
            {/* the population only THIS station can reach in time is the number
                that decides whether it can close — total coverage is not */}
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/25" style={{ width: `${(anyCover[si] / max) * 100}%` }} title={`reachable: ${anyCover[si].toLocaleString()}`} />
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground" style={{ width: `${(soleCover[si] / max) * 100}%` }} title={`only from here: ${soleCover[si].toLocaleString()}`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {soleCover[si].toLocaleString()} people ({((soleCover[si] / Math.max(population, 1)) * 100).toFixed(1)}%)
              can be reached in time from HERE and nowhere else
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is everybody reachable within {standardMin} minutes and solid is the population reachable from that
        station ALONE, which is the number a closure decision actually turns on ·{" "}
        {((reached / Math.max(population, 1)) * 100).toFixed(1)}% of {population.toLocaleString()} people are
        covered, leaving {gap.toLocaleString()} outside the standard from anywhere ·{" "}
        {stations[busiest]} covers the most people and {stations[critical]} is the least replaceable, with{" "}
        {soleCover[critical].toLocaleString()} who lose their coverage entirely if it goes —{" "}
        {busiest === critical ? "the same station, which makes it the obvious keep" : "different stations, which is the whole trap"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SurgeCapacity — a demand spike against the fleet, with the QUEUE
 * that forms derived. A surge plan is written as extra resources and
 * what matters is how long the backlog persists after it passes.
 * ------------------------------------------------------------------ */
export function SurgeCapacity({
  hours,
  arrivals,
  baseCrews,
  surgeCrews,
  meanJobHours = 1.4,
  height = 190,
  className = "",
}: {
  hours: string[]
  arrivals: number[]
  baseCrews: number
  /** extra crews called in, per hour */
  surgeCrews: number[]
  meanJobHours?: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!hours.length || !arrivals.length || !surgeCrews.length) return null

  let queue = 0
  const rows = hours.map((h, i) => {
    const capacity = (baseCrews + surgeCrews[i]) / Math.max(meanJobHours, 1e-9)
    const cleared = Math.min(queue + arrivals[i], capacity)
    queue = Math.max(0, queue + arrivals[i] - capacity)
    return { hour: h, arrivals: arrivals[i], capacity, cleared, queue, surge: surgeCrews[i] }
  })
  // the same demand with no surge at all, for comparison
  let plainQueue = 0
  const plain = hours.map((_, i) => {
    const capacity = baseCrews / Math.max(meanJobHours, 1e-9)
    plainQueue = Math.max(0, plainQueue + arrivals[i] - capacity)
    return plainQueue
  })
  const max = Math.max(...rows.map((r) => Math.max(r.arrivals, r.capacity)), ...plain)
  const peakQueue = rows.reduce((a, r) => (r.queue > a.queue ? r : a), rows[0])
  const clearAt = rows.findIndex((r, i) => i > 0 && r.queue === 0 && rows[i - 1].queue > 0)
  const plainPeak = Math.max(...plain)
  const surgeHours = rows.reduce((a, r) => a + r.surge, 0)

  return (
    <div className={className}>
      <div className="relative flex items-stretch gap-px rounded-[2px] border border-foreground/15" style={{ height }}>
        {rows.map((r) => (
          <div key={r.hour} className="relative min-w-0 flex-1" title={`${r.hour}: ${r.arrivals} calls, capacity ${r.capacity.toFixed(1)}, ${r.queue.toFixed(1)} waiting`}>
            <div className="absolute inset-x-0 bottom-0" style={{ height: `${(r.arrivals / max) * 100}%`, background: "color-mix(in oklch, currentColor 24%, transparent)" }} />
            <span className="absolute inset-x-0 border-t border-foreground/70" style={{ bottom: `${(r.capacity / max) * 100}%` }} />
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          <polyline
            points={plain.map((q, i) => `${((i + 0.5) / rows.length) * 100},${100 - (q / max) * 100}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            strokeDasharray="4 2"
            opacity={0.6}
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={rows.map((r, i) => `${((i + 0.5) / rows.length) * 100},${100 - (r.queue / max) * 100}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="mt-0.5 flex gap-px text-[9px] text-muted-foreground">
        {rows.map((r, i) => (
          <span key={r.hour} className="min-w-0 flex-1 truncate text-center">
            {i % 3 === 0 ? r.hour : ""}
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Peak queue</dt>
          <dd className="font-medium tabular-nums">{peakQueue.queue.toFixed(0)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Peaks at</dt>
          <dd className="font-medium tabular-nums">{peakQueue.hour}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Clears</dt>
          <dd className="font-medium tabular-nums">{clearAt < 0 ? "not today" : rows[clearAt].hour}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Surge used</dt>
          <dd className="font-medium tabular-nums">{surgeHours} crew-h</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The solid line is the QUEUE that forms when arrivals outrun capacity, carried hour to hour — a surge plan is
        written as extra crews and judged on how long the backlog persists after the spike has gone · the dashed
        line is the same demand with no surge at all, peaking at {plainPeak.toFixed(0)} against{" "}
        {peakQueue.queue.toFixed(0)} · {surgeHours} crew-hours of surge{" "}
        {clearAt < 0 ? "does not clear the backlog within the day" : `clears it by ${rows[clearAt].hour}`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CrewFatigue — a shift pattern's accumulated fatigue, with the RISK
 * derived from consecutive nights, rest between shifts and time on
 * task. A rota is checked against rules and fatigue is cumulative.
 * ------------------------------------------------------------------ */
export function CrewFatigue({
  shifts,
  minRestHours = 11,
  className = "",
}: {
  /** each shift in order, with the rest before it */
  shifts: { day: string; startHour: number; hours: number; night: boolean; restBeforeHours: number }[]
  minRestHours?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!shifts.length) return null

  let consecutiveNights = 0
  let load = 0
  const rows = shifts.map((s) => {
    consecutiveNights = s.night ? consecutiveNights + 1 : 0
    // fatigue accumulates and recovers with rest, rather than resetting
    const recovery = clamp(s.restBeforeHours / 24, 0, 1)
    load = clamp(load * (1 - recovery * 0.7) + s.hours / 12 + (s.night ? 0.35 : 0) + consecutiveNights * 0.12, 0, 3)
    return {
      ...s,
      consecutiveNights,
      load,
      shortRest: s.restBeforeHours < minRestHours,
      band: load >= 2 ? "high" : load >= 1.2 ? "elevated" : "normal",
    }
  })
  const max = Math.max(1, ...rows.map((r) => r.load))
  const high = rows.filter((r) => r.band === "high")
  const shortRests = rows.filter((r) => r.shortRest)
  const nights = rows.filter((r) => r.night).length
  const peak = rows.reduce((a, r) => (r.load > a.load ? r : a), rows[0])

  return (
    <div className={className}>
      <div className="flex items-stretch gap-px rounded-[2px] border border-foreground/15" style={{ height: 110 }}>
        {rows.map((r, i) => (
          <div key={i} className="relative min-w-0 flex-1" title={`${r.day}: ${r.hours}h ${r.night ? "night" : "day"}, ${r.restBeforeHours}h rest before — load ${r.load.toFixed(2)}`}>
            <div
              className="absolute inset-x-0 bottom-0"
              style={{
                height: `${(r.load / max) * 100}%`,
                background:
                  r.band === "high"
                    ? "currentColor"
                    : r.night
                      ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                      : "color-mix(in oklch, currentColor 40%, transparent)",
                outline: r.shortRest ? "1.5px solid currentColor" : undefined,
                outlineOffset: -1.5,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex gap-px text-[9px] text-muted-foreground">
        {rows.map((r, i) => (
          <span key={i} className="min-w-0 flex-1 truncate text-center">
            {r.day}
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Nights</dt>
          <dd className="font-medium tabular-nums">
            {nights}/{rows.length}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Short rests</dt>
          <dd className="font-medium tabular-nums">{shortRests.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">High-load shifts</dt>
          <dd className="font-medium tabular-nums">{high.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Peak</dt>
          <dd className="font-medium">{peak.day}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Fatigue ACCUMULATES and is only partly recovered by the rest before the next shift, which is why a rota that
        passes every individual rule can still end badly · hatched shifts are nights, solid ones are high load and an
        outline is rest below {minRestHours} hours · the peak is {peak.day} after{" "}
        {peak.consecutiveNights > 0 ? `${peak.consecutiveNights} consecutive ${plural(peak.consecutiveNights, "night", "nights")}` : "a run of long days"}
        {shortRests.length > 0 ? ` · ${shortRests.length} ${plural(shortRests.length, "shift starts", "shifts start")} on short rest, which is where the accumulation comes from` : ""}
      </p>
    </div>
  )
}
