/**
 * Pharmacokinetic and clinical primitives — plasma concentration, the
 * therapeutic window, dose titration, interaction severity, bioequivalence
 * and adherence.
 *
 * Cmax, Tmax, AUC by trapezoid, half-life from the terminal slope, accumulation
 * at steady state, time in window and the 90% confidence interval on the
 * geometric mean ratio are all DERIVED. A caller cannot claim bioequivalence the
 * numbers refuse.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * PlasmaConcentration — one dosing interval or several, with Cmax,
 * Tmax, AUC and the terminal half-life computed off the curve.
 * ------------------------------------------------------------------ */
export function PlasmaConcentration({
  points,
  unit = "ng/mL",
  height = 190,
  className = "",
}: {
  points: { hours: number; concentration: number }[]
  unit?: string
  height?: number
  className?: string
}) {
  // NOTHING TO DRAW IS NOT A CHART OF NOTHING. An empty array made every
  // scale here degenerate and wrote NaN into an SVG attribute, which the
  // browser drops — so the chart rendered as a blank box rather than as the
  // empty state the page around it is showing. `useRows` hands back `[]`
  // before the query settles and on every site whose owner has added nothing.
  if (!points.length) return null

  const sorted = [...points].sort((a, b) => a.hours - b.hours)
  const cmax = Math.max(...sorted.map((p) => p.concentration))
  const tmax = sorted.find((p) => p.concentration === cmax)?.hours ?? 0
  const auc = sorted.reduce(
    (a, p, i) => (i === 0 ? 0 : a + ((p.concentration + sorted[i - 1].concentration) / 2) * (p.hours - sorted[i - 1].hours)),
    0,
  )
  // terminal half-life: log-linear regression over the tail after Tmax
  const tail = sorted.filter((p) => p.hours > tmax && p.concentration > 0)
  const n = tail.length
  const mx = tail.reduce((a, p) => a + p.hours, 0) / Math.max(1, n)
  const my = tail.reduce((a, p) => a + Math.log(p.concentration), 0) / Math.max(1, n)
  const num = tail.reduce((a, p) => a + (p.hours - mx) * (Math.log(p.concentration) - my), 0)
  const den = tail.reduce((a, p) => a + (p.hours - mx) ** 2, 0)
  const ke = den === 0 ? 0 : -num / den
  const halfLife = ke > 0 ? Math.LN2 / ke : 0

  const maxH = Math.max(1, ...sorted.map((p) => p.hours))
  const px = (h: number) => (h / maxH) * 100
  const py = (c: number) => 100 - (c / (cmax * 1.1)) * 100

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon
            points={`0,100 ${sorted.map((p) => `${px(p.hours)},${py(p.concentration)}`).join(" ")} 100,100`}
            fill="currentColor"
            opacity={0.13}
          />
          <polyline
            points={sorted.map((p) => `${px(p.hours)},${py(p.concentration)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.3}
            vectorEffect="non-scaling-stroke"
          />
          <line x1={px(tmax)} y1={py(cmax)} x2={px(tmax)} y2={100} stroke="currentColor" strokeWidth={0.4} strokeDasharray="2 2" opacity={0.55} />
        </svg>
        <span
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground bg-background"
          style={{ left: `${px(tmax)}%`, top: `${py(cmax)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 h</span>
        <span>{maxH} h</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">C<sub>max</sub></dt>
          <dd className="font-medium tabular-nums">{cmax.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">T<sub>max</sub></dt>
          <dd className="font-medium tabular-nums">{tmax} h</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">AUC</dt>
          <dd className="font-medium tabular-nums">{auc.toFixed(0)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">t½</dt>
          <dd className="font-medium tabular-nums">{halfLife.toFixed(1)} h</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Concentration in {unit} · AUC is the shaded area by trapezoid, and t½ is the terminal slope — steady state
        arrives after about {(halfLife * 5).toFixed(0)} h of repeat dosing
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * TherapeuticWindow — repeat dosing against the floor and ceiling, with
 * time-in-window measured rather than eyeballed.
 * ------------------------------------------------------------------ */
export function TherapeuticWindow({
  trace,
  minimumEffective,
  toxicThreshold,
  hoursPerSample = 1,
  height = 190,
  className = "",
}: {
  trace: number[]
  minimumEffective: number
  toxicThreshold: number
  hoursPerSample?: number
  height?: number
  className?: string
}) {
  const inWindow = trace.filter((c) => c >= minimumEffective && c <= toxicThreshold).length
  const subTherapeutic = trace.filter((c) => c < minimumEffective).length
  const toxic = trace.filter((c) => c > toxicThreshold).length
  const top = Math.max(toxicThreshold * 1.2, ...trace) * 1.04
  const px = (i: number) => (i / Math.max(1, trace.length - 1)) * 100
  const py = (c: number) => 100 - (c / top) * 100
  const pct = (n: number) => ((n / Math.max(1, trace.length)) * 100).toFixed(0)

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <rect
            x={0}
            y={py(toxicThreshold)}
            width={100}
            height={Math.max(0, py(minimumEffective) - py(toxicThreshold))}
            fill="currentColor"
            opacity={0.09}
          />
          <rect x={0} y={0} width={100} height={py(toxicThreshold)} fill="url(#tw-hatch)" opacity={0.5} />
          <defs>
            <pattern id="tw-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="0.7" opacity="0.35" />
            </pattern>
          </defs>
          <line x1={0} y1={py(toxicThreshold)} x2={100} y2={py(toxicThreshold)} stroke="currentColor" strokeWidth={0.6} opacity={0.75} />
          <line
            x1={0}
            y1={py(minimumEffective)}
            x2={100}
            y2={py(minimumEffective)}
            stroke="currentColor"
            strokeWidth={0.6}
            strokeDasharray="3 2"
            opacity={0.75}
          />
          <polyline
            points={trace.map((c, i) => `${px(i)},${py(c)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.3}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="absolute right-1 text-[9px] text-muted-foreground" style={{ top: `${py(toxicThreshold)}%` }}>
          toxic {toxicThreshold}
        </span>
        <span className="absolute right-1 text-[9px] text-muted-foreground" style={{ top: `${py(minimumEffective)}%` }}>
          effective {minimumEffective}
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 h</span>
        <span>{Math.round(trace.length * hoursPerSample)} h</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">In window</dt>
          <dd className="font-medium tabular-nums">{pct(inWindow)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Sub-therapeutic</dt>
          <dd className="font-medium tabular-nums">{pct(subTherapeutic)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Above threshold</dt>
          <dd className="font-medium tabular-nums">{pct(toxic)}%</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Shaded band is the window, hatched is over the threshold ·{" "}
        {toxic > 0
          ? `${Math.round(toxic * hoursPerSample)} h above it, which is the argument for splitting the dose`
          : "the peaks stay under the ceiling on this schedule"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DoseTitration — dose against response and against adverse events, so
 * the therapeutic index falls out of the two curves.
 * ------------------------------------------------------------------ */
export function DoseTitration({
  steps,
  height = 190,
  className = "",
}: {
  steps: { dose: number; responders: number; adverse: number; n: number }[]
  height?: number
  className?: string
}) {
  // NOTHING TO DRAW IS NOT A CHART OF NOTHING. An empty array made every
  // scale here degenerate and wrote NaN into an SVG attribute, which the
  // browser drops — so the chart rendered as a blank box rather than as the
  // empty state the page around it is showing. `useRows` hands back `[]`
  // before the query settles and on every site whose owner has added nothing.
  if (!steps.length) return null

  const rows = [...steps]
    .sort((a, b) => a.dose - b.dose)
    .map((s) => ({ ...s, response: s.responders / Math.max(1, s.n), harm: s.adverse / Math.max(1, s.n) }))
  // ED50 / TD50 by linear interpolation across the 50% crossing
  const cross = (get: (r: (typeof rows)[number]) => number) => {
    for (let i = 1; i < rows.length; i++) {
      const a = get(rows[i - 1])
      const b = get(rows[i])
      if (a < 0.5 && b >= 0.5) return rows[i - 1].dose + ((rows[i].dose - rows[i - 1].dose) * (0.5 - a)) / (b - a)
    }
    return null
  }
  const ed50 = cross((r) => r.response)
  const td50 = cross((r) => r.harm)
  const index = ed50 && td50 ? td50 / ed50 : null

  const maxDose = Math.max(...rows.map((r) => r.dose))
  const px = (d: number) => (d / maxDose) * 100
  const py = (p: number) => 100 - p * 94 - 3

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(0.5)} x2={100} y2={py(0.5)} stroke="currentColor" strokeWidth={0.4} strokeDasharray="2 2" opacity={0.45} />
          <polyline
            points={rows.map((r) => `${px(r.dose)},${py(r.response)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.3}
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={rows.map((r) => `${px(r.dose)},${py(r.harm)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            strokeDasharray="4 2"
            vectorEffect="non-scaling-stroke"
          />
          {ed50 !== null && <line x1={px(ed50)} y1={py(0.5)} x2={px(ed50)} y2={100} stroke="currentColor" strokeWidth={0.4} opacity={0.4} />}
          {td50 !== null && <line x1={px(td50)} y1={py(0.5)} x2={px(td50)} y2={100} stroke="currentColor" strokeWidth={0.4} opacity={0.4} />}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{rows[0]?.dose} mg</span>
        <span>{maxDose} mg</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
        <span className="flex items-center gap-1.5">
          <svg width={18} height={6} aria-hidden>
            <line x1={0} y1={3} x2={18} y2={3} stroke="currentColor" strokeWidth={1.4} />
          </svg>
          responded
        </span>
        <span className="flex items-center gap-1.5">
          <svg width={18} height={6} aria-hidden>
            <line x1={0} y1={3} x2={18} y2={3} stroke="currentColor" strokeWidth={1.4} strokeDasharray="4 2" />
          </svg>
          adverse event
        </span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {ed50 !== null ? `ED50 ${ed50.toFixed(0)} mg` : "response never reaches half"}
        {td50 !== null ? ` · TD50 ${td50.toFixed(0)} mg` : " · harm never reaches half in this range"}
        {index !== null
          ? ` · therapeutic index ${index.toFixed(1)}${index < 3 ? " — narrow, so this needs monitoring" : ""}`
          : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DrugInteraction — a pairwise grid. Severity is carried by a glyph as
 * well as fill, because "moderate" and "major" must not be told apart by
 * shade alone on a clinical screen.
 * ------------------------------------------------------------------ */
export type InteractionLevel = "none" | "minor" | "moderate" | "major" | "contraindicated"

const LEVEL_GLYPH: Record<InteractionLevel, string> = {
  none: "·",
  minor: "○",
  moderate: "◐",
  major: "●",
  contraindicated: "✕",
}
const LEVEL_FILL: Record<InteractionLevel, number> = { none: 0, minor: 10, moderate: 26, major: 50, contraindicated: 78 }

export function DrugInteraction({
  drugs,
  interactions,
  className = "",
}: {
  drugs: string[]
  interactions: { a: string; b: string; level: InteractionLevel; note?: string }[]
  className?: string
}) {
  const key = (a: string, b: string) => [a, b].sort().join("\u0000")
  const map = new Map(interactions.map((i) => [key(i.a, i.b), i]))
  const flagged = interactions.filter((i) => i.level === "major" || i.level === "contraindicated")

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px]">
          <thead>
            <tr>
              <th className="pr-1 text-left font-normal text-muted-foreground" />
              {drugs.slice(1).map((d) => (
                <th key={d} className="px-0.5 pb-1 text-center font-medium">
                  <span className="block max-w-[3.5rem] truncate">{d}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drugs.slice(0, -1).map((row, ri) => (
              <tr key={row}>
                <th className="pr-1.5 text-left font-medium whitespace-nowrap">{row}</th>
                {drugs.slice(1).map((col, ci) => {
                  if (ci < ri) return <td key={col} />
                  const hit = map.get(key(row, col))
                  const level = hit?.level ?? "none"
                  return (
                    <td key={col} className="p-px">
                      <div
                        className="flex h-6 items-center justify-center rounded-[2px]"
                        style={{ background: `color-mix(in oklch, currentColor ${LEVEL_FILL[level]}%, transparent)` }}
                        title={hit?.note ?? `${row} × ${col}: ${level}`}
                      >
                        <span aria-hidden style={{ color: LEVEL_FILL[level] > 45 ? "var(--background)" : undefined }}>
                          {LEVEL_GLYPH[level]}
                        </span>
                        <span className="sr-only">
                          {row} with {col}: {level}
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
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {(Object.keys(LEVEL_GLYPH) as InteractionLevel[]).map((l) => (
          <li key={l} className="flex items-center gap-1">
            <span aria-hidden>{LEVEL_GLYPH[l]}</span>
            {l}
          </li>
        ))}
      </ul>
      {flagged.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-[10px]">
          {flagged.map((f) => (
            <li key={key(f.a, f.b)}>
              <span className="font-medium">
                {f.a} + {f.b}
              </span>{" "}
              <span className="text-muted-foreground">{f.note ?? f.level}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">
        Severity carries a glyph as well as a fill — on a monochrome screen, and for anyone who cannot distinguish the
        shades, the symbol is the whole message
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Bioequivalence — the 90% confidence interval on the geometric mean
 * ratio against the 80–125% acceptance range. The verdict is computed.
 * ------------------------------------------------------------------ */
export function Bioequivalence({
  parameters,
  lower = 80,
  upper = 125,
  className = "",
}: {
  /** point estimate and CI bounds as PERCENTAGES of the reference */
  parameters: { name: string; ratio: number; ciLow: number; ciHigh: number }[]
  lower?: number
  upper?: number
  className?: string
}) {
  const rows = parameters.map((p) => ({ ...p, passes: p.ciLow >= lower && p.ciHigh <= upper }))
  const axLo = Math.min(lower - 10, ...rows.map((r) => r.ciLow)) - 4
  const axHi = Math.max(upper + 10, ...rows.map((r) => r.ciHigh)) + 4
  const px = (v: number) => ((v - axLo) / (axHi - axLo)) * 100
  const failed = rows.filter((r) => !r.passes)

  return (
    <div className={className}>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="font-medium">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.ratio.toFixed(1)}% ({r.ciLow.toFixed(1)}–{r.ciHigh.toFixed(1)})
              </span>
            </div>
            <div className="relative mt-1 h-5">
              <div
                className="absolute inset-y-0 rounded-[2px] bg-foreground/10"
                style={{ left: `${px(lower)}%`, width: `${px(upper) - px(lower)}%` }}
              />
              <div className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${px(100)}%` }} />
              <div
                className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-foreground"
                style={{ left: `${px(r.ciLow)}%`, width: `${Math.max(0.5, px(r.ciHigh) - px(r.ciLow))}%` }}
              />
              {[r.ciLow, r.ciHigh].map((b, i) => (
                <span key={i} className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-foreground" style={{ left: `${px(b)}%` }} />
              ))}
              <span
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45"
                style={{ left: `${px(r.ratio)}%`, background: r.passes ? "currentColor" : "var(--background)", boxShadow: r.passes ? undefined : "inset 0 0 0 1.5px currentColor" }}
              />
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span aria-hidden>{r.passes ? "✓" : "✗"}</span>
              <span>{r.passes ? "within the acceptance range" : "confidence interval leaves the range"}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Shaded band is {lower}–{upper}% of reference and the tick at 100% is equality ·{" "}
        {failed.length === 0
          ? "bioequivalence demonstrated on every parameter"
          : `NOT bioequivalent — ${failed.map((f) => f.name).join(", ")} ${failed.length === 1 ? "fails" : "fail"}, and the whole set must pass`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AdherenceCalendar — doses taken and missed, with the longest gap and
 * the pattern of misses derived, since when matters more than how many.
 * ------------------------------------------------------------------ */
export function AdherenceCalendar({
  days,
  dosesPerDay = 1,
  weekStart = 0,
  className = "",
}: {
  /** doses actually taken on each day, oldest first */
  days: number[]
  dosesPerDay?: number
  /** index into the week the first day falls on, 0 = Monday */
  weekStart?: number
  className?: string
}) {
  const expected = days.length * dosesPerDay
  const taken = days.reduce((a, d) => a + clamp(d, 0, dosesPerDay), 0)
  const adherence = (taken / Math.max(1, expected)) * 100

  let gap = 0
  let longest = 0
  let gapEnd = -1
  days.forEach((d, i) => {
    if (d === 0) {
      gap += 1
      if (gap > longest) {
        longest = gap
        gapEnd = i
      }
    } else gap = 0
  })

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const byWeekday = dayNames.map((_, wi) => {
    const idx = days.map((_, i) => i).filter((i) => (i + weekStart) % 7 === wi)
    const missed = idx.filter((i) => days[i] < dosesPerDay).length
    return { name: dayNames[wi], missed, of: idx.length }
  })
  const worstDay = byWeekday.reduce((a, b) => (b.of > 0 && b.missed / b.of > (a.of > 0 ? a.missed / a.of : 0) ? b : a), byWeekday[0])

  return (
    <div className={className}>
      <div className="flex gap-[3px] text-[8px] text-muted-foreground">
        {dayNames.map((d) => (
          <span key={d} className="w-4 text-center">
            {d[0]}
          </span>
        ))}
      </div>
      <div className="mt-1 grid gap-[3px]" style={{ gridTemplateColumns: "repeat(7, 1rem)" }}>
        {Array.from({ length: weekStart }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {days.map((d, i) => {
          const ratio = clamp(d / Math.max(1, dosesPerDay), 0, 1)
          return (
            <span
              key={i}
              className="flex h-4 items-center justify-center rounded-[2px] border border-foreground/25 text-[7px]"
              style={{
                background: ratio === 0 ? "transparent" : `color-mix(in oklch, currentColor ${(18 + ratio * 62).toFixed(0)}%, transparent)`,
              }}
              title={`day ${i + 1}: ${d} of ${dosesPerDay}`}
            >
              {ratio === 0 ? <span aria-hidden>✗</span> : ratio < 1 ? <span aria-hidden style={{ color: "var(--background)" }}>·</span> : null}
            </span>
          )
        })}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Adherence</dt>
          <dd className="font-medium tabular-nums">{adherence.toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Longest gap</dt>
          <dd className="font-medium tabular-nums">
            {longest} day{longest === 1 ? "" : "s"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Doses missed</dt>
          <dd className="font-medium tabular-nums">{expected - taken}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {longest >= 2
          ? `A ${longest}-day run of missed doses ending on day ${gapEnd + 1} matters more than the headline percentage — that is when the drug washes out.`
          : "No two consecutive days were missed, so the drug never fully washed out."}
        {worstDay.of > 0 && worstDay.missed > 0 ? ` ${worstDay.name} is the weekday most often missed.` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RenalDosing — the dose adjustment implied by a patient's clearance.
 * The band is looked up from the thresholds and the adjusted dose is
 * COMPUTED, because a chart that takes the answer as a prop cannot catch
 * the arithmetic error it exists to catch.
 * ------------------------------------------------------------------ */
export function RenalDosing({
  standardDoseMg,
  bands,
  patients,
  className = "",
}: {
  standardDoseMg: number
  /** ordered worst-first or best-first; `fromCrCl` is the lower bound */
  bands: { fromCrCl: number; fraction: number; note?: string }[]
  patients: { name: string; crCl: number }[]
  className?: string
}) {
  const sorted = [...bands].sort((a, b) => b.fromCrCl - a.fromCrCl)
  const bandFor = (crCl: number) => sorted.find((b) => crCl >= b.fromCrCl) ?? sorted[sorted.length - 1]
  const rows = patients.map((p) => {
    const band = bandFor(p.crCl)
    return { ...p, band, dose: standardDoseMg * band.fraction }
  })
  const axis = Math.max(120, ...patients.map((p) => p.crCl)) * 1.05
  const px = (v: number) => (v / axis) * 100
  const reduced = rows.filter((r) => r.band.fraction < 1)

  return (
    <div className={className}>
      {/* inset by the same label and value columns as the rows below, or the
          band scale and the marker scale silently disagree */}
      <div className="mb-1 flex items-center gap-2">
        <span className="w-24 shrink-0" />
        <div className="relative h-6 flex-1 overflow-hidden rounded-[2px] border border-foreground/25">
        {sorted.map((b, i) => {
          const upper = i === 0 ? axis : sorted[i - 1].fromCrCl
          return (
            <div
              key={b.fromCrCl}
              className="absolute inset-y-0 flex items-center justify-center border-r border-foreground/25 text-[9px]"
              style={{
                left: `${px(b.fromCrCl)}%`,
                width: `${px(upper) - px(b.fromCrCl)}%`,
                background: `color-mix(in oklch, currentColor ${(6 + (1 - b.fraction) * 46).toFixed(0)}%, transparent)`,
              }}
              title={b.note ?? `${(b.fraction * 100).toFixed(0)}% of the standard dose`}
            >
              {px(upper) - px(b.fromCrCl) > 12 ? `${(b.fraction * 100).toFixed(0)}%` : ""}
            </div>
          )
        })}
        </div>
        <span className="w-32 shrink-0" />
      </div>
      <div className="flex items-center gap-2 text-[9px] tabular-nums text-muted-foreground">
        <span className="w-24 shrink-0" />
        <span className="flex-1">0 mL/min</span>
        <span className="w-32 shrink-0 text-right">{axis.toFixed(0)} mL/min</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-[11px]">{r.name}</span>
            <div className="relative h-4 flex-1 rounded-[2px] bg-muted">
              {sorted.map((b, i) => {
                const upper = i === 0 ? axis : sorted[i - 1].fromCrCl
                return (
                  <div
                    key={b.fromCrCl}
                    className="absolute inset-y-0"
                    style={{
                      left: `${px(b.fromCrCl)}%`,
                      width: `${px(upper) - px(b.fromCrCl)}%`,
                      background: `color-mix(in oklch, currentColor ${(4 + (1 - b.fraction) * 24).toFixed(0)}%, transparent)`,
                    }}
                  />
                )
              })}
              <span
                className="absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-[1px] bg-foreground"
                style={{ left: `${px(r.crCl)}%` }}
              />
            </div>
            <span className="w-32 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              CrCl {r.crCl} → {r.dose.toFixed(0)} mg
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Standard dose {standardDoseMg} mg · darker bands are deeper reductions ·{" "}
        {reduced.length
          ? `${reduced.length} of ${patients.length} need a reduction, the deepest ${reduced.reduce((a, r) => (r.band.fraction < a.band.fraction ? r : a), reduced[0]).name} at ${(reduced.reduce((a, r) => (r.band.fraction < a.band.fraction ? r : a), reduced[0]).band.fraction * 100).toFixed(0)}%`
          : "every patient clears well enough for the standard dose"}
      </p>
    </div>
  )
}
