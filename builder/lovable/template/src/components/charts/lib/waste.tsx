/**
 * Waste and recycling primitives — composition, capture, contamination, gate
 * fees, collection density and diversion.
 *
 * The recyclable fraction still in the residual stream, the capture rate per
 * material, the value a contaminated load loses, the cost per tonne once the
 * rejection risk is priced, the cost per lift from round density, and the
 * diversion rate against the target are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
// Rounds to whole units above £1 and to pence below it. A flat whole-unit
// format printed a £0.10-per-minute figure as "£0" while the sentence beside
// it quoted the £4,034 that same rate produces across an audience.
const money = (v: number) =>
  "£" +
  (Math.abs(v) < 10
    ? Math.abs(v).toFixed(2)
    : Math.round(Math.abs(v)).toLocaleString("en-GB"))

/* ------------------------------------------------------------------ *
 * WasteComposition — what is in the residual bin, with the fraction
 * that had a collection derived. That number is the whole case for a
 * communications campaign rather than a new service.
 * ------------------------------------------------------------------ */
export function WasteComposition({
  materials,
  className = "",
}: {
  materials: { name: string; percent: number; collectedKerbside: boolean }[]
  className?: string
}) {
  const sorted = [...materials].sort((a, b) => b.percent - a.percent)
  const missed = sorted.filter((m) => m.collectedKerbside)
  const missedShare = missed.reduce((a, m) => a + m.percent, 0)
  const trueResidual = 100 - missedShare
  const max = Math.max(...sorted.map((m) => m.percent))

  return (
    <div className={className}>
      <div className="mb-2 flex h-7 w-full overflow-hidden rounded-[3px] border border-foreground/30">
        {sorted.map((m) => (
          <div
            key={m.name}
            className="border-r border-foreground/25 last:border-r-0"
            style={{
              width: `${m.percent}%`,
              background: m.collectedKerbside
                ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                : "color-mix(in oklch, currentColor 30%, transparent)",
            }}
            title={`${m.name}: ${m.percent}%${m.collectedKerbside ? " — already collected at the kerb" : ""}`}
          />
        ))}
      </div>
      <ul className="space-y-1 text-[10px] tabular-nums">
        {sorted.map((m) => (
          <li key={m.name} className="flex items-center gap-2">
            <span aria-hidden className="w-3" title={m.collectedKerbside ? "already collected at the kerb" : "genuinely residual"}>
              {m.collectedKerbside ? "↺" : "·"}
            </span>
            <span className="w-32 shrink-0 truncate">{m.name}</span>
            <div className="h-2 flex-1 rounded-[1px] bg-muted">
              <div className="h-full rounded-[1px] bg-foreground" style={{ width: `${(m.percent / max) * 100}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right text-muted-foreground">
              {m.percent.toFixed(1)}%{m.collectedKerbside ? " · collected" : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched materials already have a kerbside collection — {missedShare.toFixed(1)}% of the residual bin is
        recyclable through a service the household already has, so only {trueResidual.toFixed(1)}% is genuinely
        residual · a new service cannot recover the hatched part, and a campaign is the only thing that can
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CaptureRate — of everything arising, how much was set out for
 * recycling. Presented per material, because a headline rate is
 * dominated by whatever is heaviest.
 * ------------------------------------------------------------------ */
export function CaptureRate({
  materials,
  className = "",
}: {
  /** tonnes arising in total and tonnes actually captured */
  materials: { name: string; arisingT: number; capturedT: number; valuePerT?: number }[]
  className?: string
}) {
  const rows = materials
    .map((m) => ({
      ...m,
      capture: m.capturedT / Math.max(m.arisingT, 1e-9),
      missedT: m.arisingT - m.capturedT,
      missedValue: (m.arisingT - m.capturedT) * (m.valuePerT ?? 0),
    }))
    .sort((a, b) => b.missedValue - a.missedValue || b.missedT - a.missedT)
  const totalArising = rows.reduce((a, r) => a + r.arisingT, 0)
  const totalCaptured = rows.reduce((a, r) => a + r.capturedT, 0)
  const headline = totalCaptured / Math.max(totalArising, 1)
  const heaviest = rows.reduce((a, r) => (r.arisingT > a.arisingT ? r : a), rows[0])
  const worst = rows.reduce((a, r) => (r.capture < a.capture ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.capturedT.toLocaleString()} of {r.arisingT.toLocaleString()} t
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="h-full rounded-[2px] bg-foreground/55" style={{ width: `${r.capture * 100}%` }} />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: `${headline * 100}%` }} title="headline rate" />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.capture * 100).toFixed(0)}% captured · {r.missedT.toLocaleString()} t missed
              {r.valuePerT ? `, worth ${money(r.missedValue)}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The tick on every bar is the {(headline * 100).toFixed(0)}% headline rate, which {heaviest.name.toLowerCase()}{" "}
        alone sets because it is {((heaviest.arisingT / Math.max(totalArising, 1)) * 100).toFixed(0)}% of the tonnage ·{" "}
        {worst.name} captures only {(worst.capture * 100).toFixed(0)}% and moving it barely shifts the headline —
        which is exactly why a headline rate is the wrong target to manage against
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Contamination — the rate against the rejection threshold, with the
 * value at risk on each load derived.
 * ------------------------------------------------------------------ */
export function Contamination({
  rounds,
  rejectionThreshold,
  cleanValuePerT,
  disposalCostPerT,
  height = 200,
  className = "",
}: {
  rounds: { name: string; contaminationPercent: number; tonnes: number }[]
  /** the rate at which the reprocessor rejects the load */
  rejectionThreshold: number
  cleanValuePerT: number
  disposalCostPerT: number
  height?: number
  className?: string
}) {
  const rows = [...rounds]
    .sort((a, b) => b.contaminationPercent - a.contaminationPercent)
    .map((r) => {
      const rejected = r.contaminationPercent > rejectionThreshold
      const value = rejected ? -r.tonnes * disposalCostPerT : r.tonnes * cleanValuePerT * (1 - r.contaminationPercent / 100)
      return { ...r, rejected, value, swing: r.tonnes * cleanValuePerT + r.tonnes * disposalCostPerT }
    })
  const axis = Math.max(rejectionThreshold * 1.6, ...rows.map((r) => r.contaminationPercent))
  const rejected = rows.filter((r) => r.rejected)
  const atRisk = rows
    .filter((r) => !r.rejected && r.contaminationPercent > rejectionThreshold * 0.75)
    .reduce((a, r) => a + r.swing, 0)

  return (
    <div className={className}>
      <ul className="space-y-2" style={{ minHeight: height }}>
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">{r.tonnes} t</span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(r.contaminationPercent / axis) * 100}%`,
                  background: r.rejected ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 48%, transparent)",
                  outline: r.rejected ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${(rejectionThreshold / axis) * 100}%` }} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.contaminationPercent.toFixed(1)}% contamination ·{" "}
              {r.rejected ? `REJECTED, costs ${money(-r.value)} to dispose of` : `worth ${money(r.value)}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The threshold is a CLIFF, not a slope — one point over {rejectionThreshold}% turns a load worth{" "}
        {money(cleanValuePerT)} a tonne into one costing {money(disposalCostPerT)} a tonne to bury ·{" "}
        {rejected.length
          ? `${rejected.map((r) => r.name).join(", ")} rejected, ${money(rejected.reduce((a, r) => a + r.swing, 0))} of swing`
          : "no round is over the threshold"}
        {atRisk > 0 ? ` · ${money(atRisk)} more sits within a quarter of it` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * GateFee — the cost per tonne at each destination, with the true cost
 * of a recycling route including its rejection risk.
 * ------------------------------------------------------------------ */
export function GateFee({
  destinations,
  tonnesPerYear,
  className = "",
}: {
  destinations: {
    name: string
    /** negative means the material is bought from you */
    gateFeePerT: number
    haulagePerT: number
    /** probability the load is rejected and has to go to landfill */
    rejectionRate?: number
    landfillCostPerT?: number
  }[]
  tonnesPerYear: number
  className?: string
}) {
  const rows = destinations
    .map((d) => {
      const rej = d.rejectionRate ?? 0
      const fallback = d.landfillCostPerT ?? 0
      const expected = (1 - rej) * (d.gateFeePerT + d.haulagePerT) + rej * (fallback + d.haulagePerT)
      return { ...d, headline: d.gateFeePerT + d.haulagePerT, expected, annual: expected * tonnesPerYear }
    })
    .sort((a, b) => a.expected - b.expected)
  const byHeadline = [...rows].sort((a, b) => a.headline - b.headline)
  const flipped = byHeadline[0]?.name !== rows[0]?.name
  const lo = Math.min(0, ...rows.map((r) => Math.min(r.headline, r.expected)))
  const hi = Math.max(...rows.map((r) => Math.max(r.headline, r.expected)))
  const px = (v: number) => ((v - lo) / Math.max(hi - lo, 1e-9)) * 100

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {money(r.gateFeePerT)} gate + {money(r.haulagePerT)} haulage
                {r.rejectionRate ? ` · ${(r.rejectionRate * 100).toFixed(0)}% rejected` : ""}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <span className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${px(0)}%` }} />
              <div
                className="absolute inset-y-0 rounded-[2px] bg-foreground/25"
                style={{ left: `${px(Math.min(0, r.headline))}%`, width: `${Math.abs(px(r.headline) - px(0))}%` }}
                title={`headline ${money(r.headline)}`}
              />
              <span className="absolute inset-y-0 w-1 bg-foreground" style={{ left: `${px(r.expected)}%` }} title={`expected ${money(r.expected)}`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.headline)} headline → {money(r.expected)} expected · {money(r.annual)} a year
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is the quoted cost, the tick is the expected cost once the rejection rate is priced ·{" "}
        {flipped
          ? `${byHeadline[0]?.name} looks cheapest on the quote and ${rows[0]?.name} is cheapest once rejections are counted — a difference of ${money(Math.abs(rows[0].annual - byHeadline[0].annual))} a year`
          : `${rows[0]?.name} is cheapest either way`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RouteDensity — cost per lift against properties per kilometre, which
 * is what actually decides whether a round pays.
 * ------------------------------------------------------------------ */
export function RouteDensity({
  rounds,
  vehicleCostPerHour,
  height = 200,
  className = "",
}: {
  rounds: { name: string; properties: number; routeKm: number; hours: number }[]
  vehicleCostPerHour: number
  className?: string
  height?: number
}) {
  const rows = rounds
    .map((r) => ({
      ...r,
      density: r.properties / Math.max(r.routeKm, 1e-9),
      costPerLift: (r.hours * vehicleCostPerHour) / Math.max(r.properties, 1),
      liftsPerHour: r.properties / Math.max(r.hours, 1e-9),
    }))
    .sort((a, b) => a.density - b.density)
  const maxDensity = Math.max(...rows.map((r) => r.density))
  const maxCost = Math.max(...rows.map((r) => r.costPerLift))
  const mean = rows.reduce((a, r) => a + r.hours * vehicleCostPerHour, 0) / rows.reduce((a, r) => a + r.properties, 0)
  const worst = rows[0]

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        {rows.map((r) => (
          <span
            key={r.name}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
            style={{ left: `${(r.density / (maxDensity * 1.08)) * 100}%`, top: `${100 - (r.costPerLift / (maxCost * 1.08)) * 100}%` }}
            title={`${r.name}: ${r.density.toFixed(0)} properties/km, ${money(r.costPerLift)}/lift`}
          />
        ))}
        <span className="absolute inset-x-0 border-t border-dashed border-foreground/60" style={{ top: `${100 - (mean / (maxCost * 1.08)) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 properties/km</span>
        <span>{maxDensity.toFixed(0)} · cost per lift ↑</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate">{r.name}</span>
            <span className="text-muted-foreground">
              {r.properties.toLocaleString()} properties over {r.routeKm} km · {r.density.toFixed(0)}/km ·{" "}
              {r.liftsPerHour.toFixed(0)} lifts/h · {money(r.costPerLift)} each
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Cost per lift falls with density and nothing else on this chart moves it · {worst.name} costs{" "}
        {money(worst.costPerLift)} a lift against a {money(mean)} average, and no amount of route optimisation changes
        that a rural round drives between bins
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * LandfillDiversion — the diversion rate against the target, with the
 * tonnage that has to move to close the gap derived.
 * ------------------------------------------------------------------ */
export function LandfillDiversion({
  years,
  target,
  height = 200,
  className = "",
}: {
  years: { label: string; recycled: number; composted: number; energyRecovery: number; landfill: number }[]
  /** the diversion target as a fraction */
  target: number
  height?: number
  className?: string
}) {
  const rows = years.map((y) => {
    const total = y.recycled + y.composted + y.energyRecovery + y.landfill
    const diverted = total - y.landfill
    const recycling = (y.recycled + y.composted) / Math.max(total, 1)
    return { ...y, total, diversion: diverted / Math.max(total, 1), recycling }
  })
  const latest = rows[rows.length - 1]
  const gap = target - latest.diversion
  const tonnesToMove = Math.max(0, gap * latest.total)
  const max = Math.max(...rows.map((r) => r.total))
  // the rate panel's scale is DERIVED from the rates and the target, never a
  // fixed window — a service at 30% diversion would draw off a hard-coded one
  const rateVals = [...rows.map((r) => r.diversion), target]
  const rLo = Math.min(...rateVals)
  const rHi = Math.max(...rateVals)
  const pad = Math.max((rHi - rLo) * 0.35, 0.03)
  const ry = (v: number) => 100 - ((v - (rLo - pad)) / (rHi - rLo + pad * 2)) * 100
  const bands: [keyof (typeof years)[number], string, string][] = [
    ["recycled", "Recycled", "currentColor"],
    ["composted", "Composted", "color-mix(in oklch, currentColor 55%, transparent)"],
    ["energyRecovery", "Energy recovery", "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)"],
    ["landfill", "Landfill", "color-mix(in oklch, currentColor 14%, transparent)"],
  ]

  return (
    <div className={className}>
      <div className="relative flex items-end gap-1.5" style={{ height }}>
        {rows.map((r) => (
          <div key={r.label} className="flex flex-1 flex-col justify-end" style={{ height: `${(r.total / max) * 100}%` }}>
            {bands.map(([k, label, bg]) => (
              <div
                key={String(k)}
                className="w-full border-t border-foreground/25 first:border-t-0"
                style={{ flex: `${r[k] as number} 0 0`, background: bg }}
                title={`${r.label} ${label}: ${(r[k] as number).toLocaleString()} t`}
              />
            ))}
          </div>
        ))}
      </div>
      {/* The rate gets its OWN panel. Drawn over the tonnage stack it shares a
          y-axis with tonnes and reads as another band inside the bars. */}
      <div className="relative mt-1 h-16 rounded-[2px] border border-foreground/15">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={ry(target)} x2={100} y2={ry(target)} stroke="currentColor" strokeWidth={0.9} strokeDasharray="4 2" opacity={0.7} />
          <polyline
            points={rows.map((r, i) => `${((i + 0.5) / rows.length) * 100},${ry(r.diversion)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* labels sit ON the lines they name, not in a corner the trace runs through */}
        <span className="absolute right-1 -translate-y-1/2 bg-background px-0.5 text-[9px] tabular-nums text-muted-foreground" style={{ top: `${ry(target)}%` }}>
          target {(target * 100).toFixed(0)}%
        </span>
        <span className="absolute left-1 -translate-y-1/2 bg-background px-0.5 text-[9px] font-medium tabular-nums" style={{ top: `${ry(rows[rows.length - 1].diversion)}%` }}>
          diversion {(rows[rows.length - 1].diversion * 100).toFixed(0)}%
        </span>
      </div>
      <div className="mt-1 flex gap-1.5">
        {rows.map((r) => (
          <span key={r.label} className="flex-1 truncate text-center text-[9px] text-muted-foreground">
            {r.label}
          </span>
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
        {bands.map(([k, label, bg]) => (
          <li key={String(k)} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[2px] border border-foreground/35" style={{ background: bg }} aria-hidden />
            {label}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10px] text-muted-foreground tabular-nums">
        The solid line is diversion from landfill as a share of the stack, against a {(target * 100).toFixed(0)}% target ·{" "}
        {gap <= 0
          ? `the target is met with ${(-gap * 100).toFixed(1)} points to spare`
          : `${(gap * 100).toFixed(1)} points short, which is ${Math.round(tonnesToMove).toLocaleString()} tonnes that must move out of landfill`}{" "}
        · recycling and composting alone are {(latest.recycling * 100).toFixed(0)}%, and burning the rest counts as
        diversion but not as recycling, which is the distinction a single headline hides
      </p>
    </div>
  )
}
