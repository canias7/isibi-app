/**
 * Library primitives — loan turnover, shelf dwell, holds queues, weeding,
 * e-resource value and footfall.
 *
 * How hard each copy of a title works, how long a book sits between loans,
 * the wait a queue really produces, which items have earned their shelf,
 * what a database costs per use and when a building is actually busy are
 * all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) =>
  "£" + (Math.abs(v) < 10 ? Math.abs(v).toFixed(2) : Math.round(Math.abs(v)).toLocaleString("en-GB"))
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/* ------------------------------------------------------------------ *
 * LoanTurnover — loans per COPY, not per title. A popular book with
 * twelve copies and a quiet one with a single copy look identical in
 * a loans ranking and need opposite decisions.
 * ------------------------------------------------------------------ */
export function LoanTurnover({
  titles,
  months = 12,
  className = "",
}: {
  titles: { name: string; copies: number; loans: number; holds?: number }[]
  months?: number
  className?: string
}) {
  const rows = titles
    .map((t) => ({
      ...t,
      perCopy: t.loans / Math.max(t.copies, 1),
      perCopyPerMonth: t.loans / Math.max(t.copies * months, 1),
      holdsPerCopy: (t.holds ?? 0) / Math.max(t.copies, 1),
    }))
    .sort((a, b) => b.perCopy - a.perCopy)
  const byLoans = [...rows].sort((a, b) => b.loans - a.loans)
  const totalLoans = rows.reduce((a, r) => a + r.loans, 0)
  const totalCopies = rows.reduce((a, r) => a + r.copies, 0)
  const stockTurn = totalLoans / Math.max(totalCopies, 1)
  const max = Math.max(...rows.map((r) => r.perCopy))
  const needsCopies = rows.filter((r) => r.holdsPerCopy >= 3)
  const flipped = byLoans[0].name !== rows[0].name

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.copies} {plural(r.copies, "copy", "copies")} · {r.loans} loans
                {r.holds !== undefined ? ` · ${r.holds} on hold` : ""}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(r.perCopy / max) * 100}%`,
                  background: r.holdsPerCopy >= 3 ? "currentColor" : "color-mix(in oklch, currentColor 52%, transparent)",
                }}
                title={`${r.perCopy.toFixed(1)} loans a copy`}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${clamp((stockTurn / max) * 100, 0, 100)}%` }} title={`stock turn ${stockTurn.toFixed(1)}`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.perCopy.toFixed(1)} loans a copy · {r.perCopyPerMonth.toFixed(2)} a month
              {r.holds !== undefined ? ` · ${r.holdsPerCopy.toFixed(1)} waiting per copy` : ""}
              {r.holdsPerCopy >= 3 ? " — buy another" : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is loans per COPY, which is the only figure that compares a title with twelve copies against one with
        a single copy · stock turn across these titles is {stockTurn.toFixed(1)} loans a copy in {months} months ·{" "}
        {flipped
          ? `${byLoans[0].name} takes the most loans and ${rows[0].name} works its copies hardest, and the second is the one to buy more of`
          : `${rows[0].name} leads on both, so it is unambiguously the one to buy more of`}{" "}
        · {needsCopies.length} {plural(needsCopies.length, "title has", "titles have")} three or more people waiting
        on every copy
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ShelfDwell — how long an item sits between loans, by section. The
 * distribution is what matters: a section can have a fine average and
 * a third of its stock untouched for a year.
 * ------------------------------------------------------------------ */
export function ShelfDwell({
  sections,
  deadAfterDays = 365,
  className = "",
}: {
  /** the number of items in each dwell band, per section */
  sections: { name: string; bands: number[] }[]
  /** the band edges in days, one shorter than the bands */
  deadAfterDays?: number
  className?: string
}) {
  const bandLabels = ["< 30 d", "30–90", "90–180", "180–365", "> 365"]
  const rows = sections
    .map((s) => {
      const total = s.bands.reduce((a, v) => a + v, 0)
      const dead = s.bands[s.bands.length - 1]
      // the median band, which a mean of a long-tailed distribution misses
      let run = 0
      const medianBand = s.bands.findIndex((v) => (run += v) >= total / 2)
      return { ...s, total, dead, deadShare: dead / Math.max(total, 1), medianBand }
    })
    .sort((a, b) => b.deadShare - a.deadShare)
  const items = rows.reduce((a, r) => a + r.total, 0)
  const deadItems = rows.reduce((a, r) => a + r.dead, 0)
  const shade = (i: number) => `color-mix(in oklch, currentColor ${(16 + i * 18).toFixed(0)}%, transparent)`
  const worst = rows[0]

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.total.toLocaleString()} items · median band {bandLabels[r.medianBand]}
              </span>
            </div>
            <div className="mt-0.5 flex h-4 overflow-hidden rounded-[2px] border border-foreground/20">
              {r.bands.map((v, i) => (
                <div
                  key={i}
                  className="border-r border-background last:border-r-0"
                  style={{
                    width: `${(v / Math.max(r.total, 1)) * 100}%`,
                    background:
                      i === r.bands.length - 1
                        ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                        : shade(i),
                  }}
                  title={`${bandLabels[i]}: ${v.toLocaleString()} items`}
                />
              ))}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.deadShare * 100).toFixed(0)}% has not moved in a year — {r.dead.toLocaleString()} items
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {bandLabels.map((l, i) => (
          <span key={l} className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25"
              style={{ background: i === bandLabels.length - 1 ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : shade(i) }}
            />
            {l}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The DISTRIBUTION is the point — a section with a respectable average dwell can still have a third of its
        stock untouched, and hatched is exactly that: no loan in {deadAfterDays} days ·{" "}
        {deadItems.toLocaleString()} of {items.toLocaleString()} items,{" "}
        {((deadItems / Math.max(items, 1)) * 100).toFixed(0)}% of the shelf · {worst.name} is the worst at{" "}
        {(worst.deadShare * 100).toFixed(0)}%, which is shelf space rather than a collection
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * HoldsQueue — the wait a queue actually produces, DERIVED from the
 * queue length, the copies and the loan period. A holds list is a
 * number and a borrower wants a date.
 * ------------------------------------------------------------------ */
export function HoldsQueue({
  titles,
  loanWeeks,
  targetWeeks,
  className = "",
}: {
  titles: { name: string; copies: number; holds: number; onOrder?: number }[]
  loanWeeks: number
  /** the wait a library aims to keep people under */
  targetWeeks?: number
  className?: string
}) {
  const rows = titles
    .map((t) => {
      const copiesNow = t.copies
      const copiesSoon = t.copies + (t.onOrder ?? 0)
      const weeks = (t.holds / Math.max(copiesNow, 1)) * loanWeeks
      const weeksAfter = (t.holds / Math.max(copiesSoon, 1)) * loanWeeks
      // copies needed to bring the wait under the target
      const needed =
        targetWeeks === undefined
          ? null
          : Math.max(0, Math.ceil((t.holds * loanWeeks) / Math.max(targetWeeks, 1e-9)) - copiesSoon)
      return { ...t, weeks, weeksAfter, needed, ratio: t.holds / Math.max(copiesNow, 1) }
    })
    .sort((a, b) => b.weeks - a.weeks)
  const max = Math.max(targetWeeks ?? 0, ...rows.map((r) => r.weeks))
  const over = targetWeeks === undefined ? [] : rows.filter((r) => r.weeksAfter > targetWeeks)
  const totalNeeded = rows.reduce((a, r) => a + (r.needed ?? 0), 0)
  const worst = rows[0]

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.holds} holds on {r.copies} {plural(r.copies, "copy", "copies")}
                {r.onOrder ? ` · ${r.onOrder} on order` : ""}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px]"
                style={{
                  width: `${(r.weeks / max) * 100}%`,
                  background:
                    targetWeeks !== undefined && r.weeksAfter > targetWeeks
                      ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                      : "color-mix(in oklch, currentColor 52%, transparent)",
                  outline: targetWeeks !== undefined && r.weeksAfter > targetWeeks ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`${r.weeks.toFixed(1)} weeks`}
              />
              {r.onOrder ? (
                <span className="absolute inset-y-0 w-1 rounded-[1px] bg-foreground" style={{ left: `${clamp((r.weeksAfter / max) * 100, 0, 99)}%` }} title={`${r.weeksAfter.toFixed(1)} weeks once the order lands`} />
              ) : null}
              {targetWeeks !== undefined && <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(targetWeeks / max) * 100}%` }} title={`target ${targetWeeks} weeks`} />}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              about {r.weeks.toFixed(1)} weeks to the back of the queue
              {r.onOrder ? `, ${r.weeksAfter.toFixed(1)} once the order lands` : ""}
              {r.needed ? ` · ${r.needed} more ${plural(r.needed, "copy", "copies")} to hit the target` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The WAIT is derived from the queue, the copies and a {loanWeeks}-week loan — a holds list gives a number and
        a borrower is asking for a date · {worst.name} is the longest at {worst.weeks.toFixed(1)} weeks
        {targetWeeks !== undefined
          ? ` · ${over.length} of ${rows.length} ${plural(over.length, "title stays", "titles stay")} over the ${targetWeeks}-week target even after what is on order, and ${totalNeeded} more ${plural(totalNeeded, "copy", "copies")} would clear them`
          : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * WeedingCandidates — age against last loan, with the KEEP/WITHDRAW
 * decision derived from both. Age alone withdraws a classic and use
 * alone keeps a book bought last month and never opened.
 * ------------------------------------------------------------------ */
export function WeedingCandidates({
  items,
  maxAgeYears,
  maxIdleYears,
  className = "",
}: {
  items: { name: string; ageYears: number; idleYears: number; copies: number; protectedItem?: boolean }[]
  maxAgeYears: number
  maxIdleYears: number
  className?: string
}) {
  const rows = items.map((i) => {
    const oldAndIdle = i.ageYears > maxAgeYears && i.idleYears > maxIdleYears
    return {
      ...i,
      verdict: i.protectedItem ? "keep, protected" : oldAndIdle ? "withdraw" : i.idleYears > maxIdleYears ? "review" : "keep",
      oldAndIdle,
    }
  })
  const maxAge = Math.max(maxAgeYears * 1.4, ...rows.map((r) => r.ageYears))
  const maxIdle = Math.max(maxIdleYears * 1.4, ...rows.map((r) => r.idleYears))
  const withdraw = rows.filter((r) => r.verdict === "withdraw")
  const review = rows.filter((r) => r.verdict === "review")
  const savedByAgeAlone = rows.filter((r) => r.ageYears > maxAgeYears && r.idleYears <= maxIdleYears)

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height: 200 }}>
        <span className="pointer-events-none absolute bg-foreground/10" style={{ left: `${(maxAgeYears / maxAge) * 100}%`, right: 0, top: 0, height: `${(1 - maxIdleYears / maxIdle) * 100}%` }} />
        <span className="pointer-events-none absolute inset-y-0 w-px bg-foreground/45" style={{ left: `${(maxAgeYears / maxAge) * 100}%` }} />
        <span className="pointer-events-none absolute inset-x-0 border-t border-foreground/45" style={{ top: `${(1 - maxIdleYears / maxIdle) * 100}%` }} />
        {rows.map((r) => {
          const d = 5 + Math.min(r.copies, 8) * 1.6
          return (
            <span
              key={r.name}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground"
              style={{
                left: `${clamp((r.ageYears / maxAge) * 100, 2, 98)}%`,
                top: `${clamp(100 - (r.idleYears / maxIdle) * 100, 3, 97)}%`,
                width: d,
                height: d,
                background: r.protectedItem
                  ? "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 4px)"
                  : r.verdict === "withdraw"
                    ? "currentColor"
                    : "var(--background)",
              }}
              title={`${r.name}: ${r.ageYears} years old, ${r.idleYears} since a loan, ${r.copies} ${plural(r.copies, "copy", "copies")} — ${r.verdict}`}
            />
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>new</span>
        <span>filled: withdraw · hatched: protected · size is copies</span>
        <span>{maxAge.toFixed(0)} years old</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The shaded corner needs BOTH: older than {maxAgeYears} years and unborrowed for more than {maxIdleYears} ·
        age alone would withdraw {savedByAgeAlone.length}{" "}
        {plural(savedByAgeAlone.length, "item that is still being read", "items that are still being read")}, and
        idleness alone would withdraw a book bought last year · {withdraw.length}{" "}
        {plural(withdraw.length, "item is", "items are")} in the corner and {review.length} sit above the idle line
        but young enough to argue about, which is where a librarian's judgement belongs and a rule does not
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * EresourceCostPerUse — a subscription's cost against how much it is
 * used, with COST PER USE derived. The biggest invoice and the worst
 * value are almost never the same database.
 * ------------------------------------------------------------------ */
export function EresourceCostPerUse({
  resources,
  benchmarkPerUse,
  className = "",
}: {
  resources: { name: string; annualCost: number; sessions: number; downloads: number; renewsIn?: number }[]
  /** the cost per use above which a resource is under review */
  benchmarkPerUse?: number
  className?: string
}) {
  const rows = resources
    .map((r) => {
      const uses = r.sessions + r.downloads
      return {
        ...r,
        uses,
        perUse: r.annualCost / Math.max(uses, 1),
        perDownload: r.annualCost / Math.max(r.downloads, 1),
        over: benchmarkPerUse !== undefined && r.annualCost / Math.max(uses, 1) > benchmarkPerUse,
      }
    })
    .sort((a, b) => b.perUse - a.perUse)
  const byCost = [...rows].sort((a, b) => b.annualCost - a.annualCost)
  const spend = rows.reduce((a, r) => a + r.annualCost, 0)
  const uses = rows.reduce((a, r) => a + r.uses, 0)
  const blended = spend / Math.max(uses, 1)
  const max = Math.max(...rows.map((r) => r.perUse))
  const over = rows.filter((r) => r.over)
  const recoverable = over.reduce((a, r) => a + r.annualCost, 0)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">
                {r.name}
                {r.renewsIn !== undefined ? <span className="text-muted-foreground"> · renews in {r.renewsIn} mo</span> : null}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {money(r.annualCost)} · {r.uses.toLocaleString()} uses
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(r.perUse / max) * 100}%`,
                  background: r.over
                    ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                    : "color-mix(in oklch, currentColor 52%, transparent)",
                  outline: r.over ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`${money(r.perUse)} a use`}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${clamp((blended / max) * 100, 0, 100)}%` }} title={`blended ${money(blended)}`} />
              {benchmarkPerUse !== undefined && (
                <span className="absolute inset-y-0 w-px bg-foreground/45" style={{ left: `${clamp((benchmarkPerUse / max) * 100, 0, 100)}%` }} title={`benchmark ${money(benchmarkPerUse)}`} />
              )}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.perUse)} a use ·{" "}
              {r.downloads > 0 ? `${money(r.perDownload)} a full-text download · ` : "no full-text downloads · "}
              {r.sessions.toLocaleString()} sessions, {r.downloads.toLocaleString()} downloads
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is cost per USE, which is the number a renewal conversation needs — {byCost[0].name} is the largest
        invoice at {money(byCost[0].annualCost)} and {rows[0].name} is the worst value at{" "}
        {money(rows[0].perUse)} a use,{" "}
        {byCost[0].name === rows[0].name ? "which is the same subscription" : "which are different subscriptions"} ·{" "}
        {money(spend)} across {uses.toLocaleString()} uses, blended {money(blended)}
        {benchmarkPerUse !== undefined
          ? ` · ${over.length} ${plural(over.length, "resource is", "resources are")} over the ${money(benchmarkPerUse)} benchmark, ${money(recoverable)} of subscription to argue about`
          : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * FootfallByHour — visits by hour and day against staffing, with the
 * VISITS PER STAFF HOUR derived. Opening hours are set by tradition
 * and the building is busy at other times.
 * ------------------------------------------------------------------ */
export function FootfallByHour({
  days,
  hours,
  visits,
  staff,
  className = "",
}: {
  days: string[]
  hours: string[]
  /** visits[day][hour] */
  visits: number[][]
  /** staff on duty, staff[day][hour]; zero means closed */
  staff: number[][]
  className?: string
}) {
  const load = visits.map((row, di) => row.map((v, hi) => (staff[di][hi] > 0 ? v / staff[di][hi] : null)))
  const open = load.flat().filter((v): v is number => v !== null)
  const mean = open.reduce((a, v) => a + v, 0) / Math.max(open.length, 1)
  const max = Math.max(1, ...open)
  const totalVisits = visits.flat().reduce((a, v) => a + v, 0)
  // visits arriving in hours the building is shut, which is the real finding
  const closedVisits = visits.reduce((a, row, di) => a + row.reduce((b, v, hi) => b + (staff[di][hi] === 0 ? v : 0), 0), 0)
  const byHour = hours.map((_, hi) => visits.reduce((a, row) => a + row[hi], 0))
  const peakHour = byHour.indexOf(Math.max(...byHour))
  const stretched = load.flat().filter((v): v is number => v !== null && v > mean * 1.6).length

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background pr-2 text-left font-normal text-muted-foreground">day</th>
              {hours.map((h) => (
                <th key={h} className="px-1 pb-1 font-normal text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d, di) => (
              <tr key={d}>
                <td className="sticky left-0 bg-background pr-2 whitespace-nowrap">{d}</td>
                {hours.map((h, hi) => {
                  const v = load[di][hi]
                  return (
                    <td key={h} className="p-px">
                      <div
                        className="flex h-6 items-center justify-center rounded-[2px]"
                        style={{
                          background:
                            v === null
                              ? visits[di][hi] > 0
                                ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                                : "transparent"
                              : `color-mix(in oklch, currentColor ${clamp((v / max) * 78, 4, 78).toFixed(0)}%, transparent)`,
                          outline: v === null && visits[di][hi] > 0 ? "1px solid currentColor" : undefined,
                          outlineOffset: -1,
                        }}
                        title={
                          v === null
                            ? `${d} ${h}: closed${visits[di][hi] > 0 ? `, ${visits[di][hi]} arrived anyway` : ""}`
                            : `${d} ${h}: ${visits[di][hi]} visits, ${staff[di][hi]} staff — ${v.toFixed(0)} each`
                        }
                      >
                        <span className={v !== null && v / max > 0.6 ? "text-background" : undefined}>
                          {v === null ? (visits[di][hi] > 0 ? "·" : "") : v.toFixed(0)}
                        </span>
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
        Cells are visits per STAFF HOUR, not visits — a busy hour with four people on the desk is not the same
        problem as a quiet one with a single member of staff · the mean is {mean.toFixed(0)} and{" "}
        {stretched} {plural(stretched, "hour runs", "hours run")} more than half again above it · hatched cells are
        hours somebody arrived at a locked door: {closedVisits.toLocaleString()} of{" "}
        {totalVisits.toLocaleString()} visits, {((closedVisits / Math.max(totalVisits, 1)) * 100).toFixed(0)}%, and{" "}
        {hours[peakHour]} is the busiest hour of the week
      </p>
    </div>
  )
}
