/**
 * Actuarial primitives — mortality, lapse, reserve run-off, cohort survival,
 * annuity pricing and morbidity incidence.
 *
 * Life expectancy from the qx table, the shape of lapse against duration,
 * the reserve released each year, the survival curve from the exposure, the
 * annuity factor from the discount rate and the survivorship, and the incidence
 * per thousand lives are all DERIVED. An annuity factor taken as a prop cannot
 * show how much of the price is interest and how much is longevity.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) => "£" + Math.round(Math.abs(v)).toLocaleString("en-GB")

/* ------------------------------------------------------------------ *
 * MortalityTable — qx by age, with life expectancy computed from the
 * table rather than quoted alongside it.
 * ------------------------------------------------------------------ */
export function MortalityTable({
  rates,
  fromAge,
  height = 200,
  className = "",
}: {
  /** probability of dying within the year, from `fromAge` upward */
  rates: { age: number; qx: number; label?: string }[]
  fromAge: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!rates.length) return null

  const sorted = [...rates].sort((a, b) => a.age - b.age)
  // lx from the qx chain, then ex as the summed survivorship
  let l = 1
  const chain = sorted.map((r) => {
    const entry = { ...r, lx: l }
    l *= 1 - r.qx
    return { ...entry, lxNext: l }
  })
  const start = chain.find((c) => c.age >= fromAge) ?? chain[0]
  const after = chain.filter((c) => c.age >= start.age)
  const ex = after.reduce((a, c) => a + (c.lx + c.lxNext) / 2 / Math.max(start.lx, 1e-12), 0)

  const lo = Math.log10(Math.max(1e-5, Math.min(...sorted.map((r) => r.qx))))
  const hi = Math.log10(Math.max(...sorted.map((r) => r.qx)))
  const px = (a: number) => ((a - sorted[0].age) / Math.max(sorted[sorted.length - 1].age - sorted[0].age, 1)) * 100
  const py = (q: number) => 100 - ((Math.log10(Math.max(1e-5, q)) - lo) / Math.max(hi - lo, 1e-9)) * 94 - 3
  // the age at which the rate doubles from age 40, the Gompertz signature
  const at40 = chain.reduce((a, c) => (Math.abs(c.age - 40) < Math.abs(a.age - 40) ? c : a), chain[0])
  const doubles = chain.find((c) => c.age > at40.age && c.qx >= at40.qx * 2)

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline points={sorted.map((r) => `${px(r.age)},${py(r.qx)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          <line x1={px(start.age)} y1={0} x2={px(start.age)} y2={100} stroke="currentColor" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.55} />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>age {sorted[0].age}</span>
        <span>log qx</span>
        <span>age {sorted[sorted.length - 1].age}</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">qx at {start.age}</dt>
          <dd className="font-medium tabular-nums">{(start.qx * 1000).toFixed(2)}‰</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Life expectancy</dt>
          <dd className="font-medium tabular-nums">{ex.toFixed(1)} yr</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rate doubles by</dt>
          <dd className="font-medium tabular-nums">{doubles ? `age ${doubles.age}` : "—"}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Log axis, because mortality rises exponentially and a linear plot shows nothing until eighty · life expectancy
        at {start.age} is {ex.toFixed(1)} years, computed by chaining the table rather than quoted beside it
        {doubles ? ` · the rate doubles between ${at40.age} and ${doubles.age}, which is roughly the eight-year doubling every Gompertz table shows` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * LapseCurve — policies surrendered by duration, with the shape that
 * matters — the early spike against the level tail — separated.
 * ------------------------------------------------------------------ */
export function LapseCurve({
  durations,
  commissionClawbackYears = 2,
  height = 200,
  className = "",
}: {
  durations: { year: number; inForceStart: number; lapses: number }[]
  /** years within which commission is clawed back */
  commissionClawbackYears?: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!durations.length) return null

  const rows = [...durations]
    .sort((a, b) => a.year - b.year)
    .map((d) => ({ ...d, rate: d.lapses / Math.max(d.inForceStart, 1) }))
  const ultimate = rows.slice(Math.max(0, rows.length - 3)).reduce((a, r) => a + r.rate, 0) / Math.min(3, rows.length)
  const early = rows.filter((r) => r.year <= commissionClawbackYears)
  const earlyExcess = early.reduce((a, r) => a + Math.max(0, r.rate - ultimate) * r.inForceStart, 0)
  const max = Math.max(...rows.map((r) => r.rate))
  let survived = 1
  const persistency = rows.map((r) => {
    survived *= 1 - r.rate
    return survived
  })

  return (
    <div className={className}>
      <div className="relative flex items-end gap-1" style={{ height }}>
        {rows.map((r) => (
          <div key={r.year} className="flex h-full flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t-[2px]"
              style={{
                height: `${(r.rate / max) * 100}%`,
                background: r.year <= commissionClawbackYears ? "currentColor" : "color-mix(in oklch, currentColor 42%, transparent)",
              }}
              title={`year ${r.year}: ${(r.rate * 100).toFixed(1)}% lapsed`}
            />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground" style={{ bottom: `${(ultimate / max) * 100}%` }} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          <polyline
            points={persistency.map((p, i) => `${((i + 0.5) / rows.length) * 100},${100 - p * 100}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.1}
            strokeDasharray="1 2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="mt-1 flex gap-1">
        {rows.map((r) => (
          <span key={r.year} className="flex-1 text-center text-[9px] tabular-nums text-muted-foreground">
            {r.year}
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Year 1 lapse</dt>
          <dd className="font-medium tabular-nums">{(rows[0].rate * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ultimate</dt>
          <dd className="font-medium tabular-nums">{(ultimate * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Still in force</dt>
          <dd className="font-medium tabular-nums">{(persistency[persistency.length - 1] * 100).toFixed(0)}%</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Solid bars fall inside the {commissionClawbackYears}-year clawback, dotted is the surviving cohort · the early
        rate is {(rows[0].rate / Math.max(ultimate, 1e-9)).toFixed(1)}× the ultimate {(ultimate * 100).toFixed(1)}%, and
        it is that excess — about {Math.round(earlyExcess).toLocaleString()} policies — that decides whether the
        acquisition cost is ever recovered
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ReserveRunoff — the reserve released each year, with the emergence
 * pattern derived from the claim development.
 * ------------------------------------------------------------------ */
export function ReserveRunoff({
  cohorts,
  height = 210,
  className = "",
}: {
  /** paid claims by development year for each accident year, plus the reserve set */
  cohorts: { year: string; ultimate: number; paid: number[] }[]
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!cohorts.length) return null

  const maxDev = Math.max(...cohorts.map((c) => c.paid.length))
  const rows = cohorts.map((c) => {
    let run = 0
    const cumulative = c.paid.map((p) => (run += p))
    const outstanding = cumulative.map((v) => c.ultimate - v)
    return { ...c, cumulative, outstanding, developed: (cumulative[cumulative.length - 1] ?? 0) / Math.max(c.ultimate, 1) }
  })
  const maxUltimate = Math.max(...cohorts.map((c) => c.ultimate))
  const totalOutstanding = rows.reduce((a, r) => a + (r.outstanding[r.outstanding.length - 1] ?? 0), 0)
  const youngest = rows[rows.length - 1]
  // the development year by which half of the ultimate is typically paid
  const meanPattern = Array.from({ length: maxDev }, (_, d) => {
    const vals = rows.filter((r) => r.cumulative[d] !== undefined).map((r) => (r.cumulative[d] as number) / Math.max(r.ultimate, 1))
    return vals.reduce((a, v) => a + v, 0) / Math.max(vals.length, 1)
  })
  const halfBy = meanPattern.findIndex((v) => v >= 0.5)

  return (
    <div className={className}>
      <ul className="space-y-2" style={{ minHeight: height }}>
        {rows.map((r) => (
          <li key={r.year}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span>{r.year}</span>
              <span className="tabular-nums text-muted-foreground">
                {money(r.ultimate)} ultimate · {(r.developed * 100).toFixed(0)}% paid
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted" style={{ width: `${(r.ultimate / maxUltimate) * 100}%` }}>
              {r.paid.map((p, d) => (
                <div
                  key={d}
                  className="absolute inset-y-0 border-r border-background"
                  style={{
                    left: `${(((r.cumulative[d] as number) - p) / r.ultimate) * 100}%`,
                    width: `${(p / r.ultimate) * 100}%`,
                    background: `color-mix(in oklch, currentColor ${Math.max(14, 66 - d * 11)}%, transparent)`,
                  }}
                  title={`${r.year} development year ${d + 1}: ${money(p)}`}
                />
              ))}
              <div
                className="absolute inset-y-0 border border-foreground/50"
                style={{
                  left: `${((r.cumulative[r.cumulative.length - 1] as number) / r.ultimate) * 100}%`,
                  right: 0,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                }}
                title={`outstanding ${money(r.outstanding[r.outstanding.length - 1] ?? 0)}`}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Each band is one development year, palest last; hatched is still outstanding ·{" "}
        {money(totalOutstanding)} of reserve remains, {((youngest.outstanding[youngest.outstanding.length - 1] ?? 0) / Math.max(totalOutstanding, 1) * 100).toFixed(0)}%
        of it on {youngest.year} alone · half the ultimate is typically paid by development year{" "}
        {halfBy >= 0 ? halfBy + 1 : maxDev}, which is the pattern the youngest year has to be projected on and the one
        thing about it nobody yet knows
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CohortSurvival — a Kaplan–Meier curve computed from events and
 * censoring, so the censored observations are visible rather than
 * silently dropped.
 * ------------------------------------------------------------------ */
export function CohortSurvival({
  groups,
  height = 210,
  className = "",
}: {
  groups: { name: string; observations: { time: number; event: boolean }[] }[]
  height?: number
  className?: string
}) {
  const rows = groups.map((g) => {
    const sorted = [...g.observations].sort((a, b) => a.time - b.time)
    let atRisk = sorted.length
    let s = 1
    const steps: { time: number; survival: number; censored: boolean }[] = [{ time: 0, survival: 1, censored: false }]
    const times = [...new Set(sorted.map((o) => o.time))].sort((a, b) => a - b)
    times.forEach((t) => {
      const here = sorted.filter((o) => o.time === t)
      const events = here.filter((o) => o.event).length
      if (events > 0) s *= 1 - events / Math.max(atRisk, 1)
      steps.push({ time: t, survival: s, censored: events === 0 })
      atRisk -= here.length
    })
    const medianStep = steps.find((st) => st.survival <= 0.5)
    return { ...g, steps, median: medianStep?.time ?? null, censoredCount: sorted.filter((o) => !o.event).length, n: sorted.length }
  })
  const maxT = Math.max(...groups.flatMap((g) => g.observations.map((o) => o.time)))
  const px = (t: number) => (t / Math.max(maxT, 1)) * 100
  const py = (s: number) => 100 - s * 96 - 2
  const dashes = ["", "4 2", "1 2"]

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(0.5)} x2={100} y2={py(0.5)} stroke="currentColor" strokeWidth={0.4} strokeDasharray="3 2" opacity={0.45} />
          {rows.map((r, ri) => {
            const pts: string[] = []
            r.steps.forEach((st, i) => {
              const prev = r.steps[i - 1]
              if (prev) pts.push(`${px(st.time)},${py(prev.survival)}`)
              pts.push(`${px(st.time)},${py(st.survival)}`)
            })
            return (
              <polyline key={r.name} points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth={1.3} strokeDasharray={dashes[ri % dashes.length]} vectorEffect="non-scaling-stroke" />
            )
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0">
          {rows.flatMap((r) =>
            r.steps
              .filter((st) => st.censored && st.time > 0)
              .map((st) => (
                <span
                  key={`${r.name}-${st.time}`}
                  className="absolute h-2 w-px -translate-x-1/2 -translate-y-1/2 bg-foreground"
                  style={{ left: `${px(st.time)}%`, top: `${py(st.survival)}%` }}
                  title="censored"
                />
              )),
          )}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0</span>
        <span>{maxT}</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {rows.map((r, ri) => (
          <li key={r.name} className="flex items-center gap-2">
            <svg width={18} height={6} className="shrink-0" aria-hidden>
              <line x1={0} y1={3} x2={18} y2={3} stroke="currentColor" strokeWidth={1.4} strokeDasharray={dashes[ri % dashes.length]} />
            </svg>
            <span className="w-20 shrink-0 truncate">{r.name}</span>
            <span className="text-muted-foreground">
              n {r.n}, {r.censoredCount} censored · median{" "}
              {r.median === null ? "not reached" : r.median}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Tick marks are CENSORED observations — people still alive when the study ended, who leave the risk set without
        counting as an event · dropping them would overstate the hazard, and a curve that never crosses half has a
        median nobody has observed yet rather than an infinite one
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AnnuityFactor — the price of a pound a year for life, with the split
 * between longevity and interest DERIVED by holding each fixed.
 * ------------------------------------------------------------------ */
export function AnnuityFactor({
  survivorship,
  discountRates,
  className = "",
}: {
  /** probability of surviving to each future year, starting at year 1 */
  survivorship: number[]
  discountRates: number[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!survivorship.length || !discountRates.length) return null

  const factor = (i: number) => survivorship.reduce((a, p, t) => a + p / Math.pow(1 + i, t + 1), 0)
  const rows = discountRates.map((i) => ({ rate: i, factor: factor(i) }))
  // what the factor would be if nobody died, to separate the two effects
  const certain = (i: number) => survivorship.reduce((a, _p, t) => a + 1 / Math.pow(1 + i, t + 1), 0)
  const mid = rows[Math.floor(rows.length / 2)]
  const longevityDiscount = 1 - mid.factor / certain(mid.rate)
  const max = Math.max(...rows.map((r) => r.factor))
  const expectancy = survivorship.reduce((a, p) => a + p, 0)

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.rate} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] tabular-nums">{(r.rate * 100).toFixed(1)}%</span>
            <div className="relative h-4 flex-1 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/22" style={{ width: `${(certain(r.rate) / Math.max(certain(rows[0].rate), 1e-9)) * 100}%` }} />
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground" style={{ width: `${(r.factor / Math.max(certain(rows[0].rate), 1e-9)) * 100}%` }} />
            </div>
            <span className="w-32 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {r.factor.toFixed(2)} · {money(100000 / Math.max(r.factor, 1e-9))}/yr per £100k
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Expectancy</dt>
          <dd className="font-medium tabular-nums">{expectancy.toFixed(1)} yr</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Factor at {(mid.rate * 100).toFixed(1)}%</dt>
          <dd className="font-medium tabular-nums">{mid.factor.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rate sensitivity</dt>
          <dd className="font-medium tabular-nums">
            {(((rows[0].factor - rows[rows.length - 1].factor) / Math.max(rows[0].factor, 1e-9)) * 100).toFixed(0)}%
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Pale is a certain annuity for the same number of years, solid is the life annuity — the difference is what
        mortality is worth, {(longevityDiscount * 100).toFixed(0)}% at {(mid.rate * 100).toFixed(1)}% ·{" "}
        {(((rows[0].factor - rows[rows.length - 1].factor) / Math.max(rows[0].factor, 1e-9)) * 100).toFixed(0)}% of the
        price moves with the discount rate across this range, which is why an annuity quote expires in a fortnight
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * MorbidityIncidence — claims per thousand lives by age and cause, with
 * the exposure-adjusted rate derived rather than a raw count shown.
 * ------------------------------------------------------------------ */
export function MorbidityIncidence({
  bands,
  causes,
  claims,
  className = "",
}: {
  /** each age band and the lives exposed in it */
  bands: { name: string; lives: number }[]
  causes: string[]
  /** claims[band][cause] */
  claims: number[][]
  className?: string
}) {
  const rates = bands.map((b, bi) => causes.map((_, ci) => ((claims[bi]?.[ci] ?? 0) / Math.max(b.lives, 1)) * 1000))
  const max = Math.max(...rates.flat())
  const byCause = causes.map((_, ci) => bands.reduce((a, b, bi) => a + (claims[bi]?.[ci] ?? 0), 0))
  const totalLives = bands.reduce((a, b) => a + b.lives, 0)
  const totalClaims = byCause.reduce((a, v) => a + v, 0)
  const rawLargest = bands.reduce((a, b, bi) => {
    const n = causes.reduce((s, _c, ci) => s + (claims[bi]?.[ci] ?? 0), 0)
    return n > a.n ? { name: b.name, n } : a
  }, { name: "", n: 0 })
  const rateLargest = bands.reduce(
    (a, b, bi) => {
      const r = causes.reduce((s, _c, ci) => s + rates[bi][ci], 0)
      return r > a.r ? { name: b.name, r } : a
    },
    { name: "", r: 0 },
  )

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="pr-1.5 pb-1 text-left font-normal text-muted-foreground">age \ cause</th>
              {causes.map((c) => (
                <th key={c} className="px-0.5 pb-1 font-medium">
                  <span className="block max-w-[4rem] truncate" title={c}>
                    {c}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bands.map((b, bi) => (
              <tr key={b.name}>
                <th className="pr-1.5 text-left font-medium whitespace-nowrap">
                  {b.name} <span className="font-normal text-muted-foreground">n {b.lives.toLocaleString()}</span>
                </th>
                {causes.map((c, ci) => (
                  <td key={c} className="p-px">
                    <div
                      className="flex h-6 items-center justify-center rounded-[2px]"
                      style={{ background: `color-mix(in oklch, currentColor ${((rates[bi][ci] / max) * 74).toFixed(0)}%, transparent)` }}
                      title={`${b.name} · ${c}: ${claims[bi]?.[ci] ?? 0} claims from ${b.lives.toLocaleString()} lives`}
                    >
                      <span style={{ color: rates[bi][ci] / max > 0.55 ? "var(--background)" : undefined }}>
                        {rates[bi][ci].toFixed(1)}
                      </span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Cells are claims per thousand lives EXPOSED, not claim counts — {rawLargest.name} files the most claims because
        it holds the most policies, while {rateLargest.name} has the highest rate ·{" "}
        {((totalClaims / Math.max(totalLives, 1)) * 1000).toFixed(2)} per thousand across{" "}
        {totalLives.toLocaleString()} lives
      </p>
    </div>
  )
}
