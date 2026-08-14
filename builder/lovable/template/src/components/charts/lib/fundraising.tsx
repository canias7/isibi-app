/**
 * Fundraising primitives — the donor pyramid, retention, cost of
 * fundraising, restricted income, the grant pipeline and legacies.
 *
 * The share of income each band gives, the retention and reactivation
 * rates, the cost per pound raised and its payback, the unrestricted
 * income actually available, the weighted pipeline and the expected
 * legacy value are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e6 ? `£${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `£${(a / 1e3).toFixed(0)}k` : a < 10 ? `£${a.toFixed(2)}` : `£${Math.round(a).toLocaleString("en-GB")}`
  return v < 0 ? `−${s}` : s
}

/* ------------------------------------------------------------------ *
 * DonorPyramid — donors by band against the income each band gives.
 * The two shapes are always opposite, and a count of supporters is
 * the number most often reported and least often useful.
 * ------------------------------------------------------------------ */
export function DonorPyramid({
  bands,
  className = "",
}: {
  /** each giving band, from largest gift down */
  bands: { name: string; donors: number; totalGiven: number }[]
  className?: string
}) {
  const rows = [...bands].sort((a, b) => b.totalGiven / Math.max(b.donors, 1) - a.totalGiven / Math.max(a.donors, 1))
  const totalDonors = rows.reduce((a, r) => a + r.donors, 0)
  const totalGiven = rows.reduce((a, r) => a + r.totalGiven, 0)
  const withShare = rows.map((r) => ({
    ...r,
    average: r.totalGiven / Math.max(r.donors, 1),
    donorShare: r.donors / Math.max(totalDonors, 1),
    incomeShare: r.totalGiven / Math.max(totalGiven, 1),
  }))
  let cumD = 0
  let cumI = 0
  const cum = withShare.map((r) => {
    cumD += r.donorShare
    cumI += r.incomeShare
    return { ...r, cumD, cumI }
  })
  // the smallest group of donors giving half the money
  const half = cum.find((r) => r.cumI >= 0.5)
  const maxShare = Math.max(...withShare.map((r) => Math.max(r.donorShare, r.incomeShare)))
  // a band of fourteen people is a real share and rounds to 0.0% — say so, and
  // give the bar a floor, or "very small" is drawn identically to "no data"
  const pc = (v: number) => (v > 0 && v < 0.001 ? "<0.1" : (v * 100).toFixed(1))
  const w = (v: number) => Math.max((v / maxShare) * 100, v > 0 ? 0.7 : 0)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {withShare.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.donors.toLocaleString()} donors · {money(r.average)} average
              </span>
            </div>
            <div className="mt-0.5 space-y-px">
              <div className="h-2.5 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground/28" style={{ width: `${w(r.donorShare)}%` }} title={`${pc(r.donorShare)}% of donors`} />
              </div>
              <div className="h-2.5 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground" style={{ width: `${w(r.incomeShare)}%` }} title={`${pc(r.incomeShare)}% of income`} />
              </div>
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {pc(r.donorShare)}% of donors give {pc(r.incomeShare)}% of the income ·{" "}
              {money(r.totalGiven)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is the share of DONORS, solid the share of INCOME, and they always point opposite ways ·{" "}
        {half
          ? `the top ${pc(half.cumD)}% of supporters give half of ${money(totalGiven)}`
          : `no band reaches half the income on its own`}{" "}
        · a supporter count is the number most often reported in an annual review, and it describes the pale bars
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * GiftRetention — a cohort's giving over the years after it joined.
 * First-year retention is the number that decides everything, and a
 * headcount of active donors conceals it completely.
 * ------------------------------------------------------------------ */
export function GiftRetention({
  cohorts,
  className = "",
}: {
  /** donors still giving in each year after joining, starting at year 0 */
  cohorts: { name: string; retained: number[] }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!cohorts.length) return null

  const rows = cohorts.map((c) => {
    const start = c.retained[0] || 1
    const rates = c.retained.map((v) => v / start)
    // a cohort too young to have a second year is UNKNOWN, never zero — reading
    // an absent figure as a retention of nought makes the newest cohort the worst
    const yearOne = rates.length > 1 ? rates[1] : null
    const later = rates.slice(2).map((v, i) => v / Math.max(rates[i + 1], 1e-9))
    return { ...c, start, rates, yearOne, steady: later.length ? later.reduce((a, v) => a + v, 0) / later.length : 0 }
  })
  const maxYears = Math.max(...rows.map((r) => r.rates.length))
  const measured = rows.filter((r) => r.yearOne !== null)
  const bestFirst = measured.reduce((a, r) => (r.yearOne! > a.yearOne! ? r : a), measured[0])
  const worstFirst = measured.reduce((a, r) => (r.yearOne! < a.yearOne! ? r : a), measured[0])

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background pr-2 text-left font-normal text-muted-foreground">cohort</th>
              {Array.from({ length: maxYears }, (_, i) => (
                <th key={i} className="px-1 pb-1 font-normal text-muted-foreground">
                  y{i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="sticky left-0 bg-background pr-2 whitespace-nowrap">
                  {r.name}
                  <span className="ml-1 text-muted-foreground">{r.start.toLocaleString()}</span>
                </td>
                {Array.from({ length: maxYears }, (_, i) => {
                  const v = r.rates[i]
                  return (
                    <td key={i} className="p-px">
                      {v === undefined ? (
                        <div className="h-6" />
                      ) : (
                        <div
                          className="flex h-6 items-center justify-center rounded-[2px]"
                          style={{ background: `color-mix(in oklch, currentColor ${clamp(v * 84, 4, 84).toFixed(0)}%, transparent)` }}
                          title={`${r.name} year ${i}: ${(v * 100).toFixed(0)}%`}
                        >
                          <span className={v > 0.62 ? "text-background" : undefined}>{(v * 100).toFixed(0)}</span>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Cells are the share of each cohort still giving, INDEXED to the year it joined — a raw count of active donors
        mixes cohorts and hides all of this · first-year retention runs from{" "}
        {(worstFirst.yearOne! * 100).toFixed(0)}% ({worstFirst.name}) to {(bestFirst.yearOne! * 100).toFixed(0)}% (
        {bestFirst.name}) across the {measured.length} cohorts old enough to have one, and afterwards every cohort
        holds about {(rows.reduce((a, r) => a + r.steady, 0) / Math.max(rows.length, 1) * 100).toFixed(0)}% of what it
        had the year before · the first year is the whole decision, and it is made by what happens in the first eight
        weeks
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CostPerPound — what each channel costs to raise a pound, with the
 * PAYBACK derived from lifetime value. A high cost of acquisition is
 * not a bad channel; a long payback in a short-funded charity is.
 * ------------------------------------------------------------------ */
export function CostPerPound({
  channels,
  className = "",
}: {
  channels: {
    name: string
    spend: number
    raisedYearOne: number
    /** the average gift value a recruited donor gives per year afterwards */
    annualValue?: number
    retention?: number
  }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!channels.length) return null

  const rows = channels
    .map((c) => {
      const cpp = c.spend / Math.max(c.raisedYearOne, 1e-9)
      // lifetime value with a constant annual retention, summed as a series
      const r = clamp(c.retention ?? 0, 0, 0.98)
      const ltv = c.annualValue === undefined ? null : c.annualValue / Math.max(1 - r, 1e-9)
      const donors = c.annualValue ? c.raisedYearOne / Math.max(c.annualValue, 1e-9) : null
      const paybackYears = donors && c.annualValue ? c.spend / Math.max(donors * c.annualValue, 1e-9) : null
      return { ...c, cpp, ltv, donors, paybackYears, roi: ltv && donors ? (donors * ltv) / Math.max(c.spend, 1e-9) : null }
    })
    .sort((a, b) => a.cpp - b.cpp)
  const totalSpend = rows.reduce((a, r) => a + r.spend, 0)
  const totalRaised = rows.reduce((a, r) => a + r.raisedYearOne, 0)
  const blended = totalSpend / Math.max(totalRaised, 1e-9)
  const max = Math.max(...rows.map((r) => r.cpp)) * 1.1
  const bestLifetime = rows.filter((r) => r.roi !== null).reduce((a, r) => (r.roi! > (a.roi ?? -1) ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {money(r.spend)} spent · {money(r.raisedYearOne)} in year one
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${clamp((r.cpp / max) * 100, 1, 100)}%`,
                  background: r.cpp > 1 ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 55%, transparent)",
                  outline: r.cpp > 1 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`${money(r.cpp)} to raise £1`}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${clamp((blended / max) * 100, 0, 100)}%` }} title={`blended ${money(blended)}`} />
              <span className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${clamp((1 / max) * 100, 0, 100)}%` }} title="break even in year one" />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.cpp)} per £1 in year one
              {r.paybackYears !== null ? ` · pays back in ${r.paybackYears.toFixed(1)} years` : ""}
              {r.roi !== null ? ` · ${r.roi.toFixed(1)}× over a lifetime` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched channels cost more than a pound to raise a pound IN YEAR ONE, which is normal for recruitment and
        alarming on a trustee report · the thick mark is the blended {money(blended)}, the thin one is break-even ·{" "}
        {bestLifetime.roi !== null
          ? `${bestLifetime.name} returns ${bestLifetime.roi.toFixed(1)}× over a donor's lifetime despite costing ${money(bestLifetime.cpp)} up front — the question is never the cost, it is whether the charity can fund the ${bestLifetime.paybackYears?.toFixed(1)} years to payback`
          : "no channel has a stated lifetime value, so only the first year can be judged"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RestrictedSplit — income by restriction against the cost of running
 * the charity. Total income is the headline; unrestricted income is
 * what actually keeps the lights on, and it is derived.
 * ------------------------------------------------------------------ */
export function RestrictedSplit({
  sources,
  coreCosts,
  className = "",
}: {
  sources: { name: string; amount: number; restricted: boolean; recoveryRate?: number }[]
  /** what it costs to run the organisation, which restricted money mostly cannot pay for */
  coreCosts: number
  className?: string
}) {
  const rows = [...sources].sort((a, b) => b.amount - a.amount)
  const total = rows.reduce((a, s) => a + s.amount, 0)
  const unrestricted = rows.filter((s) => !s.restricted).reduce((a, s) => a + s.amount, 0)
  // restricted grants often carry a contribution to overheads
  const recovered = rows
    .filter((s) => s.restricted)
    .reduce((a, s) => a + s.amount * (s.recoveryRate ?? 0), 0)
  const available = unrestricted + recovered
  const gap = coreCosts - available
  const max = Math.max(...rows.map((s) => s.amount))

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span aria-hidden className="w-3">
              {s.restricted ? "◧" : "●"}
            </span>
            <span className="w-32 shrink-0 truncate">{s.name}</span>
            <div className="h-3 flex-1 rounded-[1px] bg-muted">
              <div
                className="h-full rounded-[1px]"
                style={{
                  width: `${(s.amount / max) * 100}%`,
                  background: s.restricted
                    ? "repeating-linear-gradient(45deg, currentColor 0 2px, transparent 2px 5px)"
                    : "currentColor",
                  outline: s.restricted ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
              />
            </div>
            <span className="w-28 shrink-0 text-right text-muted-foreground">
              {money(s.amount)}
              {s.restricted && s.recoveryRate ? ` · ${(s.recoveryRate * 100).toFixed(0)}% overhead` : ""}
            </span>
          </li>
        ))}
      </ul>
      {/* the derived comparison, which is the whole point */}
      <div className="mt-3 space-y-1">
        <div className="flex items-baseline justify-between text-[10px]">
          <span className="text-muted-foreground">Core costs</span>
          <span className="tabular-nums">{money(coreCosts)}</span>
        </div>
        <div className="relative h-5 rounded-[2px] bg-muted">
          <div className="h-full rounded-[2px] bg-foreground/70" style={{ width: `${clamp((available / Math.max(coreCosts, 1e-9)) * 100, 0, 100)}%` }} title={`available: ${money(available)}`} />
          <span className="absolute inset-y-0 right-0 w-0.5 bg-foreground" />
        </div>
        <div className="flex items-baseline justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>
            {money(unrestricted)} unrestricted + {money(recovered)} recovered
          </span>
          <span>{gap > 0 ? `${money(gap)} short` : `${money(-gap)} spare`}</span>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        {money(total)} of income, of which only {money(available)} can pay for the organisation —{" "}
        {((available / Math.max(total, 1e-9)) * 100).toFixed(0)}% · hatched sources are RESTRICTED and mostly cannot
        touch core costs, whatever the total says ·{" "}
        {gap > 0
          ? `the ${money(gap)} gap is what a growing charity discovers after a record fundraising year, and it is the reason overhead recovery is negotiated rather than accepted`
          : `core costs are covered with ${money(-gap)} to spare, which is what makes the restricted income safe to accept`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * GrantPipeline — applications by stage, WEIGHTED by the probability
 * each stage actually converts. A pipeline total is the least
 * reliable number in a fundraising report.
 * ------------------------------------------------------------------ */
export function GrantPipeline({
  applications,
  stageProbability,
  targetIncome,
  className = "",
}: {
  applications: { name: string; amount: number; stage: string; decisionMonth?: string }[]
  /** the historic conversion rate of each stage */
  stageProbability: Record<string, number>
  targetIncome?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!applications.length || !Object.keys(stageProbability).length) return null

  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!applications.length || !Object.keys(stageProbability).length) return null

  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!applications.length || !Object.keys(stageProbability).length) return null

  const stages = Object.keys(stageProbability)
  const rows = stages.map((s) => {
    const apps = applications.filter((a) => a.stage === s)
    const raw = apps.reduce((a, x) => a + x.amount, 0)
    const p = stageProbability[s] ?? 0
    return { stage: s, apps, raw, p, weighted: raw * p }
  })
  const raw = rows.reduce((a, r) => a + r.raw, 0)
  const weighted = rows.reduce((a, r) => a + r.weighted, 0)
  const max = Math.max(...rows.map((r) => r.raw))
  const shortfall = targetIncome === undefined ? null : targetIncome - weighted
  const biggest = rows.reduce((a, r) => (r.weighted > a.weighted ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.stage}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.stage}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.apps.length} application{r.apps.length === 1 ? "" : "s"} · {(r.p * 100).toFixed(0)}% convert
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/22" style={{ width: `${(r.raw / max) * 100}%` }} title={`raw ${money(r.raw)}`} />
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground" style={{ width: `${(r.weighted / max) * 100}%` }} title={`weighted ${money(r.weighted)}`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.raw)} applied for → {money(r.weighted)} expected
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Pipeline</dt>
          <dd className="font-medium tabular-nums">{money(raw)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Expected</dt>
          <dd className="font-medium tabular-nums">{money(weighted)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{targetIncome === undefined ? "Conversion" : "Against target"}</dt>
          <dd className="font-medium tabular-nums">
            {targetIncome === undefined
              ? `${((weighted / Math.max(raw, 1e-9)) * 100).toFixed(0)}%`
              : shortfall! > 0
                ? `${money(shortfall!)} short`
                : `${money(-shortfall!)} over`}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is what was applied for and solid is what the stage's own conversion rate says will arrive —{" "}
        {money(raw)} of pipeline is {money(weighted)} of income, and reporting the first is how a board is surprised
        in March · {biggest.stage} carries the most expected value at {money(biggest.weighted)}
        {shortfall !== null && shortfall > 0
          ? `, and the ${money(shortfall)} gap needs applications submitted now, not decisions chased`
          : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * LegacyProjection — pledges against expected realisation. A legacy
 * income forecast is a mortality calculation, and treating pledges as
 * a pipeline gets the timing catastrophically wrong.
 * ------------------------------------------------------------------ */
export function LegacyProjection({
  pledges,
  yearsAhead = 10,
  className = "",
}: {
  /** each pledger's age, expected estate share and probability the gift survives */
  pledges: { name: string; age: number; expectedValue: number; retentionProbability?: number }[]
  yearsAhead?: number
  className?: string
}) {
  // NOTHING TO DRAW IS NOT A CHART OF NOTHING. An empty array made every
  // scale here degenerate and wrote NaN into an SVG attribute, which the
  // browser drops — so the chart rendered as a blank box rather than as the
  // empty state the page around it is showing. `useRows` hands back `[]`
  // before the query settles and on every site whose owner has added nothing.
  if (!pledges.length) return null

  // a coarse mortality table is enough here and is stated as such
  const qx = (age: number) => clamp(0.00008 * Math.pow(1.093, age), 0, 0.5)
  const rows = pledges.map((p) => {
    const keep = p.retentionProbability ?? 0.85
    let alive = 1
    const byYear = Array.from({ length: yearsAhead }, (_, i) => {
      const q = qx(p.age + i)
      const dies = alive * q
      alive -= dies
      return dies * p.expectedValue * keep
    })
    return { ...p, byYear, total: byYear.reduce((a, v) => a + v, 0) }
  })
  const years = Array.from({ length: yearsAhead }, (_, i) =>
    rows.reduce((a, r) => a + r.byYear[i], 0),
  )
  const notional = pledges.reduce((a, p) => a + p.expectedValue, 0)
  const expected = years.reduce((a, v) => a + v, 0)
  const max = Math.max(...years)
  const firstFive = years.slice(0, 5).reduce((a, v) => a + v, 0)
  const meanAge = pledges.reduce((a, p) => a + p.age, 0) / Math.max(pledges.length, 1)

  return (
    <div className={className}>
      <div className="flex items-stretch gap-1 rounded-[2px] border border-foreground/15" style={{ height: 130 }}>
        {years.map((v, i) => (
          <div key={i} className="relative min-w-0 flex-1" title={`year ${i + 1}: ${money(v)}`}>
            <div className="absolute inset-x-0 bottom-0 rounded-t-[1px] bg-foreground/65" style={{ height: `${(v / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex gap-1 text-[9px] text-muted-foreground tabular-nums">
        {years.map((_, i) => (
          <span key={i} className="min-w-0 flex-1 truncate text-center">
            {i % 2 === 0 ? `y${i + 1}` : ""}
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Pledged</dt>
          <dd className="font-medium tabular-nums">{money(notional)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Expected</dt>
          <dd className="font-medium tabular-nums">{money(expected)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">First five years</dt>
          <dd className="font-medium tabular-nums">{money(firstFive)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mean age</dt>
          <dd className="font-medium tabular-nums">{meanAge.toFixed(0)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A legacy forecast is a MORTALITY calculation, not a pipeline — each pledge is spread across the years by the
        chance it falls due in each, then discounted by the chance the will is changed ·{" "}
        {money(notional)} of pledges produces {money(expected)} over {yearsAhead} years,{" "}
        {((firstFive / Math.max(expected, 1e-9)) * 100).toFixed(0)}% of it in the first five · treating pledges as this
        year's income is how a legacy team is judged against a number nobody could have hit
      </p>
    </div>
  )
}
