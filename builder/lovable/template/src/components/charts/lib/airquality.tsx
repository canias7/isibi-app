/**
 * Air-quality primitives — pollution rose, exceedances, source apportionment,
 * index bands, deposition and indoor CO₂.
 *
 * The dominant wind sector, the exceedance count against the legal allowance,
 * each source's share, the band a concentration falls in, the annual load and
 * the ventilation rate implied by a CO₂ trace are all DERIVED. An index band
 * passed as a prop cannot catch the concentration that contradicts it.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * PollutionRose — concentration by wind sector, so the direction the
 * pollution comes from is read off the data rather than assumed.
 * ------------------------------------------------------------------ */
export function PollutionRose({
  sectors,
  unit = "µg/m³",
  size = 230,
  className = "",
}: {
  /** one entry per compass sector, clockwise from north */
  sectors: { bearing: number; meanConcentration: number; hours: number }[]
  unit?: string
  size?: number
  className?: string
}) {
  const max = Math.max(...sectors.map((s) => s.meanConcentration))
  const totalHours = sectors.reduce((a, s) => a + s.hours, 0)
  const weighted = sectors.reduce((a, s) => a + s.meanConcentration * s.hours, 0) / Math.max(totalHours, 1)
  const worst = sectors.reduce((a, s) => (s.meanConcentration > a.meanConcentration ? s : a), sectors[0])
  // the sector responsible for the most total exposure, which is not the same
  // as the most concentrated one — a dirty wind that rarely blows matters less
  const heaviest = sectors.reduce(
    (a, s) => (s.meanConcentration * s.hours > a.meanConcentration * a.hours ? s : a),
    sectors[0],
  )
  const compass = (b: number) => ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(b / 22.5) % 16]

  const R = 50
  const wedge = (s: (typeof sectors)[number], half: number) => {
    const r = (s.meanConcentration / max) * R
    const a0 = ((s.bearing - half - 90) * Math.PI) / 180
    const a1 = ((s.bearing + half - 90) * Math.PI) / 180
    const x0 = 50 + r * Math.cos(a0)
    const y0 = 50 + r * Math.sin(a0)
    const x1 = 50 + r * Math.cos(a1)
    const y1 = 50 + r * Math.sin(a1)
    return `M 50,50 L ${x0},${y0} A ${r},${r} 0 0 1 ${x1},${y1} Z`
  }
  const half = 180 / Math.max(sectors.length, 1)

  return (
    <div className={className}>
      <div className="mx-auto" style={{ maxWidth: size }}>
        <svg viewBox="0 0 100 100" className="w-full" role="img" aria-label={`pollution rose, worst from ${compass(worst.bearing)}`}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <circle key={f} cx={50} cy={50} r={R * f} fill="none" stroke="currentColor" strokeWidth={0.3} opacity={0.28} />
          ))}
          {sectors.map((s) => (
            <path
              key={s.bearing}
              d={wedge(s, half)}
              fill="currentColor"
              fillOpacity={0.18 + (s.hours / Math.max(totalHours, 1)) * 2.4}
              stroke="currentColor"
              strokeWidth={0.4}
            />
          ))}
          {["N", "E", "S", "W"].map((l, i) => {
            const a = ((i * 90 - 90) * Math.PI) / 180
            return (
              <text key={l} x={50 + 56 * Math.cos(a)} y={50 + 56 * Math.sin(a) + 1.5} fontSize={4} textAnchor="middle" className="fill-muted-foreground">
                {l}
              </text>
            )
          })}
        </svg>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Dirtiest wind</dt>
          <dd className="font-medium tabular-nums">
            {compass(worst.bearing)} {worst.meanConcentration.toFixed(0)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Most exposure</dt>
          <dd className="font-medium tabular-nums">{compass(heaviest.bearing)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Weighted mean</dt>
          <dd className="font-medium tabular-nums">{weighted.toFixed(1)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Wedge length is mean concentration in {unit}, fill weight is how often that wind blows ·{" "}
        {compass(worst.bearing) === compass(heaviest.bearing)
          ? `${compass(worst.bearing)} is both the dirtiest wind and the one that blows most, so it is unambiguously the source direction`
          : `the dirtiest wind is ${compass(worst.bearing)} but most of the actual exposure comes from ${compass(heaviest.bearing)}, which blows far more often`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ExceedanceDays — daily means against the limit, with the allowance
 * of permitted exceedances counted down.
 * ------------------------------------------------------------------ */
export function ExceedanceDays({
  daily,
  limit,
  allowedExceedances,
  height = 190,
  className = "",
}: {
  daily: number[]
  limit: number
  /** how many days a year the limit may legally be exceeded */
  allowedExceedances: number
  height?: number
  className?: string
}) {
  const exceed = daily.map((v, i) => ({ v, i })).filter((d) => d.v > limit)
  const usedByDay = daily.map((_, i) => exceed.filter((e) => e.i <= i).length)
  const breachDay = usedByDay.findIndex((c) => c > allowedExceedances)
  const annualMean = daily.reduce((a, v) => a + v, 0) / Math.max(daily.length, 1)
  const max = Math.max(...daily, limit) * 1.06
  const px = (i: number) => (i / Math.max(1, daily.length - 1)) * 100

  return (
    <div className={className}>
      <div className="relative flex items-end gap-px" style={{ height }}>
        {daily.map((v, i) => (
          <div
            key={i}
            className="min-w-0 flex-1"
            style={{
              height: `${(v / max) * 100}%`,
              background: v > limit ? "currentColor" : "color-mix(in oklch, currentColor 26%, transparent)",
            }}
            title={`day ${i + 1}: ${v.toFixed(0)}`}
          />
        ))}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground" style={{ bottom: `${(limit / max) * 100}%` }} />
        {breachDay > 0 && <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${px(breachDay)}%` }} />}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>day 1</span>
        <span>day {daily.length}</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Exceedances</dt>
          <dd className="font-medium tabular-nums">
            {exceed.length} of {allowedExceedances}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Annual mean</dt>
          <dd className="font-medium tabular-nums">{annualMean.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Worst day</dt>
          <dd className="font-medium tabular-nums">{Math.max(...daily).toFixed(0)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Solid bars are over the {limit} limit ·{" "}
        {breachDay > 0
          ? `the annual allowance of ${allowedExceedances} was spent by day ${breachDay + 1}, so every exceedance after that is a breach`
          : `${allowedExceedances - exceed.length} exceedance${allowedExceedances - exceed.length === 1 ? "" : "s"} still in hand`}{" "}
        — an annual mean inside the limit says nothing about this, which is why both are regulated
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SourceApportionment — each source's share by season, with the
 * controllable fraction derived because that is what policy can move.
 * ------------------------------------------------------------------ */
export function SourceApportionment({
  periods,
  sources,
  contributions,
  controllable = [],
  className = "",
}: {
  periods: string[]
  sources: string[]
  /** contributions[period][source] in µg/m³ */
  contributions: number[][]
  /** which sources local policy can actually act on */
  controllable?: string[]
  className?: string
}) {
  const totals = periods.map((_, pi) => contributions[pi]?.reduce((a, v) => a + v, 0) ?? 0)
  const max = Math.max(...totals)
  const bySource = sources.map((s, si) => ({
    name: s,
    total: periods.reduce((a, _p, pi) => a + (contributions[pi]?.[si] ?? 0), 0),
    controllable: controllable.includes(s),
  }))
  const grand = bySource.reduce((a, s) => a + s.total, 0)
  const controllableShare = bySource.filter((s) => s.controllable).reduce((a, s) => a + s.total, 0) / Math.max(grand, 1)
  const fills = [
    "currentColor",
    "color-mix(in oklch, currentColor 62%, transparent)",
    "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 4px)",
    "color-mix(in oklch, currentColor 30%, transparent)",
    "repeating-linear-gradient(-45deg, currentColor 0 1.5px, transparent 1.5px 4px)",
    "color-mix(in oklch, currentColor 12%, transparent)",
  ]

  return (
    <div className={className}>
      <div className="flex items-end gap-2" style={{ height: 180 }}>
        {periods.map((p, pi) => (
          <div key={p} className="flex h-full flex-1 flex-col justify-end" style={{ height: `${(totals[pi] / max) * 100}%` }}>
            {sources
              .map((s, si) => ({ s, si, v: contributions[pi]?.[si] ?? 0 }))
              .reverse()
              .map(({ s, si, v }) => (
                <div
                  key={s}
                  className="w-full border-t border-foreground/25 first:border-t-0"
                  style={{ flex: `${v} 0 0`, background: fills[si % fills.length] }}
                  title={`${p} · ${s}: ${v.toFixed(1)}`}
                />
              ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {periods.map((p) => (
          <span key={p} className="flex-1 truncate text-center text-[9px] text-muted-foreground">
            {p}
          </span>
        ))}
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {bySource
          .slice()
          .sort((a, b) => b.total - a.total)
          .map((s) => (
            <li key={s.name} className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-[2px] border border-foreground/35"
                style={{ background: fills[sources.indexOf(s.name) % fills.length] }}
                aria-hidden
              />
              <span className="w-32 shrink-0 truncate">{s.name}</span>
              <span className="text-muted-foreground">
                {((s.total / Math.max(grand, 1)) * 100).toFixed(0)}% of the total
                {s.controllable ? " · local policy can act" : " · outside local control"}
              </span>
            </li>
          ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {(controllableShare * 100).toFixed(0)}% of the measured concentration comes from sources local policy can act
        on ·{" "}
        {controllableShare < 0.4
          ? "eliminating every controllable source entirely would still leave most of it, which is the argument a local plan has to answer"
          : "a local plan can move most of this"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AqiBand — a concentration placed in its index band. The band is
 * LOOKED UP from the breakpoints and the sub-index interpolated, which
 * is how the number is actually defined.
 * ------------------------------------------------------------------ */
export function AqiBand({
  pollutants,
  className = "",
}: {
  pollutants: {
    name: string
    concentration: number
    unit: string
    /** breakpoints as [concentrationLow, concentrationHigh, indexLow, indexHigh] */
    breakpoints: [number, number, number, number][]
  }[]
  className?: string
}) {
  const BANDS = [
    { to: 50, name: "Good" },
    { to: 100, name: "Moderate" },
    { to: 150, name: "Unhealthy for sensitive" },
    { to: 200, name: "Unhealthy" },
    { to: 300, name: "Very unhealthy" },
    { to: 500, name: "Hazardous" },
  ]
  const rows = pollutants.map((p) => {
    const bp = p.breakpoints.find((b) => p.concentration >= b[0] && p.concentration <= b[1]) ?? p.breakpoints[p.breakpoints.length - 1]
    const [cLo, cHi, iLo, iHi] = bp
    const index = iLo + ((iHi - iLo) * (clamp(p.concentration, cLo, cHi) - cLo)) / Math.max(cHi - cLo, 1e-9)
    const band = BANDS.find((b) => index <= b.to) ?? BANDS[BANDS.length - 1]
    return { ...p, index, band }
  })
  const driver = rows.reduce((a, r) => (r.index > a.index ? r : a), rows[0])

  return (
    <div className={className}>
      <div className="flex h-6 w-full overflow-hidden rounded-[3px] border border-foreground/30">
        {BANDS.map((b, i) => (
          <div
            key={b.name}
            className="flex items-center justify-center border-r border-foreground/25 text-[8px] last:border-r-0"
            style={{
              width: `${((b.to - (BANDS[i - 1]?.to ?? 0)) / 500) * 100}%`,
              background: `color-mix(in oklch, currentColor ${(6 + i * 15).toFixed(0)}%, transparent)`,
            }}
            title={b.name}
          >
            {/* the label's colour goes on the child — on the parent it would
                redefine currentColor for the parent's own background */}
            <span style={{ color: i >= 4 ? "var(--background)" : undefined }}>{b.to}</span>
          </div>
        ))}
      </div>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-[11px]">{r.name}</span>
            <div className="relative h-4 flex-1 rounded-[2px] bg-muted">
              <span
                className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-[1px]"
                style={{ left: `${(clamp(r.index, 0, 500) / 500) * 100}%`, background: r.name === driver.name ? "currentColor" : "color-mix(in oklch, currentColor 45%, transparent)" }}
              />
            </div>
            <span className="w-44 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {r.concentration} {r.unit} → index {Math.round(r.index)} · {r.band.name}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The overall index is the WORST sub-index, not an average — {driver.name} at {Math.round(driver.index)} sets it
        to {driver.band.name} whatever the others do · each sub-index is interpolated between the published
        breakpoints, which is why the same concentration reads differently for different pollutants
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DepositionFlux — the annual load landing on a receptor, derived from
 * concentration and deposition velocity rather than reported.
 * ------------------------------------------------------------------ */
export function DepositionFlux({
  species,
  criticalLoad,
  className = "",
}: {
  /** concentration in µg/m³ and deposition velocity in cm/s */
  species: { name: string; concentration: number; velocityCmS: number; nitrogenFraction?: number }[]
  /** the receptor's critical load in kg N per hectare per year */
  criticalLoad?: number
  className?: string
}) {
  const SECONDS = 365 * 24 * 3600
  const rows = species.map((s) => {
    // µg/m³ × cm/s → convert to kg/ha/yr
    // µg/m³ × m/s × s/yr = µg/m²/yr; 1e-9 takes that to kg and 1e4 to a hectare.
    // A trailing /1000 here divided every load by a thousand and printed 0.0.
    const fluxKgHaYr = s.concentration * (s.velocityCmS / 100) * SECONDS * 1e-9 * 1e4
    return { ...s, fluxKgHaYr, nitrogen: fluxKgHaYr * (s.nitrogenFraction ?? 0) }
  })
  const totalN = rows.reduce((a, r) => a + r.nitrogen, 0)
  const total = rows.reduce((a, r) => a + r.fluxKgHaYr, 0)
  const max = Math.max(...rows.map((r) => r.fluxKgHaYr))
  const exceeded = criticalLoad !== undefined && totalN > criticalLoad

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span>{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.concentration} µg/m³ × {r.velocityCmS} cm/s
              </span>
            </div>
            <div className="mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="h-full rounded-[2px] bg-foreground/50" style={{ width: `${(r.fluxKgHaYr / max) * 100}%` }} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.fluxKgHaYr.toFixed(1)} kg/ha/yr
              {r.nitrogenFraction ? ` · ${r.nitrogen.toFixed(1)} kg N` : ""}
            </span>
          </li>
        ))}
      </ul>
      {criticalLoad !== undefined && (
        <div className="mt-2">
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="font-medium">Nitrogen load</span>
            <span className="tabular-nums text-muted-foreground">
              {totalN.toFixed(1)} against a critical load of {criticalLoad}
            </span>
          </div>
          <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
            <div
              className="h-full rounded-[2px]"
              style={{
                width: `${clamp((totalN / Math.max(criticalLoad * 1.5, 1e-9)) * 100, 0, 100)}%`,
                background: exceeded ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 50%, transparent)",
                outline: exceeded ? "1px solid currentColor" : undefined,
                outlineOffset: -1,
              }}
            />
            <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${(1 / 1.5) * 100}%` }} />
          </div>
        </div>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Flux is concentration × deposition velocity × a year, computed here — {total.toFixed(1)} kg/ha/yr in total ·{" "}
        {criticalLoad === undefined
          ? "no critical load given"
          : exceeded
            ? `the nitrogen load exceeds the critical load by ${(totalN - criticalLoad).toFixed(1)} kg/ha/yr, which is a habitat-condition failure however good the concentration looks`
            : `the nitrogen load sits ${(criticalLoad - totalN).toFixed(1)} kg/ha/yr below the critical load`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * IndoorCo2 — a CO₂ trace with the ventilation rate per person SOLVED
 * from the steady-state concentration, which is the actual reason
 * anybody measures CO₂ indoors.
 * ------------------------------------------------------------------ */
export function IndoorCo2({
  trace,
  occupants,
  outdoorPpm = 420,
  minutesPerSample = 5,
  height = 190,
  className = "",
}: {
  trace: number[]
  occupants: number
  outdoorPpm?: number
  minutesPerSample?: number
  height?: number
  className?: string
}) {
  // steady state: C - Cout = G / Q, with G ≈ 0.005 L/s of CO₂ per adult at rest
  const generationLps = 0.005 * occupants
  const peak = Math.max(...trace)
  const steady = trace.slice(-Math.max(3, Math.floor(trace.length / 6))).reduce((a, v) => a + v, 0) / Math.max(3, Math.floor(trace.length / 6))
  const excessFraction = Math.max(1e-9, (steady - outdoorPpm) / 1e6)
  const ventLps = generationLps / excessFraction
  const perPerson = ventLps / Math.max(occupants, 1)
  const above1000 = trace.filter((v) => v > 1000).length
  const max = Math.max(peak, 1600) * 1.04
  const px = (i: number) => (i / Math.max(1, trace.length - 1)) * 100
  const py = (v: number) => 100 - (v / max) * 100

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <rect x={0} y={0} width={100} height={py(1000)} fill="currentColor" opacity={0.09} />
          <line x1={0} y1={py(1000)} x2={100} y2={py(1000)} stroke="currentColor" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.6} />
          <line x1={0} y1={py(outdoorPpm)} x2={100} y2={py(outdoorPpm)} stroke="currentColor" strokeWidth={0.4} opacity={0.35} />
          <polygon points={`0,100 ${trace.map((v, i) => `${px(i)},${py(v)}`).join(" ")} 100,100`} fill="currentColor" opacity={0.12} />
          <polyline points={trace.map((v, i) => `${px(i)},${py(v)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute right-1 -translate-y-full bg-background px-1 text-[9px] text-muted-foreground" style={{ top: `${py(1000)}%` }}>
          1000 ppm
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 h</span>
        <span>{((trace.length * minutesPerSample) / 60).toFixed(1)} h</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Steady state</dt>
          <dd className="font-medium tabular-nums">{Math.round(steady)} ppm</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ventilation</dt>
          <dd className="font-medium tabular-nums">{perPerson.toFixed(1)} L/s/person</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Over 1000</dt>
          <dd className="font-medium tabular-nums">{((above1000 * minutesPerSample) / 60).toFixed(1)} h</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        CO₂ is not the hazard — it is the tracer. The steady-state rise over outdoor solves the fresh air per person,
        and {perPerson.toFixed(1)} L/s against the usual 10 L/s design figure is what actually matters for{" "}
        {occupants} people in this room
      </p>
    </div>
  )
}
