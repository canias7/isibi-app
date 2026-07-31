/**
 * Fisheries primitives — stock status, effort-corrected catch rates,
 * length structure, gear selectivity, bycatch and quota uptake.
 *
 * The stock status against the reference points, the catch per unit of
 * effort, the share of a catch below the legal size, the selection curve,
 * the bycatch ratio and the uptake pace are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * StockBiomass — spawning stock against the reference points. Tonnage
 * on its own says nothing; B_lim and B_pa are what turn it into a
 * status, so the status is derived and the tonnage is only the input.
 * ------------------------------------------------------------------ */
export function StockBiomass({
  years,
  bLim,
  bPa,
  height = 200,
  className = "",
}: {
  years: { year: number; ssbT: number; catchT?: number }[]
  /** the biomass below which recruitment is impaired */
  bLim: number
  /** the precautionary reference point */
  bPa: number
  height?: number
  className?: string
}) {
  const rows = [...years].sort((a, b) => a.year - b.year).map((y) => ({
    ...y,
    status: y.ssbT < bLim ? "below B_lim" : y.ssbT < bPa ? "below B_pa" : "above B_pa",
  }))
  const latest = rows[rows.length - 1]
  const belowLim = rows.filter((r) => r.ssbT < bLim).length
  const max = Math.max(bPa * 1.25, ...rows.map((r) => r.ssbT))
  const px = (i: number) => (rows.length < 2 ? 50 : (i / (rows.length - 1)) * 100)
  const py = (v: number) => 100 - (v / max) * 100
  const recovered = rows.findIndex((r, i) => i > 0 && rows[i - 1].ssbT < bPa && r.ssbT >= bPa)

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <rect x={0} y={py(bLim)} width={100} height={100 - py(bLim)} fill="currentColor" opacity={0.16} />
          <rect x={0} y={py(bPa)} width={100} height={py(bLim) - py(bPa)} fill="currentColor" opacity={0.07} />
          <polygon points={`0,100 ${rows.map((r, i) => `${px(i)},${py(r.ssbT)}`).join(" ")} 100,100`} fill="currentColor" opacity={0.18} />
          <polyline points={rows.map((r, i) => `${px(i)},${py(r.ssbT)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={py(bPa)} x2={100} y2={py(bPa)} stroke="currentColor" strokeWidth={0.8} strokeDasharray="4 2" />
          <line x1={0} y1={py(bLim)} x2={100} y2={py(bLim)} stroke="currentColor" strokeWidth={1} />
        </svg>
        <span className="absolute right-1 -translate-y-1/2 bg-background px-0.5 text-[9px] tabular-nums text-muted-foreground" style={{ top: `${py(bPa)}%` }}>
          B<sub>pa</sub> {bPa.toLocaleString()}
        </span>
        <span className="absolute right-1 -translate-y-1/2 bg-background px-0.5 text-[9px] tabular-nums text-muted-foreground" style={{ top: `${py(bLim)}%` }}>
          B<sub>lim</sub> {bLim.toLocaleString()}
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{rows[0]?.year}</span>
        <span>{rows[rows.length - 1]?.year}</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Latest SSB</dt>
          <dd className="font-medium tabular-nums">{latest.ssbT.toLocaleString()} t</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium">{latest.status}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Years below B<sub>lim</sub></dt>
          <dd className="font-medium tabular-nums">{belowLim}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The status is DERIVED from the reference points, not read off the tonnage — a stock at{" "}
        {latest.ssbT.toLocaleString()} t is healthy for one species and collapsed for another ·{" "}
        {belowLim > 0 ? `${belowLim} of ${rows.length} years sat below B_lim, where recruitment is impaired` : "no year fell below B_lim"}
        {recovered > 0 ? `, and the stock came back above B_pa in ${rows[recovered].year}` : ""} · the darker band is the
        one that closes a fishery
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CpueTrend — landings corrected for EFFORT. Landings alone fall when
 * a fleet shrinks and rise when it grows, which is the opposite of
 * what the stock did, so the rate is derived from both.
 * ------------------------------------------------------------------ */
export function CpueTrend({
  years,
  height = 190,
  className = "",
}: {
  years: { year: number; landingsT: number; daysAtSea: number; vessels?: number }[]
  height?: number
  className?: string
}) {
  const rows = [...years]
    .sort((a, b) => a.year - b.year)
    .map((y) => ({ ...y, cpue: y.landingsT / Math.max(y.daysAtSea, 1e-9) }))
  const first = rows[0]
  const last = rows[rows.length - 1]
  const landingsChange = (last.landingsT - first.landingsT) / Math.max(first.landingsT, 1e-9)
  const cpueChange = (last.cpue - first.cpue) / Math.max(first.cpue, 1e-9)
  const disagree = Math.sign(landingsChange) !== Math.sign(cpueChange)
  const maxL = Math.max(...rows.map((r) => r.landingsT))
  const maxC = Math.max(...rows.map((r) => r.cpue))
  const px = (i: number) => (rows.length < 2 ? 50 : (i / (rows.length - 1)) * 100)

  return (
    <div className={className}>
      {/* landings as bars, the rate as a line — deliberately on separate
          scales, and said so, because they are different quantities */}
      <div className="relative flex items-stretch gap-px rounded-[2px] border border-foreground/15" style={{ height }}>
        {rows.map((r) => (
          <div key={r.year} className="relative min-w-0 flex-1" title={`${r.year}: ${r.landingsT.toLocaleString()} t over ${r.daysAtSea.toLocaleString()} days`}>
            <div
              className="absolute inset-x-0 bottom-0 rounded-t-[1px]"
              style={{ height: `${(r.landingsT / maxL) * 100}%`, background: "color-mix(in oklch, currentColor 26%, transparent)" }}
            />
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          <polyline
            points={rows.map((r, i) => `${px(i)},${100 - (r.cpue / maxC) * 94 - 3}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{first.year}</span>
        <span>bars landings · line tonnes a day</span>
        <span>{last.year}</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Landings</dt>
          <dd className="font-medium tabular-nums">
            {landingsChange >= 0 ? "+" : ""}
            {(landingsChange * 100).toFixed(0)}%
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Effort</dt>
          <dd className="font-medium tabular-nums">
            {(((last.daysAtSea - first.daysAtSea) / Math.max(first.daysAtSea, 1e-9)) * 100).toFixed(0)}%
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Catch rate</dt>
          <dd className="font-medium tabular-nums">
            {cpueChange >= 0 ? "+" : ""}
            {(cpueChange * 100).toFixed(0)}%
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Landings are what is recorded; catch per day at sea is what the stock did ·{" "}
        {disagree
          ? `landings moved ${landingsChange >= 0 ? "up" : "down"} ${Math.abs(landingsChange * 100).toFixed(0)}% while the catch rate moved the OTHER WAY, which is the fleet changing size rather than the fish`
          : `both moved the same way, ${(landingsChange * 100).toFixed(0)}% and ${(cpueChange * 100).toFixed(0)}%, so the effort correction changes the size of the story and not its direction`}{" "}
        · the two axes are different quantities and are not comparable in height
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * LengthFrequency — the size structure of a catch against the minimum
 * conservation reference size. The share below it is the number that
 * decides whether a gear can keep fishing.
 * ------------------------------------------------------------------ */
export function LengthFrequency({
  bins,
  minSizeCm,
  height = 190,
  className = "",
}: {
  /** counts by length class, in centimetres */
  bins: { cm: number; count: number }[]
  minSizeCm: number
  height?: number
  className?: string
}) {
  const rows = [...bins].sort((a, b) => a.cm - b.cm)
  const total = rows.reduce((a, b) => a + b.count, 0)
  const under = rows.filter((b) => b.cm < minSizeCm).reduce((a, b) => a + b.count, 0)
  const max = Math.max(...rows.map((b) => b.count))
  const mean = rows.reduce((a, b) => a + b.cm * b.count, 0) / Math.max(total, 1)
  let run = 0
  const median = rows.find((b) => (run += b.count) >= total / 2)?.cm ?? 0
  const modal = rows.reduce((a, b) => (b.count > a.count ? b : a), rows[0])

  return (
    <div className={className}>
      <div className="relative flex items-stretch gap-px" style={{ height }}>
        {rows.map((b) => (
          <div key={b.cm} className="relative min-w-0 flex-1" title={`${b.cm} cm: ${b.count}`}>
            <div
              className="absolute inset-x-0 bottom-0 rounded-t-[1px]"
              style={{
                height: `${(b.count / max) * 100}%`,
                background:
                  b.cm < minSizeCm
                    ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                    : "color-mix(in oklch, currentColor 62%, transparent)",
                outline: b.cm < minSizeCm ? "1px solid currentColor" : undefined,
                outlineOffset: -1,
              }}
            />
          </div>
        ))}
        <span
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: `${((rows.findIndex((b) => b.cm >= minSizeCm) + 0) / rows.length) * 100}%` }}
          title={`minimum size ${minSizeCm} cm`}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{rows[0]?.cm} cm</span>
        <span>MCRS {minSizeCm} cm</span>
        <span>{rows[rows.length - 1]?.cm} cm</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Under size</dt>
          <dd className="font-medium tabular-nums">{((under / Math.max(total, 1)) * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Modal</dt>
          <dd className="font-medium tabular-nums">{modal.cm} cm</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Median</dt>
          <dd className="font-medium tabular-nums">{median} cm</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mean</dt>
          <dd className="font-medium tabular-nums">{mean.toFixed(1)} cm</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched classes are below the {minSizeCm} cm minimum conservation reference size — {under.toLocaleString()} of{" "}
        {total.toLocaleString()} fish, {((under / Math.max(total, 1)) * 100).toFixed(0)}% of the catch · the modal class
        at {modal.cm} cm is {modal.cm < minSizeCm ? "itself undersized, which is a gear problem rather than a bad tow" : "clear of the line"}{" "}
        · a mean length hides the shape entirely, and the shape is the whole diagnosis
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * GearSelectivity — the fitted selection curve from a paired-gear
 * trial. L50 and the selection range are DERIVED from the retained
 * proportions, never quoted, because that is what the trial is for.
 * ------------------------------------------------------------------ */
export function GearSelectivity({
  gears,
  minSizeCm,
  height = 190,
  className = "",
}: {
  /** retained proportion at each length, per gear */
  gears: { name: string; points: { cm: number; retained: number }[] }[]
  minSizeCm?: number
  className?: string
  height?: number
}) {
  const rows = gears.map((g) => {
    const pts = [...g.points].sort((a, b) => a.cm - b.cm)
    const at = (p: number) => {
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].retained >= p && pts[i - 1].retained < p) {
          const a = pts[i - 1]
          const b = pts[i]
          return a.cm + ((p - a.retained) * (b.cm - a.cm)) / Math.max(b.retained - a.retained, 1e-9)
        }
      }
      return pts[pts.length - 1].cm
    }
    const l25 = at(0.25)
    const l50 = at(0.5)
    const l75 = at(0.75)
    return { ...g, pts, l25, l50, l75, range: l75 - l25 }
  })
  const allCm = rows.flatMap((r) => r.pts.map((p) => p.cm))
  const lo = Math.min(...allCm)
  const hi = Math.max(...allCm)
  const px = (cm: number) => ((cm - lo) / Math.max(hi - lo, 1e-9)) * 100
  const py = (p: number) => 100 - p * 94 - 3
  const dashes = ["none", "5 2", "2 2", "6 2 2 2"]
  const legal = minSizeCm === undefined ? [] : rows.filter((r) => r.l50 >= minSizeCm)

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(0.5)} x2={100} y2={py(0.5)} stroke="currentColor" strokeWidth={0.6} opacity={0.4} strokeDasharray="3 3" />
          {minSizeCm !== undefined && <line x1={px(minSizeCm)} y1={0} x2={px(minSizeCm)} y2={100} stroke="currentColor" strokeWidth={1.2} />}
          {rows.map((r, i) => (
            <polyline
              key={r.name}
              points={r.pts.map((p) => `${px(p.cm)},${py(p.retained)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray={dashes[i % dashes.length]}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{lo} cm</span>
        {minSizeCm !== undefined && <span>MCRS {minSizeCm} cm</span>}
        <span>{hi} cm</span>
      </div>
      <ul className="mt-2 space-y-1 text-[10px] tabular-nums">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-2">
            <svg width="22" height="6" className="shrink-0" aria-hidden>
              <line x1={0} y1={3} x2={22} y2={3} stroke="currentColor" strokeWidth={1.5} strokeDasharray={dashes[i % dashes.length]} />
            </svg>
            <span className="w-32 shrink-0 truncate">{r.name}</span>
            <span className="text-muted-foreground">
              L50 {r.l50.toFixed(1)} cm · selection range {r.range.toFixed(1)} cm
              {minSizeCm !== undefined ? ` · ${r.l50 >= minSizeCm ? "clears" : "retains undersized fish"}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        L50 is the length at which half the fish meeting the gear are retained, INTERPOLATED from the trial rather than
        quoted, and the selection range is L75 minus L25 — a sharp curve selects, a flat one does not ·{" "}
        {minSizeCm === undefined
          ? `${rows.map((r) => `${r.name} ${r.l50.toFixed(1)} cm`).join(", ")}`
          : `${legal.length} of ${rows.length} gears put L50 at or above the ${minSizeCm} cm minimum size, which is what a mesh regulation is trying to buy`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * BycatchRatio — kilos of non-target per kilo landed, by tow. The
 * ratio is the number, not the tonnage: a big tow with a big bycatch
 * can be cleaner than a small one.
 * ------------------------------------------------------------------ */
export function BycatchRatio({
  tows,
  limit,
  className = "",
}: {
  tows: { name: string; targetKg: number; bycatchKg: number; discardedKg?: number }[]
  /** the ratio above which the ground is closed to this gear */
  limit?: number
  className?: string
}) {
  const rows = tows
    .map((t) => ({
      ...t,
      ratio: t.bycatchKg / Math.max(t.targetKg, 1e-9),
      discardShare: (t.discardedKg ?? 0) / Math.max(t.bycatchKg, 1e-9),
    }))
    .sort((a, b) => b.ratio - a.ratio)
  const totalTarget = rows.reduce((a, r) => a + r.targetKg, 0)
  const totalBy = rows.reduce((a, r) => a + r.bycatchKg, 0)
  const fleetRatio = totalBy / Math.max(totalTarget, 1e-9)
  const over = limit === undefined ? [] : rows.filter((r) => r.ratio > limit)
  const max = Math.max(limit ?? 0, ...rows.map((r) => r.ratio)) * 1.1
  const biggestTow = rows.reduce((a, r) => (r.targetKg > a.targetKg ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.targetKg.toLocaleString()} kg target · {r.bycatchKg.toLocaleString()} kg other
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${clamp((r.ratio / max) * 100, 1, 100)}%`,
                  background:
                    limit !== undefined && r.ratio > limit
                      ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                      : "color-mix(in oklch, currentColor 58%, transparent)",
                  outline: limit !== undefined && r.ratio > limit ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
              />
              {limit !== undefined && <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(limit / max) * 100}%` }} title={`limit ${(limit * 100).toFixed(0)}%`} />}
              <span className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${(fleetRatio / max) * 100}%` }} title="fleet ratio" />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.ratio * 100).toFixed(0)}% of the target weight
              {r.discardedKg !== undefined ? ` · ${(r.discardShare * 100).toFixed(0)}% of it discarded` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is a RATIO, so a big tow is not automatically a dirty one — {biggestTow.name} is the largest at{" "}
        {biggestTow.targetKg.toLocaleString()} kg and sits at {(biggestTow.ratio * 100).toFixed(0)}% ·{" "}
        the thin mark is the fleet's own {(fleetRatio * 100).toFixed(0)}%
        {limit !== undefined
          ? ` and the thick one is the ${(limit * 100).toFixed(0)}% limit, which ${over.length} tow${over.length === 1 ? "" : "s"} exceeded`
          : ""}{" "}
        · a total in tonnes answers a different question and usually the wrong one
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * QuotaUptake — allocation against landings, with the PACE derived.
 * A quota 60% used in month nine is fine; 60% used in month four is
 * a fishery that closes in August.
 * ------------------------------------------------------------------ */
export function QuotaUptake({
  stocks,
  monthsElapsed,
  monthsInYear = 12,
  className = "",
}: {
  stocks: { name: string; quotaT: number; landedT: number }[]
  monthsElapsed: number
  monthsInYear?: number
  className?: string
}) {
  const expected = clamp(monthsElapsed / Math.max(monthsInYear, 1), 0, 1)
  const rows = stocks
    .map((s) => {
      const uptake = s.landedT / Math.max(s.quotaT, 1e-9)
      const pace = uptake / Math.max(expected, 1e-9)
      // months at this rate before the quota is gone
      const exhausted = uptake > 0 ? monthsElapsed / uptake : Infinity
      // where this pace lands at year end — MULTIPLY the uptake by the
      // annualisation factor; dividing by it reported a 37% stock as 85% spare
      const yearEnd = uptake * (monthsInYear / Math.max(monthsElapsed, 1e-9))
      return { ...s, uptake, pace, exhausted, yearEnd, closesEarly: exhausted < monthsInYear }
    })
    .sort((a, b) => b.pace - a.pace)
  const early = rows.filter((r) => r.closesEarly)
  const under = rows.filter((r) => r.pace < 0.8)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.landedT.toLocaleString()} of {r.quotaT.toLocaleString()} t
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${clamp(r.uptake * 100, 0, 100)}%`,
                  background: r.closesEarly
                    ? "currentColor"
                    : "color-mix(in oklch, currentColor 45%, transparent)",
                }}
                title={`${(r.uptake * 100).toFixed(0)}% taken`}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${expected * 100}%` }} title={`pro rata at month ${monthsElapsed}`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.uptake * 100).toFixed(0)}% taken · {r.pace.toFixed(2)}× the pro-rata pace ·{" "}
              {Number.isFinite(r.exhausted)
                ? r.closesEarly
                  ? `gone by month ${r.exhausted.toFixed(1)}`
                  : `ends the year at ${(r.yearEnd * 100).toFixed(0)}%, ${((1 - r.yearEnd) * 100).toFixed(0)}% unfished`
                : "nothing landed"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The mark is where a stock would be if it were fished evenly — {(expected * 100).toFixed(0)}% at month{" "}
        {monthsElapsed} · the PACE is what matters, not the percentage: {early.length} stock
        {early.length === 1 ? "" : "s"} run out before the year does
        {early.length ? ` (${early.map((r) => r.name).join(", ")})` : ""}, and {under.length} are being left in the water
        · uptake alone cannot tell a fishery that closes in August from one that finishes in December
      </p>
    </div>
  )
}
