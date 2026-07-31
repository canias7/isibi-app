/**
 * Gym membership primitives — joiner cohorts, class occupancy, visit
 * frequency, floor load, the contract wall and personal training attach.
 *
 * The month a cohort halves, the slot a class should move to, the members
 * who pay and never come, where the queue actually forms, the renewal
 * exposure hiding in a contract book and what a second product is worth are
 * all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
const money = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e4 ? `£${(a / 1e3).toFixed(1)}k` : a < 10 ? `£${a.toFixed(2)}` : `£${Math.round(a).toLocaleString("en-GB")}`
  return v < 0 ? `−${s}` : s
}
const ord = (n: number) => {
  const t = n % 100
  if (t >= 11 && t <= 13) return `${n}th`
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`
}

/* ------------------------------------------------------------------ *
 * MemberCohort — joiners by month and how many are still paying, with
 * the HALF-LIFE derived. Churn is quoted monthly, which averages a
 * January cohort that leaves in March with a September one that stays
 * three years; the survival curve is where the difference lives.
 * ------------------------------------------------------------------ */
export function MemberCohort({
  cohorts,
  monthlyFee,
  className = "",
}: {
  /** `surviving[i]` is members still paying i months after joining */
  cohorts: { label: string; joined: number; surviving: number[] }[]
  monthlyFee: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!cohorts.length) return null

  const span = Math.max(...cohorts.map((c) => c.surviving.length))
  const rows = cohorts.map((c) => {
    const rates = c.surviving.map((s) => s / Math.max(c.joined, 1))
    // the month the cohort has lost half — interpolated between the two
    // observations that straddle it, and null when it never gets there
    let half: number | null = null
    for (let i = 1; i < rates.length; i++) {
      if (rates[i] <= 0.5 && rates[i - 1] > 0.5) {
        const t = (rates[i - 1] - 0.5) / Math.max(rates[i - 1] - rates[i], 1e-9)
        half = i - 1 + t
        break
      }
    }
    const months = c.surviving.reduce((a, s) => a + s, 0)
    return { ...c, rates, half, lifetimeValue: (months / Math.max(c.joined, 1)) * monthlyFee, observed: c.surviving.length }
  })
  const withHalf = rows.filter((r) => r.half !== null)
  const meanHalf = withHalf.length ? withHalf.reduce((a, r) => a + (r.half ?? 0), 0) / withHalf.length : null
  const best = rows.reduce((a, r) => (r.lifetimeValue > a.lifetimeValue ? r : a), rows[0])
  const worst = rows.reduce((a, r) => (r.lifetimeValue < a.lifetimeValue ? r : a), rows[0])
  const shade = (i: number) => `color-mix(in oklch, currentColor ${28 + (i / Math.max(rows.length - 1, 1)) * 55}%, transparent)`

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height: 150 }}>
        <span className="absolute inset-x-0 border-t border-dashed border-foreground/40" style={{ top: "50%" }} title="half the cohort" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {rows.map((r, ri) => (
            <polyline
              key={r.label}
              points={r.rates.map((v, i) => `${(i / Math.max(span - 1, 1)) * 100},${clamp(100 - v * 100, 0, 100)}`).join(" ")}
              fill="none"
              stroke={shade(ri)}
              strokeWidth={1.2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {rows.map((r, ri) =>
          r.half === null ? null : (
            <span
              key={`h${r.label}`}
              className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground bg-background"
              style={{ left: `${((r.half ?? 0) / Math.max(span - 1, 1)) * 100}%`, top: "50%" }}
              title={`${r.label} halves at month ${(r.half ?? 0).toFixed(1)}`}
            />
          )
        )}
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] tabular-nums text-muted-foreground">
        <span>joined</span>
        <span>dashed line is half the cohort</span>
        <span>month {span - 1}</span>
      </div>
      <ul className="mt-2 space-y-1 text-[10px] tabular-nums">
        {rows.map((r, ri) => (
          <li key={r.label} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-4 shrink-0 rounded-[1px]" style={{ background: shade(ri) }} />
            <span className="w-24 shrink-0 truncate">{r.label}</span>
            <span className="text-muted-foreground">
              {r.joined} joined ·{" "}
              {r.half === null
                ? `still above half after ${r.observed - 1} ${plural(r.observed - 1, "month", "months")}`
                : `halves at month ${(r.half ?? 0).toFixed(1)}`}{" "}
              · {money(r.lifetimeValue)} observed so far
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A monthly churn figure averages every cohort into one number; this is each intake surviving on its own clock
        ·{" "}
        {meanHalf === null
          ? "no cohort here has fallen below half yet, so the half-life is longer than the window and cannot be stated from this data"
          : `cohorts halve at month ${meanHalf.toFixed(1)} on average${withHalf.length < rows.length ? `, though ${rows.length - withHalf.length} of ${rows.length} ${plural(rows.length - withHalf.length, "is", "are")} still above half and excluded rather than counted as zero` : ""}`}{" "}
        · {best.label} is worth {money(best.lifetimeValue)} a member against {money(worst.lifetimeValue)} for{" "}
        {worst.label} — the joining offer that filled one of them is a different business from the one that filled
        the other · the value shown is what has been BILLED so far, not a projection
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ClassOccupancy — classes by slot, with the WAITLIST and the empty
 * mats side by side. A timetable is judged on total attendance, which
 * balances a class turning people away against one running for four,
 * and the fix for those is the same move in opposite directions.
 * ------------------------------------------------------------------ */
export function ClassOccupancy({
  classes,
  className = "",
}: {
  classes: { name: string; slot: string; capacity: number; booked: number; attended: number; waitlisted: number }[]
  className?: string
}) {
  const rows = classes
    .map((c) => ({
      ...c,
      fill: c.attended / Math.max(c.capacity, 1),
      noShow: (c.booked - c.attended) / Math.max(c.booked, 1),
      empty: Math.max(0, c.capacity - c.attended),
      pressure: c.waitlisted - Math.max(0, c.capacity - c.attended),
    }))
    .sort((a, b) => b.pressure - a.pressure)
  const capacity = rows.reduce((a, r) => a + r.capacity, 0)
  const attended = rows.reduce((a, r) => a + r.attended, 0)
  const waitlisted = rows.reduce((a, r) => a + r.waitlisted, 0)
  const empty = rows.reduce((a, r) => a + r.empty, 0)
  const over = rows.filter((r) => r.pressure > 0)
  const under = rows.filter((r) => r.fill < 0.5)
  const noShowOverall = 1 - attended / Math.max(rows.reduce((a, r) => a + r.booked, 0), 1)
  const maxWait = Math.max(...rows.map((r) => r.waitlisted), 1)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={`${r.name}-${r.slot}`}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">
                {r.name} <span className="text-muted-foreground">{r.slot}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {r.attended}/{r.capacity} · {(r.fill * 100).toFixed(0)}%
                {r.waitlisted > 0 ? ` · ${r.waitlisted} waiting` : ""}
              </span>
            </div>
            {/* the track keeps a fixed gutter on its right for the waitlist,
                which is demand PAST capacity — hung off the edge with a
                translate it simply runs out of the card */}
            <div className="mt-0.5 flex h-5 items-stretch gap-1">
            <div className="relative flex-1 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-l-[2px] bg-foreground/60" style={{ width: `${clamp(r.fill * 100, 0, 100)}%` }} title={`${r.attended} attended`} />
              {r.booked > r.attended && (
                <div
                  className="absolute inset-y-0"
                  style={{ left: `${clamp(r.fill * 100, 0, 100)}%`, width: `${clamp(((r.booked - r.attended) / Math.max(r.capacity, 1)) * 100, 0, 100 - r.fill * 100)}%`, background: "color-mix(in oklch, currentColor 22%, transparent)" }}
                  title={`${r.booked - r.attended} booked and did not come`}
                />
              )}
            </div>
            <div className="relative w-12 shrink-0 rounded-[2px] bg-muted/50">
              {r.waitlisted > 0 && (
                <div
                  className="absolute inset-y-0 left-0 rounded-[2px]"
                  style={{ width: `${clamp((r.waitlisted / Math.max(maxWait, 1)) * 100, 8, 100)}%`, background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)", outline: "1px solid currentColor", outlineOffset: -1 }}
                  title={`${r.waitlisted} turned away`}
                />
              )}
            </div>
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.booked} booked, {r.attended} came ({(r.noShow * 100).toFixed(0)}% did not) ·{" "}
              {r.pressure > 0 ? `${r.pressure} more people than the room holds` : `${r.empty} mats empty`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Solid is ATTENDED, pale is booked-and-absent, and the hatch in the gutter to the right is the WAITLIST —
        outside capacity, because it is demand the room could not hold rather than more fill ·{" "}
        {attended} of {capacity} places were used and {waitlisted} people were turned away from the same timetable,
        which is the whole point: {over.length} {plural(over.length, "class is", "classes are")} over-subscribed
        while {under.length} {plural(under.length, "runs", "run")} under half full and {empty} mats sat empty ·{" "}
        {(noShowOverall * 100).toFixed(0)}% of bookings did not turn up, so a full class is not a full room ·{" "}
        {over.length > 0 && under.length > 0
          ? `moving ${under[0].name} ${under[0].slot} next to ${over[0].name} ${over[0].slot} costs nothing and is worth more than another instructor`
          : "the timetable has no obvious swap in it, so capacity is the real constraint"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * VisitFrequency — members by visits a month, with the SLEEPERS named.
 * The members who never come are the profit and the churn risk at the
 * same time, and an attendance average hides them completely by
 * mixing them with people who come four times a week.
 * ------------------------------------------------------------------ */
export function VisitFrequency({
  bands,
  monthlyFee,
  costPerVisit,
  className = "",
}: {
  /** ordered by visits, fewest first */
  bands: { label: string; members: number; meanVisits: number; churnRate: number }[]
  monthlyFee: number
  /** what a visit costs the gym in staff, cleaning and wear */
  costPerVisit: number
  className?: string
}) {
  const rows = bands.map((b) => {
    const revenue = b.members * monthlyFee
    const cost = b.members * b.meanVisits * costPerVisit
    return { ...b, revenue, cost, contribution: revenue - cost, perMember: monthlyFee - b.meanVisits * costPerVisit }
  })
  const max = Math.max(...rows.map((r) => Math.abs(r.contribution)), 1)
  const members = rows.reduce((a, r) => a + r.members, 0)
  const contribution = rows.reduce((a, r) => a + r.contribution, 0)
  const sleepers = rows.filter((r) => r.meanVisits < 1)
  const sleeperMembers = sleepers.reduce((a, r) => a + r.members, 0)
  const sleeperContribution = sleepers.reduce((a, r) => a + r.contribution, 0)
  const sleeperChurn = sleeperMembers > 0 ? sleepers.reduce((a, r) => a + r.churnRate * r.members, 0) / sleeperMembers : null
  const loss = rows.filter((r) => r.perMember < 0)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.members} members · {r.meanVisits.toFixed(1)} visits/mo · {(r.churnRate * 100).toFixed(0)}% churn
              </span>
            </div>
            <div className="relative mt-0.5 h-5 rounded-[2px] bg-muted">
              <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/45" />
              <div
                className="absolute inset-y-0"
                style={{
                  left: r.contribution >= 0 ? "50%" : `${50 - (Math.abs(r.contribution) / max) * 50}%`,
                  width: `${(Math.abs(r.contribution) / max) * 50}%`,
                  background: r.contribution >= 0 ? "color-mix(in oklch, currentColor 55%, transparent)" : "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)",
                  outline: r.contribution < 0 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`${money(r.contribution)} a month`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.contribution)} a month · {money(r.perMember)} a member after{" "}
              {money(r.meanVisits * costPerVisit)} of visit cost
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A gym is paid by the month and costs by the visit, so contribution rises as attendance falls — which is why
        the members who never come are simultaneously the profit and the risk ·{" "}
        {sleeperMembers === 0
          ? "nobody here averages under one visit a month, so there is no sleeper population to manage"
          : `${sleeperMembers} of ${members} members (${((sleeperMembers / Math.max(members, 1)) * 100).toFixed(0)}%) come less than once a month, ${money(sleeperContribution)} of the ${money(contribution)} total${sleeperChurn !== null ? `, and they churn at ${(sleeperChurn * 100).toFixed(0)}% — the moment they notice the direct debit they are gone` : ""}`}{" "}
        ·{" "}
        {loss.length === 0
          ? "no band costs more in visits than it pays in fees"
          : `${loss.length} ${plural(loss.length, "band costs", "bands cost")} more to serve than it pays, which is a pricing question and not a reason to want fewer people in the building`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * FloorLoad — equipment areas by hour, with the QUEUE derived. A gym
 * is sized on total members and experienced as whether there was a
 * squat rack free at six o'clock, which is a different question about
 * a single area in a single hour.
 * ------------------------------------------------------------------ */
export function FloorLoad({
  areas,
  hours,
  className = "",
}: {
  /** `usersPerHour[i]` against the stations that area has */
  areas: { name: string; stations: number; usersPerHour: number[] }[]
  hours: string[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!areas.length || !hours.length) return null

  const cells = areas.map((a) => a.usersPerHour.map((u) => ({ u, load: u / Math.max(a.stations, 1), over: Math.max(0, u - a.stations) })))
  const rows = areas.map((a, i) => {
    // annotated, or the accumulator widens to a union with the branch that
    // spreads a bare cell and `hi` disappears from the type
    const peak = cells[i].reduce<{ u: number; load: number; over: number; hi: number }>(
      (best, c, hi) => (c.load > best.load ? { ...c, hi } : best),
      { ...cells[i][0], hi: 0 }
    )
    return { ...a, peak, overHours: cells[i].filter((c) => c.over > 0).length, meanLoad: cells[i].reduce((s, c) => s + c.load, 0) / Math.max(cells[i].length, 1) }
  })
  const worst = rows.reduce((a, r) => (r.peak.load > a.peak.load ? r : a), rows[0])
  const flat = cells.flat()
  const overCells = flat.filter((c) => c.over > 0).length
  // the hour of the day where the most areas are over at once
  const byHour = hours.map((h, hi) => ({ h, hi, over: cells.filter((row) => (row[hi]?.over ?? 0) > 0).length }))
  const worstHour = byHour.reduce((a, b) => (b.over > a.over ? b : a), byHour[0])

  return (
    <div className={className}>
      <div className="space-y-px">
        {rows.map((a, ai) => (
          <div key={a.name} className="flex items-center gap-2">
            <span className="w-36 shrink-0 truncate text-[10px]">
              {a.name} <span className="text-muted-foreground">×{a.stations}</span>
            </span>
            <div className="flex flex-1 gap-px">
              {hours.map((h, hi) => {
                const c = cells[ai][hi]
                return (
                  <div
                    key={h}
                    className="min-w-0 flex-1 rounded-[1px] border border-foreground/10"
                    style={{
                      height: 16,
                      background:
                        c.over > 0
                          ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)"
                          : `color-mix(in oklch, currentColor ${(clamp(c.load, 0, 1) * 75).toFixed(0)}%, transparent)`,
                    }}
                    title={`${a.name} ${h}: ${c.u} people across ${a.stations} stations${c.over > 0 ? ` — ${c.over} waiting` : ""}`}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex gap-px pl-[9.5rem] text-[9px] text-muted-foreground">
        {hours.map((h, i) => (
          <span key={h} className="min-w-0 flex-1 truncate text-center">
            {i % 3 === 0 ? h : ""}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Shade is people per STATION and a hatched cell is more people than stations — a queue, which is what a
        member actually experiences and what a total-members figure can never show ·{" "}
        {overCells} of {flat.length} area-hours are over capacity, worst in {worst.name} at{" "}
        {worst.peak.load.toFixed(1)} people a station around {hours[worst.peak.hi]} ·{" "}
        {worstHour.over === 0
          ? "no single hour has several areas queueing at once, so the pressure is one area rather than the building"
          : `${hours[worstHour.hi]} is the hour ${worstHour.over} ${plural(worstHour.over, "area is", "areas are")} queueing together, which is when somebody decides the gym is too busy`}{" "}
        · adding stations to {worst.name} is a smaller change than adding floor space and fixes the hour people
        leave over
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ContractWall — contracts reaching their minimum term by month, with
 * the EXPOSURE derived. A twelve-month contract book looks stable
 * because everything in it is committed; what it hides is the month
 * when a large intake all become free to leave at once.
 * ------------------------------------------------------------------ */
export function ContractWall({
  months,
  monthlyFee,
  historicRenewalRate,
  className = "",
}: {
  months: { label: string; reachingTerm: number }[]
  monthlyFee: number
  /** the share that has historically stayed past the minimum term */
  historicRenewalRate: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!months.length) return null

  const rows = months.map((m) => ({
    ...m,
    exposure: m.reachingTerm * monthlyFee,
    expectedLoss: m.reachingTerm * (1 - historicRenewalRate) * monthlyFee,
  }))
  const max = Math.max(...rows.map((r) => r.reachingTerm), 1)
  const total = rows.reduce((a, r) => a + r.reachingTerm, 0)
  const mean = total / Math.max(rows.length, 1)
  const loss = rows.reduce((a, r) => a + r.expectedLoss, 0)
  const peak = rows.reduce((a, r) => (r.reachingTerm > a.reachingTerm ? r : a), rows[0])
  const peakIndex = rows.indexOf(peak)
  const spikes = rows.filter((r) => r.reachingTerm > mean * 1.5)

  return (
    <div className={className}>
      <div className="relative flex items-stretch gap-px rounded-[2px] border border-foreground/15" style={{ height: 130 }}>
        {rows.map((r) => (
          <div key={r.label} className="relative min-w-0 flex-1" title={`${r.label}: ${r.reachingTerm} out of contract, ${money(r.exposure)} a month at risk`}>
            <div
              className="absolute inset-x-0 bottom-0 rounded-t-[1px]"
              style={{
                height: `${(r.reachingTerm / max) * 100}%`,
                background: r.reachingTerm > mean * 1.5 ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)" : "color-mix(in oklch, currentColor 45%, transparent)",
                outline: r.reachingTerm > mean * 1.5 ? "1px solid currentColor" : undefined,
                outlineOffset: -1,
              }}
            />
          </div>
        ))}
        <span className="absolute inset-x-0 border-t border-dashed border-foreground/60" style={{ bottom: `${(mean / max) * 100}%` }} title={`mean ${mean.toFixed(0)} a month`} />
      </div>
      <div className="mt-0.5 flex gap-px text-[9px] text-muted-foreground">
        {rows.map((r, i) => (
          <span key={r.label} className="min-w-0 flex-1 truncate text-center">
            {i % 2 === 0 ? r.label : ""}
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Out of term</dt>
          <dd className="font-medium tabular-nums">{total}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Peak month</dt>
          <dd className="truncate font-medium">{peak.label}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Peak size</dt>
          <dd className="font-medium tabular-nums">×{(peak.reachingTerm / Math.max(mean, 1e-9)).toFixed(1)} mean</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Expected loss</dt>
          <dd className="font-medium tabular-nums">{money(loss)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A contract book reads as stable because everything in it is committed — this is the month each commitment
        ENDS, which is the only date any of it can be acted on · {total} members come out of term across{" "}
        {rows.length} months, {money(loss)} of monthly fee expected to go at a{" "}
        {(historicRenewalRate * 100).toFixed(0)}% renewal rate ·{" "}
        {spikes.length === 0
          ? "no month runs more than half again above the mean, so the book is genuinely level and there is no wall to plan for"
          : `${peak.label} is the wall at ×${(peak.reachingTerm / Math.max(mean, 1e-9)).toFixed(1)} the mean — the ${ord(peakIndex + 1)} month of the window, and the retention effort belongs a month BEFORE it rather than in it`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PtAttach — personal training taken by member segment, with the VALUE
 * PER MEMBER derived. A second product is sold to whoever asks, and
 * the segment that asks is rarely the segment where it does the most
 * good — for the member or for the retention figure.
 * ------------------------------------------------------------------ */
export function PtAttach({
  segments,
  sessionPrice,
  trainerCostShare,
  className = "",
}: {
  segments: { name: string; members: number; withPt: number; sessionsPerMonth: number; churnWithPt: number; churnWithout: number }[]
  sessionPrice: number
  /** the share of the session price that goes to the trainer */
  trainerCostShare: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!segments.length) return null

  const rows = segments
    .map((s) => {
      const attach = s.withPt / Math.max(s.members, 1)
      const marginPerSession = sessionPrice * (1 - trainerCostShare)
      const margin = s.withPt * s.sessionsPerMonth * marginPerSession
      return {
        ...s,
        attach,
        margin,
        perMember: margin / Math.max(s.members, 1),
        churnGap: s.churnWithout - s.churnWithPt,
        // members who would stay if the whole segment took it, at this gap
        retentionUpside: (s.members - s.withPt) * (s.churnWithout - s.churnWithPt),
      }
    })
    .sort((a, b) => b.perMember - a.perMember)
  const max = Math.max(...rows.map((r) => r.perMember), 0.01)
  const members = rows.reduce((a, r) => a + r.members, 0)
  const withPt = rows.reduce((a, r) => a + r.withPt, 0)
  const margin = rows.reduce((a, r) => a + r.margin, 0)
  const bestAttach = rows.reduce((a, r) => (r.attach > a.attach ? r : a), rows[0])
  const bestRetention = rows.reduce((a, r) => (r.churnGap > a.churnGap ? r : a), rows[0])
  const upside = rows.reduce((a, r) => a + r.retentionUpside, 0)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.withPt} of {r.members} · {(r.attach * 100).toFixed(0)}% attach · {r.sessionsPerMonth.toFixed(1)}{" "}
                sessions/mo
              </span>
            </div>
            <div className="relative mt-0.5 h-5 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/55" style={{ width: `${clamp((r.perMember / max) * 100, 1, 100)}%` }} title={`${money(r.perMember)} per member of the segment`} />
              {/* the churn gap as a mark: the reason to sell it that has
                  nothing to do with what the sessions bill */}
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${clamp((r.churnGap / 0.2) * 100, 0, 99)}%` }} title={`${(r.churnGap * 100).toFixed(1)} points less churn with PT`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.perMember)} a member · churn {(r.churnWithout * 100).toFixed(0)}% → {(r.churnWithPt * 100).toFixed(0)}%
              {r.churnGap > 0 ? `, ${(r.churnGap * 100).toFixed(1)} points better` : ", no better"} ·{" "}
              {money(r.margin)} of margin
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is margin spread across the WHOLE segment and the mark is the churn gap, on a scale to 20 points ·{" "}
        {withPt} of {members} members take personal training ({((withPt / Math.max(members, 1)) * 100).toFixed(0)}%),{" "}
        {money(margin)} of margin at {((1 - trainerCostShare) * 100).toFixed(0)}% of a {money(sessionPrice)} session
        ·{" "}
        {bestAttach.name === bestRetention.name
          ? `${bestAttach.name} both takes it most and benefits most, which means the selling is already pointed the right way`
          : `${bestAttach.name} takes it most and ${bestRetention.name} benefits most — the sessions are being sold to the people who ask rather than the people they hold`}{" "}
        · closing that gap is worth about {upside.toFixed(0)} members a month in retention alone, before a single
        session is billed
      </p>
    </div>
  )
}
