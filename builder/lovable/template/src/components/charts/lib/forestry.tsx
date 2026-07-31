/**
 * Forestry primitives — stand density, growth and yield, dendrochronology,
 * canopy structure, rotation planning and carbon accounting.
 *
 * Basal area, relative density, mean annual increment and the age it peaks at,
 * the ring-width index against its own running mean, canopy cover and the
 * carbon stock in each pool are all DERIVED. The rotation age is SOLVED, not
 * supplied — that is the entire decision the chart exists to inform.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * StandDensity — stems per hectare against mean diameter, with basal
 * area and the self-thinning line computed.
 * ------------------------------------------------------------------ */
export function StandDensity({
  plots,
  maxSdi = 1000,
  height = 200,
  className = "",
}: {
  plots: { name: string; stemsPerHa: number; meanDbhCm: number }[]
  /** the species' maximum stand density index */
  maxSdi?: number
  height?: number
  className?: string
}) {
  const rows = plots.map((p) => {
    const basalArea = (p.stemsPerHa * Math.PI * (p.meanDbhCm / 200) ** 2)
    // Reineke: SDI = N × (Dq/25)^1.605
    const sdi = p.stemsPerHa * Math.pow(p.meanDbhCm / 25, 1.605)
    return { ...p, basalArea, sdi, relative: sdi / maxSdi }
  })
  const dLo = Math.min(...rows.map((r) => r.meanDbhCm)) * 0.8
  const dHi = Math.max(...rows.map((r) => r.meanDbhCm)) * 1.2
  const nLo = Math.min(...rows.map((r) => r.stemsPerHa)) * 0.7
  const nHi = Math.max(...rows.map((r) => r.stemsPerHa)) * 1.3
  const px = (d: number) => ((Math.log(d) - Math.log(dLo)) / (Math.log(dHi) - Math.log(dLo))) * 100
  const py = (n: number) => 100 - ((Math.log(n) - Math.log(nLo)) / (Math.log(nHi) - Math.log(nLo))) * 100

  const limitAt = (d: number) => maxSdi / Math.pow(d / 25, 1.605)
  const line = (fraction: number) =>
    Array.from({ length: 30 }, (_, i) => {
      const d = dLo * Math.pow(dHi / dLo, i / 29)
      return `${px(d)},${py(limitAt(d) * fraction)}`
    }).join(" ")

  const crowded = rows.filter((r) => r.relative >= 0.55)

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline points={line(1)} fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <polyline points={line(0.55)} fill="none" stroke="currentColor" strokeWidth={0.8} strokeDasharray="4 2" opacity={0.7} vectorEffect="non-scaling-stroke" />
          <polyline points={line(0.35)} fill="none" stroke="currentColor" strokeWidth={0.7} strokeDasharray="1 2" opacity={0.6} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="pointer-events-none absolute inset-0">
          {rows.map((r) => (
            <span
              key={r.name}
              className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
              style={{ left: `${clamp(px(r.meanDbhCm), 1, 99)}%`, top: `${clamp(py(r.stemsPerHa), 1, 99)}%` }}
              title={`${r.name}: ${r.stemsPerHa} stems/ha at ${r.meanDbhCm} cm`}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{dLo.toFixed(0)} cm mean diameter</span>
        <span>{dHi.toFixed(0)} cm</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate">{r.name}</span>
            <span className="text-muted-foreground">
              {r.basalArea.toFixed(1)} m²/ha · SDI {r.sdi.toFixed(0)} · {(r.relative * 100).toFixed(0)}% of maximum
            </span>
            <span aria-hidden>{r.relative >= 0.55 ? "▲" : r.relative >= 0.35 ? "◆" : "▽"}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Solid line is the self-thinning limit, dashed is 55% (where competition starts killing stems) and dotted is 35%
        (full site occupancy) ·{" "}
        {crowded.length
          ? `${crowded.map((r) => r.name).join(", ")} ${crowded.length === 1 ? "is" : "are"} in the zone of imminent mortality — thin now or the stand thins itself`
          : "no plot is yet into imminent competition mortality"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * GrowthYield — standing volume, current annual increment and mean
 * annual increment. The rotation age is where MAI peaks and CAI crosses
 * it, and both are SOLVED from the volume curve.
 * ------------------------------------------------------------------ */
export function GrowthYield({
  volumes,
  height = 200,
  className = "",
}: {
  /** standing volume m³/ha at each age, oldest last */
  volumes: { age: number; volumeM3: number }[]
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!volumes.length) return null

  const sorted = [...volumes].sort((a, b) => a.age - b.age)
  const rows = sorted.map((v, i) => ({
    ...v,
    mai: v.volumeM3 / Math.max(1, v.age),
    cai: i === 0 ? 0 : (v.volumeM3 - sorted[i - 1].volumeM3) / Math.max(1, v.age - sorted[i - 1].age),
  }))
  const peakMai = rows.reduce((a, r) => (r.mai > a.mai ? r : a), rows[0])
  // the crossing: the first age where CAI drops below MAI
  const crossIdx = rows.findIndex((r, i) => i > 0 && r.cai < r.mai)
  const cross = crossIdx > 0 ? rows[crossIdx] : null

  const maxAge = Math.max(...rows.map((r) => r.age))
  const maxRate = Math.max(...rows.flatMap((r) => [r.mai, r.cai])) * 1.1
  const maxVol = Math.max(...rows.map((r) => r.volumeM3)) * 1.05
  const px = (a: number) => (a / maxAge) * 100
  const pr = (v: number) => 100 - (v / maxRate) * 100
  const pv = (v: number) => 100 - (v / maxVol) * 100

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={`0,100 ${rows.map((r) => `${px(r.age)},${pv(r.volumeM3)}`).join(" ")} 100,100`} fill="currentColor" opacity={0.1} />
          <polyline points={rows.map((r) => `${px(r.age)},${pr(r.mai)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
          <polyline points={rows.map((r) => `${px(r.age)},${pr(r.cai)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.2} strokeDasharray="4 2" vectorEffect="non-scaling-stroke" />
          <line x1={px(peakMai.age)} y1={0} x2={px(peakMai.age)} y2={100} stroke="currentColor" strokeWidth={0.5} opacity={0.55} />
        </svg>
        <span
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground bg-background"
          style={{ left: `${px(peakMai.age)}%`, top: `${pr(peakMai.mai)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>age {rows[0]?.age}</span>
        <span>age {maxAge}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
        <span className="flex items-center gap-1.5">
          <svg width={18} height={6} aria-hidden>
            <line x1={0} y1={3} x2={18} y2={3} stroke="currentColor" strokeWidth={1.4} />
          </svg>
          mean annual increment
        </span>
        <span className="flex items-center gap-1.5">
          <svg width={18} height={6} aria-hidden>
            <line x1={0} y1={3} x2={18} y2={3} stroke="currentColor" strokeWidth={1.4} strokeDasharray="4 2" />
          </svg>
          current annual increment
        </span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Shaded is standing volume · MAI peaks at age {peakMai.age} at {peakMai.mai.toFixed(1)} m³/ha/yr, which is the
        rotation age for maximum sustained yield
        {cross ? ` — CAI falls below it around age ${cross.age}, and the two meeting is the same statement` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * TreeRing — ring widths with the age trend removed, because a raw
 * series narrows with age whatever the climate did.
 * ------------------------------------------------------------------ */
export function TreeRing({
  rings,
  smoothing = 11,
  height = 190,
  className = "",
}: {
  /** ring width in mm, innermost first */
  rings: { year: number; widthMm: number }[]
  /** running-mean window used as the age trend */
  smoothing?: number
  height?: number
  className?: string
}) {
  const sorted = [...rings].sort((a, b) => a.year - b.year)
  const half = Math.floor(smoothing / 2)
  const trend = sorted.map((_, i) => {
    const from = Math.max(0, i - half)
    const to = Math.min(sorted.length - 1, i + half)
    const slice = sorted.slice(from, to + 1)
    return slice.reduce((a, r) => a + r.widthMm, 0) / slice.length
  })
  // the index is the ratio, which is the standard detrending: a value of 1 is
  // "exactly what this tree would do at this age anyway"
  const index = sorted.map((r, i) => (trend[i] > 0 ? r.widthMm / trend[i] : 1))
  const poor = sorted.filter((_, i) => index[i] < 0.6)
  const good = sorted.filter((_, i) => index[i] > 1.4)

  const maxW = Math.max(...sorted.map((r) => r.widthMm))
  const px = (i: number) => (i / Math.max(1, sorted.length - 1)) * 100

  return (
    <div className={className}>
      <div className="relative" style={{ height: height * 0.45 }}>
        <div className="absolute inset-0 flex items-end gap-px">
          {sorted.map((r, i) => (
            <div
              key={r.year}
              className="flex-1 bg-foreground/60"
              style={{ height: `${(r.widthMm / maxW) * 100}%` }}
              title={`${r.year}: ${r.widthMm.toFixed(2)} mm`}
            />
          ))}
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polyline
            points={trend.map((t, i) => `${px(i)},${100 - (t / maxW) * 100}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="4 2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="relative mt-1" style={{ height: height * 0.4 }}>
        <div className="absolute inset-x-0 top-1/2 h-px bg-foreground/35" />
        <div className="absolute inset-0 flex gap-px">
          {index.map((v, i) => (
            <div key={i} className="relative flex-1" title={`${sorted[i].year}: index ${v.toFixed(2)}`}>
              <div
                className="absolute right-0 left-0"
                style={{
                  top: v >= 1 ? `${50 - (v - 1) * 50}%` : "50%",
                  height: `${Math.min(50, Math.abs(v - 1) * 50)}%`,
                  background: v >= 1 ? "currentColor" : "var(--background)",
                  boxShadow: v >= 1 ? undefined : "inset 0 0 0 1px currentColor",
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{sorted[0]?.year}</span>
        <span>{sorted[sorted.length - 1]?.year}</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Top is raw ring width with the {smoothing}-year age trend dashed over it; below is the detrended index, where 1
        is what this tree would do at this age regardless ·{" "}
        {poor.length
          ? `${poor.length} suppressed year${poor.length === 1 ? "" : "s"}, the worst ${poor.reduce((a, r, i) => (index[sorted.indexOf(r)] < index[sorted.indexOf(a)] ? r : a), poor[0]).year}`
          : "no strongly suppressed years"}
        {good.length ? ` · ${good.length} exceptional` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CanopyProfile — foliage by height stratum, with cover and the leaf
 * area distribution derived.
 * ------------------------------------------------------------------ */
export function CanopyProfile({
  strata,
  height = 210,
  className = "",
}: {
  /** each height band and the leaf area index within it, ground upward */
  strata: { fromM: number; toM: number; lai: number; species?: string }[]
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!strata.length) return null

  const sorted = [...strata].sort((a, b) => b.fromM - a.fromM)
  const totalLai = strata.reduce((a, s) => a + s.lai, 0)
  const maxLai = Math.max(0.01, ...strata.map((s) => s.lai))
  const topM = Math.max(...strata.map((s) => s.toM))
  // Beer–Lambert: light reaching the ground under the whole canopy
  const transmitted = Math.exp(-0.5 * totalLai)
  const cover = 1 - transmitted

  // cumulative interception from the top down — where the light actually goes
  let above = 0
  const rows = sorted.map((s) => {
    const incoming = Math.exp(-0.5 * above)
    above += s.lai
    const leaving = Math.exp(-0.5 * above)
    return { ...s, intercepted: incoming - leaving }
  })
  const dominant = rows.reduce((a, r) => (r.intercepted > a.intercepted ? r : a), rows[0])

  return (
    <div className={className}>
      <div className="flex gap-2" style={{ height }}>
        <div className="flex w-10 shrink-0 flex-col justify-between text-right text-[9px] tabular-nums text-muted-foreground">
          <span>{topM} m</span>
          <span>0 m</span>
        </div>
        <div className="flex flex-1 flex-col gap-px">
          {rows.map((s) => (
            <div
              key={`${s.fromM}-${s.toM}`}
              className="relative"
              style={{ flex: `${s.toM - s.fromM} 0 0` }}
              title={`${s.fromM}–${s.toM} m: LAI ${s.lai}`}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-r-[2px]"
                style={{ width: `${(s.lai / maxLai) * 100}%`, background: `color-mix(in oklch, currentColor ${(20 + (s.lai / maxLai) * 58).toFixed(0)}%, transparent)` }}
              />
              <span
                className="absolute top-1/2 left-1 -translate-y-1/2 text-[9px] whitespace-nowrap"
                style={{ color: s.lai / maxLai > 0.6 ? "var(--background)" : "var(--muted-foreground)" }}
              >
                {s.species ?? `${s.fromM}–${s.toM} m`} · {(s.intercepted * 100).toFixed(0)}% of light
              </span>
            </div>
          ))}
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Total LAI</dt>
          <dd className="font-medium tabular-nums">{totalLai.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Canopy cover</dt>
          <dd className="font-medium tabular-nums">{(cover * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">To the floor</dt>
          <dd className="font-medium tabular-nums">{(transmitted * 100).toFixed(1)}%</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Bar length is leaf area, band height is the real vertical extent · the {dominant.species ?? `${dominant.fromM}–${dominant.toM} m`} stratum
        takes {(dominant.intercepted * 100).toFixed(0)}% of the light, and only {(transmitted * 100).toFixed(1)}% reaches
        the regeneration below
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * HarvestRotation — a compartment schedule with the age at felling and
 * the annual cut derived, so an uneven age-class distribution shows up
 * as a lumpy income rather than a claim about sustainability.
 * ------------------------------------------------------------------ */
export function HarvestRotation({
  compartments,
  rotationYears,
  horizonYears = 40,
  fromYear,
  className = "",
}: {
  compartments: { name: string; hectares: number; plantedYear: number; yieldM3PerHa: number }[]
  rotationYears: number
  horizonYears?: number
  /** first year of the window; defaults to the earliest felling */
  fromYear?: number
  className?: string
}) {
  const rows0 = compartments.map((c) => c.plantedYear + rotationYears)
  // The window has to cover the fellings it is drawn to show. Anchoring it to the
  // last planting put every felling of a long rotation off the right-hand edge.
  const thisYear = fromYear ?? Math.min(...rows0)
  const rows = compartments
    .map((c) => ({
      ...c,
      fellYear: c.plantedYear + rotationYears,
      volume: c.hectares * c.yieldM3PerHa,
    }))
    .sort((a, b) => a.fellYear - b.fellYear)

  const years = Array.from({ length: horizonYears }, (_, i) => thisYear + i)
  const cut = years.map((y) => rows.filter((r) => r.fellYear === y).reduce((a, r) => a + r.volume, 0))
  const totalArea = compartments.reduce((a, c) => a + c.hectares, 0)
  const evenFlow = (totalArea / rotationYears) * (rows.reduce((a, r) => a + r.yieldM3PerHa, 0) / Math.max(1, rows.length))
  const maxCut = Math.max(evenFlow, ...cut)
  const idleYears = cut.filter((c) => c === 0).length

  return (
    <div className={className}>
      <div className="relative flex items-end gap-px" style={{ height: 120 }}>
        {cut.map((c, i) => (
          <div
            key={years[i]}
            className="flex-1 rounded-t-[1px] bg-foreground"
            style={{ height: `${(c / maxCut) * 100}%`, minHeight: c > 0 ? 2 : 0 }}
            title={`${years[i]}: ${c.toFixed(0)} m³`}
          />
        ))}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground" style={{ bottom: `${(evenFlow / maxCut) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{years[0]}</span>
        <span>{years[years.length - 1]}</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate">{r.name}</span>
            <span className="text-muted-foreground">
              {r.hectares} ha planted {r.plantedYear} → fell {r.fellYear} · {r.volume.toFixed(0)} m³
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Dashed line is the even-flow cut ({evenFlow.toFixed(0)} m³/yr) that a fully regulated forest would give ·{" "}
        {idleYears} of the next {horizonYears} years have nothing to fell — an age-class distribution inherited from
        whoever planted, which no felling plan can undo inside one rotation
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CarbonStock — carbon by pool over time, with the sequestration rate
 * and the harvest debt derived.
 * ------------------------------------------------------------------ */
export function CarbonStock({
  years,
  height = 200,
  className = "",
}: {
  years: { year: number; aboveGround: number; belowGround: number; deadwood: number; soil: number }[]
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!years.length) return null

  const sorted = [...years].sort((a, b) => a.year - b.year)
  const total = (y: (typeof sorted)[number]) => y.aboveGround + y.belowGround + y.deadwood + y.soil
  const totals = sorted.map(total)
  const max = Math.max(...totals) * 1.05
  const netRate = (totals[totals.length - 1] - totals[0]) / Math.max(1, sorted[sorted.length - 1].year - sorted[0].year)
  // a harvest shows up as a fall in the standing pools that the soil does not follow
  const drops = sorted
    .map((y, i) => (i === 0 ? null : { year: y.year, delta: total(y) - total(sorted[i - 1]) }))
    .filter((d): d is { year: number; delta: number } => d !== null && d.delta < -max * 0.08)

  const pools: [keyof (typeof sorted)[number], string, string][] = [
    ["aboveGround", "Above ground", "currentColor"],
    ["belowGround", "Roots", "color-mix(in oklch, currentColor 60%, transparent)"],
    ["deadwood", "Deadwood", "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)"],
    ["soil", "Soil", "color-mix(in oklch, currentColor 22%, transparent)"],
  ]

  return (
    <div className={className}>
      <div className="flex items-end gap-px" style={{ height }}>
        {sorted.map((y) => (
          <div key={y.year} className="flex flex-1 flex-col justify-end" style={{ height: `${(total(y) / max) * 100}%` }}>
            {pools.map(([k, label, bg]) => (
              <div
                key={String(k)}
                style={{ flex: `${y[k] as number} 0 0`, background: bg, outline: String(k) === "deadwood" ? "0.5px solid currentColor" : undefined, outlineOffset: -0.5 }}
                title={`${y.year} ${label}: ${y[k]} tC/ha`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{sorted[0]?.year}</span>
        <span>{sorted[sorted.length - 1]?.year}</span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
        {pools.map(([k, label, bg]) => (
          <li key={String(k)} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[2px] border border-foreground/35" style={{ background: bg }} aria-hidden />
            {label}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10px] text-muted-foreground tabular-nums">
        {totals[totals.length - 1].toFixed(0)} tC/ha standing, {netRate >= 0 ? "gaining" : "losing"}{" "}
        {Math.abs(netRate).toFixed(2)} tC/ha/yr on average ·{" "}
        {drops.length
          ? `a harvest in ${drops.map((d) => d.year).join(", ")} took ${Math.abs(drops[0].delta).toFixed(0)} tC/ha out of the standing pools while the soil pool barely moved — which is the whole reason the pools are shown apart`
          : "no single year lost enough to read as a harvest"}
      </p>
    </div>
  )
}
