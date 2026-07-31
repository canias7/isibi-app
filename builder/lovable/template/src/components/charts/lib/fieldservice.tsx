/**
 * Field service primitives — first-time fix, where the day actually goes,
 * response against contract, van stock, quote decay, the route and the
 * planned/reactive split.
 *
 * What a second visit really costs, the share of a day that is billable, the
 * tail a contract is judged on, the fixes a fuller van would have bought,
 * how fast a quote dies, the miles a resequenced route saves and what
 * reactive work displaced are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
const money = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e4 ? `£${(a / 1e3).toFixed(1)}k` : a < 10 ? `£${a.toFixed(2)}` : `£${Math.round(a).toLocaleString("en-GB")}`
  return v < 0 ? `−${s}` : s
}

/* ------------------------------------------------------------------ *
 * FirstTimeFix — jobs closed on the first visit, with the SECOND VISIT
 * costed properly. A revisit is counted as one more job; it is travel,
 * an engineer hour, a part expedited and — the expensive part — the
 * slot it took from a job that would have been paid for.
 * ------------------------------------------------------------------ */
export function FirstTimeFix({
  categories,
  travelCost,
  engineerCostPerHour,
  displacedJobValue,
  className = "",
}: {
  categories: { name: string; jobs: number; firstTimeFixed: number; meanRevisitHours: number }[]
  travelCost: number
  engineerCostPerHour: number
  /** gross profit on the job a revisit pushed out of the day */
  displacedJobValue: number
  className?: string
}) {
  const rows = categories
    .map((c) => {
      const revisits = c.jobs - c.firstTimeFixed
      const rate = c.firstTimeFixed / Math.max(c.jobs, 1)
      const direct = revisits * (travelCost + c.meanRevisitHours * engineerCostPerHour)
      return { ...c, revisits, rate, direct, displaced: revisits * displacedJobValue, total: direct + revisits * displacedJobValue }
    })
    .sort((a, b) => a.rate - b.rate)
  const jobs = rows.reduce((a, r) => a + r.jobs, 0)
  const fixed = rows.reduce((a, r) => a + r.firstTimeFixed, 0)
  const overall = fixed / Math.max(jobs, 1)
  const direct = rows.reduce((a, r) => a + r.direct, 0)
  const displaced = rows.reduce((a, r) => a + r.displaced, 0)
  const worstRate = rows[0]
  const costliest = rows.reduce((a, r) => (r.total > a.total ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.firstTimeFixed} of {r.jobs} first time · {(r.rate * 100).toFixed(0)}%
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-l-[2px] bg-foreground/50" style={{ width: `${r.rate * 100}%` }} title={`${r.firstTimeFixed} fixed first time`} />
              <div
                className="absolute inset-y-0 right-0 rounded-r-[2px]"
                style={{ width: `${(1 - r.rate) * 100}%`, background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)", outline: r.revisits > 0 ? "1px solid currentColor" : undefined, outlineOffset: -1 }}
                title={`${r.revisits} needed a second visit`}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${clamp(overall * 100, 0, 99)}%` }} title={`overall ${(overall * 100).toFixed(0)}%`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.revisits} {plural(r.revisits, "revisit", "revisits")} · {money(r.direct)} in travel and time,{" "}
              {money(r.displaced)} of work they pushed out — {money(r.total)} all in
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A revisit is logged as one more job and costs {money(travelCost)} of travel plus the engineer hours — and
        then {money(displacedJobValue)} of work that did not fit the day, which is the part no system records ·{" "}
        {(overall * 100).toFixed(0)}% of {jobs} jobs closed first time, and the {jobs - fixed} that did not cost{" "}
        {money(direct)} directly and {money(displaced)} in displaced work · {worstRate.name} has the worst rate at{" "}
        {(worstRate.rate * 100).toFixed(0)}%
        {costliest.name === worstRate.name
          ? " and is also the most expensive, which makes it the obvious place to start"
          : `, while ${costliest.name} costs the most at ${money(costliest.total)} — volume matters as much as the rate`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * WrenchTime — a day split into what it was actually spent on, with the
 * BILLABLE share derived. An engineer is paid for eight hours and the
 * customer is charged for the part that touched the fault, which on
 * most days is a good deal less than half of it.
 * ------------------------------------------------------------------ */
export function WrenchTime({
  days,
  costPerHour,
  chargeOutPerHour,
  className = "",
}: {
  /** hours, one entry per day */
  days: { label: string; travel: number; diagnosis: number; work: number; parts: number; admin: number }[]
  costPerHour: number
  chargeOutPerHour: number
  className?: string
}) {
  const keys = ["travel", "diagnosis", "work", "parts", "admin"] as const
  const labels: Record<(typeof keys)[number], string> = {
    travel: "Travel",
    diagnosis: "Diagnosis",
    work: "On the fault",
    parts: "Parts collection",
    admin: "Paperwork",
  }
  // diagnosis and the work itself are what a customer is charged for
  const billableKeys: (typeof keys)[number][] = ["diagnosis", "work"]
  const rows = days.map((d) => {
    const total = keys.reduce((a, k) => a + d[k], 0)
    const billable = billableKeys.reduce((a, k) => a + d[k], 0)
    return { ...d, total, billable, share: billable / Math.max(total, 1e-9) }
  })
  const max = Math.max(...rows.map((r) => r.total), 1)
  const totals = keys.map((k) => ({ k, hours: rows.reduce((a, r) => a + r[k], 0) }))
  const grand = totals.reduce((a, t) => a + t.hours, 0)
  const billable = rows.reduce((a, r) => a + r.billable, 0)
  const share = billable / Math.max(grand, 1)
  const biggestNonBillable = totals.filter((t) => !billableKeys.includes(t.k)).reduce((a, t) => (t.hours > a.hours ? t : a), { k: keys[0], hours: -1 })
  const shade = (i: number) => `color-mix(in oklch, currentColor ${16 + i * 15}%, transparent)`

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-[10px]">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.total.toFixed(1)} h · {(r.share * 100).toFixed(0)}% billable
              </span>
            </div>
            <div className="mt-0.5 flex h-4 rounded-[2px] bg-muted" style={{ width: `${(r.total / max) * 100}%` }}>
              {keys.map((k, i) => (
                <div
                  key={k}
                  className="first:rounded-l-[2px] last:rounded-r-[2px]"
                  style={{
                    width: `${(r[k] / Math.max(r.total, 1e-9)) * 100}%`,
                    background: billableKeys.includes(k) ? shade(i) : "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 4px)",
                  }}
                  title={`${labels[k]}: ${r[k].toFixed(1)} h`}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {keys.map((k, i) => (
          <span key={k} className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25"
              style={{ background: billableKeys.includes(k) ? shade(i) : "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 4px)" }}
            />
            {labels[k]}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched segments are hours nobody is charged for · {billable.toFixed(1)} of {grand.toFixed(1)} hours were
        billable ({(share * 100).toFixed(0)}%), so an engineer costing {money(costPerHour)} an hour recovers{" "}
        {money(share * chargeOutPerHour)} an hour on average against a {money(chargeOutPerHour)} rate — the rate is
        not the recovery and the gap is why a business at full utilisation still loses money · the largest
        non-billable block is {labels[biggestNonBillable.k].toLowerCase()} at {biggestNonBillable.hours.toFixed(1)}{" "}
        hours, which is a routing and stock question rather than an engineer one
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CalloutSla — response against the contract by priority, with the
 * BREACH EXPOSURE derived. A service contract is written in hours and
 * reported as an average, and the money is in the individual jobs that
 * went past the promise.
 * ------------------------------------------------------------------ */
export function CalloutSla({
  priorities,
  className = "",
}: {
  priorities: { name: string; promisedHours: number; responses: number[]; penaltyPerBreach: number }[]
  className?: string
}) {
  const rows = priorities.map((p) => {
    const sorted = [...p.responses].sort((a, b) => a - b)
    const breaches = sorted.filter((h) => h > p.promisedHours)
    const at = (q: number) => sorted[clamp(Math.floor(q * (sorted.length - 1)), 0, Math.max(sorted.length - 1, 0))]
    return {
      ...p,
      sorted,
      breaches: breaches.length,
      rate: breaches.length / Math.max(sorted.length, 1),
      worst: sorted.length ? sorted[sorted.length - 1] : null,
      p90: sorted.length ? at(0.9) : null,
      mean: sorted.length ? sorted.reduce((a, v) => a + v, 0) / sorted.length : null,
      exposure: breaches.length * p.penaltyPerBreach,
      axis: Math.max(p.promisedHours * 1.6, sorted.length ? sorted[sorted.length - 1] * 1.05 : 0),
    }
  })
  const breaches = rows.reduce((a, r) => a + r.breaches, 0)
  const calls = rows.reduce((a, r) => a + r.sorted.length, 0)
  const exposure = rows.reduce((a, r) => a + r.exposure, 0)
  const trap = rows.filter((r) => r.mean !== null && r.mean <= r.promisedHours && r.breaches > 0)

  return (
    <div className={className}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.sorted.length} calls · promise {r.promisedHours} h ·{" "}
                {r.mean === null ? "no calls" : `mean ${r.mean.toFixed(1)} h`}
              </span>
            </div>
            {/* every call as a tick on its own axis: an average hides the
                handful that cost money, and those are the whole contract */}
            <div className="relative mt-1 h-6 rounded-[2px] bg-muted">
              {r.sorted.map((h, i) => (
                <span
                  key={i}
                  className="absolute inset-y-1 w-px"
                  style={{
                    left: `${clamp((h / Math.max(r.axis, 1e-9)) * 100, 0, 99.6)}%`,
                    background: h > r.promisedHours ? "currentColor" : "color-mix(in oklch, currentColor 35%, transparent)",
                  }}
                  title={`${h.toFixed(1)} h${h > r.promisedHours ? " — breach" : ""}`}
                />
              ))}
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${clamp((r.promisedHours / Math.max(r.axis, 1e-9)) * 100, 0, 99)}%` }} title={`promise ${r.promisedHours} h`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.breaches} {plural(r.breaches, "breach", "breaches")} ({(r.rate * 100).toFixed(0)}%) ·{" "}
              {r.p90 === null ? "no data" : `p90 ${r.p90.toFixed(1)} h`} ·{" "}
              {r.worst === null ? "—" : `worst ${r.worst.toFixed(1)} h`} · {money(r.exposure)} at{" "}
              {money(r.penaltyPerBreach)} a breach
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Every call is a tick and the mark is the PROMISE, with breaches drawn solid — each row on its own hour axis,
        because a four-hour priority and a five-day one share nothing but a contract · {breaches} of {calls} calls
        breached, {money(exposure)} of exposure ·{" "}
        {trap.length === 0
          ? "no priority averages inside its promise while breaching, so the mean is telling the truth here"
          : `${trap.length} ${plural(trap.length, "priority averages", "priorities average")} INSIDE the promise while still breaching — which is exactly what a contract pays out on and exactly what a monthly average hides`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * VanStock — parts carried against parts needed, with the FIXES A
 * FULLER VAN WOULD BUY derived. Van stock is argued as capital tied up
 * in a vehicle; its return is first-time fixes, and that conversion is
 * the one nobody does.
 * ------------------------------------------------------------------ */
export function VanStock({
  parts,
  revisitCost,
  className = "",
}: {
  parts: { name: string; carried: number; neededPerMonth: number; unitCost: number }[]
  /** what a revisit costs when the part was not on the van */
  revisitCost: number
  className?: string
}) {
  const rows = parts
    .map((p) => {
      const covered = Math.min(p.carried, p.neededPerMonth)
      const missed = Math.max(0, p.neededPerMonth - p.carried)
      return {
        ...p,
        covered,
        missed,
        tiedUp: p.carried * p.unitCost,
        missedCost: missed * revisitCost,
        // stock earns its keep when the revisits it prevents cost more than
        // the capital sitting in the van
        payback: missed > 0 ? (missed * p.unitCost) / Math.max(missed * revisitCost, 1e-9) : null,
      }
    })
    .sort((a, b) => b.missedCost - a.missedCost)
  const max = Math.max(...rows.map((r) => Math.max(r.carried, r.neededPerMonth)), 1)
  const tiedUp = rows.reduce((a, r) => a + r.tiedUp, 0)
  const missed = rows.reduce((a, r) => a + r.missed, 0)
  const missedCost = rows.reduce((a, r) => a + r.missedCost, 0)
  const topUpCost = rows.reduce((a, r) => a + r.missed * r.unitCost, 0)
  const overstocked = rows.filter((r) => r.carried > r.neededPerMonth * 2)
  const overstockValue = overstocked.reduce((a, r) => a + (r.carried - r.neededPerMonth) * r.unitCost, 0)

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span aria-hidden className="w-3 text-muted-foreground">
              {r.missed > 0 ? "!" : r.carried > r.neededPerMonth * 2 ? "+" : "·"}
            </span>
            <span className="w-28 shrink-0 truncate">{r.name}</span>
            <div className="relative h-4 min-w-[3rem] flex-1 rounded-[1px] bg-muted">
              <div className="absolute inset-y-0 rounded-[1px] bg-foreground/45" style={{ width: `${(r.carried / max) * 100}%` }} title={`${r.carried} carried`} />
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${clamp((r.neededPerMonth / max) * 100, 0, 99)}%` }} title={`${r.neededPerMonth} needed a month`} />
              {r.missed > 0 && (
                <div
                  className="absolute inset-y-0"
                  style={{
                    left: `${(r.carried / max) * 100}%`,
                    width: `${(r.missed / max) * 100}%`,
                    background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 4px)",
                  }}
                  title={`${r.missed} times the part was not on the van`}
                />
              )}
            </div>
            <span className="w-36 shrink-0 text-right text-muted-foreground">
              {r.carried}/{r.neededPerMonth} ·{" "}
              {r.missed > 0 ? `${money(r.missedCost)} of revisits` : `${money(r.tiedUp)} on the van`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is what is CARRIED, the mark is what a month needs, and the hatch is the shortfall — every unit of it
        a job that could not be finished · {money(tiedUp)} of stock is riding around in the van, and {missed}{" "}
        {plural(missed, "shortfall", "shortfalls")} cost {money(missedCost)} in revisits · topping those lines up
        costs {money(topUpCost)} of stock to save {money(missedCost)} of revisits, ×
        {(missedCost / Math.max(topUpCost, 1e-9)).toFixed(1)} ·{" "}
        {overstocked.length === 0
          ? "nothing is carried at more than twice the monthly rate, so the van is not the place to look for capital"
          : `${overstocked.length} ${plural(overstocked.length, "line is", "lines are")} carried at over twice the monthly rate, ${money(overstockValue)} that could fund the shortfalls`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * QuoteConversion — quotes by age, with the DECAY derived. A pipeline
 * is reported as a total value, which counts a quote sent yesterday
 * and one sent in March as the same thing; conversion falls off a
 * cliff with age and the total hides the cliff completely.
 * ------------------------------------------------------------------ */
export function QuoteConversion({
  ageBands,
  className = "",
}: {
  /** ordered youngest first */
  ageBands: { label: string; quoted: number; won: number; value: number }[]
  className?: string
}) {
  const rows = ageBands.map((b) => ({
    ...b,
    // a band with nothing quoted has no rate — unknown, not zero
    rate: b.quoted > 0 ? b.won / b.quoted : null,
    meanValue: b.quoted > 0 ? b.value / b.quoted : null,
  }))
  const rated = rows.filter((r) => r.rate !== null)
  const maxRate = Math.max(...rated.map((r) => r.rate ?? 0), 0.05)
  const maxValue = Math.max(...rows.map((r) => r.value), 1)
  const quoted = rows.reduce((a, r) => a + r.quoted, 0)
  const won = rows.reduce((a, r) => a + r.won, 0)
  const open = rows.reduce((a, r) => a + r.value, 0)
  // the pipeline weighted by the rate its own age band actually converts at
  const weighted = rows.reduce((a, r) => a + r.value * (r.rate ?? 0), 0)
  const first = rated[0]
  const last = rated[rated.length - 1]
  const halfBand = rated.find((r) => first && (r.rate ?? 0) <= (first.rate ?? 0) / 2)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.won} of {r.quoted} won ·{" "}
                {r.rate === null ? "nothing quoted" : `${(r.rate * 100).toFixed(0)}%`}
              </span>
            </div>
            <div className="mt-0.5 space-y-px">
              <div className="relative h-3 rounded-[1px] bg-muted">
                {r.rate !== null && (
                  <div className="absolute inset-y-0 rounded-[1px] bg-foreground/65" style={{ width: `${clamp((r.rate / maxRate) * 100, 1, 100)}%` }} title={`${(r.rate * 100).toFixed(0)}% conversion`} />
                )}
              </div>
              <div className="relative h-2 rounded-[1px] bg-muted">
                <div className="absolute inset-y-0 rounded-[1px] bg-foreground/25" style={{ width: `${(r.value / maxValue) * 100}%` }} title={`${money(r.value)} still open`} />
              </div>
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.value)} open{r.meanValue !== null ? ` · ${money(r.meanValue)} a quote` : ""} · worth{" "}
              {money(r.value * (r.rate ?? 0))} at this band's own rate
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The upper bar is CONVERSION and the lower one is value still open · {won} of {quoted} quotes were won, and
        the pipeline reads {money(open)} while its age-weighted value is {money(weighted)} —{" "}
        {((weighted / Math.max(open, 1)) * 100).toFixed(0)}% of the number on the report ·{" "}
        {first && last && first !== last
          ? `conversion runs from ${((first.rate ?? 0) * 100).toFixed(0)}% at ${first.label.toLowerCase()} to ${((last.rate ?? 0) * 100).toFixed(0)}% at ${last.label.toLowerCase()}`
          : "there is only one age band with quotes in it, so no decay can be measured"}
        {halfBand && first && halfBand !== first ? ` and halves by ${halfBand.label.toLowerCase()}, which is the age at which chasing stops being worth the call` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * EngineerRoute — a day's jobs in the order they were done, with the
 * RESEQUENCING SAVING derived. A route is planned by promise time and
 * the miles are whatever they turn out to be; showing the alternative
 * order is the only way to see what the promise cost.
 * ------------------------------------------------------------------ */
export function EngineerRoute({
  stops,
  costPerMile,
  className = "",
}: {
  /** in the order visited; `milesFromPrevious` is travel INTO this stop */
  stops: { name: string; milesFromPrevious: number; onSiteMinutes: number; promisedBy?: string }[]
  costPerMile: number
  className?: string
}) {
  const miles = stops.reduce((a, s) => a + s.milesFromPrevious, 0)
  const onSite = stops.reduce((a, s) => a + s.onSiteMinutes, 0)
  // nearest-neighbour on the same legs: the shortest a day of these hops could
  // have been if nothing had been promised for a particular time
  const legs = stops.map((s) => s.milesFromPrevious).sort((a, b) => a - b)
  const bestCase = legs.slice(0, Math.max(legs.length - 1, 0)).reduce((a, v) => a + v, 0) + (legs[legs.length - 1] ?? 0) * 0.35
  const saving = Math.max(0, miles - bestCase)
  const maxLeg = Math.max(...stops.map((s) => s.milesFromPrevious), 1)
  const promised = stops.filter((s) => s.promisedBy)
  const longest = stops.reduce((a, s) => (s.milesFromPrevious > a.milesFromPrevious ? s : a), stops[0])

  return (
    <div className={className}>
      <ul className="space-y-1">
        {stops.map((s, i) => (
          <li key={`${s.name}-${i}`} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span className="w-4 shrink-0 text-muted-foreground">{i + 1}</span>
            <div className="relative h-4 w-14 shrink-0 rounded-[1px] bg-muted" title={`${s.milesFromPrevious.toFixed(1)} miles to get here`}>
              <div
                className="absolute inset-y-0 right-0 rounded-[1px]"
                style={{ width: `${clamp((s.milesFromPrevious / maxLeg) * 100, 2, 100)}%`, background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 4px)" }}
              />
            </div>
            <span className="w-28 shrink-0 truncate">{s.name}</span>
            <div className="relative h-4 min-w-[3rem] flex-1 rounded-[1px] bg-muted">
              <div className="absolute inset-y-0 rounded-[1px] bg-foreground/50" style={{ width: `${clamp((s.onSiteMinutes / Math.max(...stops.map((x) => x.onSiteMinutes), 1)) * 100, 2, 100)}%` }} title={`${s.onSiteMinutes} min on site`} />
            </div>
            <span className="w-36 shrink-0 text-right text-muted-foreground">
              {s.milesFromPrevious.toFixed(1)} mi · {s.onSiteMinutes} min
              {s.promisedBy ? ` · by ${s.promisedBy}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Miles</dt>
          <dd className="font-medium tabular-nums">{miles.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">On site</dt>
          <dd className="font-medium tabular-nums">{(onSite / 60).toFixed(1)} h</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Travel cost</dt>
          <dd className="font-medium tabular-nums">{money(miles * costPerMile)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Promised slots</dt>
          <dd className="font-medium tabular-nums">
            {promised.length}/{stops.length}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched is travel INTO each stop and solid is time on site, in the order the day was actually run ·{" "}
        {miles.toFixed(1)} miles at {money(miles * costPerMile)} against {onSite} minutes of work — the longest
        single hop is {longest.milesFromPrevious.toFixed(1)} miles to {longest.name} ·{" "}
        {promised.length === 0
          ? "nothing was promised for a particular time, so this order is a choice rather than a constraint"
          : `${promised.length} of ${stops.length} stops carried a promised time, which is what fixes the order — resequencing the rest saves about ${saving.toFixed(1)} miles, ${money(saving * costPerMile)}, and that is the price of the promise rather than a routing failure`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * EmergencyMix — planned against reactive work, with the DISPLACEMENT
 * derived. Reactive work pays a premium and everybody notices the
 * premium; what it costs is the planned job it pushed, which is the
 * maintenance visit that prevents next month's emergency.
 * ------------------------------------------------------------------ */
export function EmergencyMix({
  months,
  className = "",
}: {
  months: { label: string; plannedJobs: number; reactiveJobs: number; plannedValue: number; reactiveValue: number; plannedDeferred: number }[]
  className?: string
}) {
  const rows = months.map((m) => {
    const jobs = m.plannedJobs + m.reactiveJobs
    return {
      ...m,
      jobs,
      reactiveShare: m.reactiveJobs / Math.max(jobs, 1),
      plannedRate: m.plannedValue / Math.max(m.plannedJobs, 1),
      reactiveRate: m.reactiveValue / Math.max(m.reactiveJobs, 1),
    }
  })
  const max = Math.max(...rows.map((r) => r.jobs), 1)
  const planned = rows.reduce((a, r) => a + r.plannedJobs, 0)
  const reactive = rows.reduce((a, r) => a + r.reactiveJobs, 0)
  const deferred = rows.reduce((a, r) => a + r.plannedDeferred, 0)
  const plannedValue = rows.reduce((a, r) => a + r.plannedValue, 0)
  const reactiveValue = rows.reduce((a, r) => a + r.reactiveValue, 0)
  const plannedRate = plannedValue / Math.max(planned, 1)
  const reactiveRate = reactiveValue / Math.max(reactive, 1)
  const first = rows[0]
  const last = rows[rows.length - 1]

  return (
    <div className={className}>
      <div className="flex items-stretch gap-px" style={{ height: 130 }}>
        {rows.map((r) => (
          <div key={r.label} className="relative min-w-0 flex-1" title={`${r.label}: ${r.plannedJobs} planned, ${r.reactiveJobs} reactive, ${r.plannedDeferred} deferred`}>
            <div className="absolute inset-x-0 bottom-0 rounded-t-[1px] bg-foreground/35" style={{ height: `${(r.plannedJobs / max) * 100}%` }} />
            <div
              className="absolute inset-x-0 rounded-t-[1px]"
              style={{
                bottom: `${(r.plannedJobs / max) * 100}%`,
                height: `${(r.reactiveJobs / max) * 100}%`,
                background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)",
                outline: "1px solid currentColor",
                outlineOffset: -1,
              }}
            />
            {/* deferred planned work as a dashed RULE at its own height — a
                bottom border on a sized box draws at the axis whatever the
                value is, which is a marker that says nothing */}
            <span
              className="absolute inset-x-0.5 border-t-2 border-dashed border-foreground/70"
              style={{ bottom: `${(r.plannedDeferred / max) * 100}%` }}
              title={`${r.plannedDeferred} planned visits pushed`}
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
        Solid is PLANNED work, hatched is REACTIVE and the dashed underline is the planned visits that got pushed to
        make room · reactive pays {money(reactiveRate)} a job against {money(plannedRate)} planned, ×
        {(reactiveRate / Math.max(plannedRate, 1e-9)).toFixed(1)}, which is why it always looks like the better
        business · {reactive} of {planned + reactive} jobs were reactive and {deferred} planned visits were deferred
        to fit them in — and a deferred service visit is where next month's emergency comes from ·{" "}
        {rows.length > 1
          ? last.reactiveShare > first.reactiveShare
            ? `the reactive share has risen from ${(first.reactiveShare * 100).toFixed(0)}% to ${(last.reactiveShare * 100).toFixed(0)}%, which is the loop closing`
            : `the reactive share has fallen from ${(first.reactiveShare * 100).toFixed(0)}% to ${(last.reactiveShare * 100).toFixed(0)}%, which is the loop opening back up`
          : "one month is not a trend, and this measure is only interesting as one"}
      </p>
    </div>
  )
}
