/**
 * Solar PV primitives — module IV curves, shading, performance ratio,
 * soiling, inverter clipping, orientation yield and string mismatch.
 *
 * The maximum power point, the loss a shaded substring actually causes,
 * the ratio between metered and expected yield, the money a cleaning
 * interval is worth, the energy clipped and the mismatch loss are all
 * DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) =>
  "£" + (Math.abs(v) < 10 ? Math.abs(v).toFixed(2) : Math.round(Math.abs(v)).toLocaleString("en-GB"))

/* ------------------------------------------------------------------ *
 * IvCurve — current against voltage, with the MAXIMUM POWER POINT
 * derived. A datasheet quotes Vmp and Imp; a measured curve is the
 * only way to know whether the module still delivers them.
 * ------------------------------------------------------------------ */
export function IvCurve({
  curves,
  ratedW,
  height = 200,
  className = "",
}: {
  curves: { name: string; points: { v: number; i: number }[] }[]
  /** the module's nameplate power, for comparison */
  ratedW?: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!curves.length) return null

  const rows = curves.map((c) => {
    const pts = [...c.points].sort((a, b) => a.v - b.v).map((p) => ({ ...p, p: p.v * p.i }))
    const mpp = pts.reduce((a, p) => (p.p > a.p ? p : a), pts[0])
    const voc = Math.max(...pts.map((p) => p.v))
    const isc = Math.max(...pts.map((p) => p.i))
    return { ...c, pts, mpp, voc, isc, ff: mpp.p / Math.max(voc * isc, 1e-9) }
  })
  const maxV = Math.max(...rows.flatMap((r) => r.pts.map((p) => p.v)))
  const maxI = Math.max(...rows.flatMap((r) => r.pts.map((p) => p.i)))
  const px = (v: number) => (v / maxV) * 100
  const py = (i: number) => 100 - (i / maxI) * 94 - 3
  const dashes = ["none", "5 2", "2 2", "6 2 2 2"]
  const best = rows.reduce((a, r) => (r.mpp.p > a.mpp.p ? r : a), rows[0])

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {rows.map((r, i) => (
            <polyline
              key={r.name}
              points={r.pts.map((p) => `${px(p.v)},${py(p.i)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray={dashes[i % dashes.length]}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {rows.map((r) => (
          <span
            key={r.name}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-background"
            style={{ left: `${px(r.mpp.v)}%`, top: `${py(r.mpp.i)}%` }}
            title={`${r.name} MPP: ${r.mpp.v.toFixed(1)} V × ${r.mpp.i.toFixed(2)} A = ${r.mpp.p.toFixed(0)} W`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 V</span>
        <span>rings are the maximum power point</span>
        <span>{maxV.toFixed(0)} V</span>
      </div>
      <ul className="mt-2 space-y-1 text-[10px] tabular-nums">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-2">
            <svg width="22" height="6" className="shrink-0" aria-hidden>
              <line x1={0} y1={3} x2={22} y2={3} stroke="currentColor" strokeWidth={1.5} strokeDasharray={dashes[i % dashes.length]} />
            </svg>
            <span className="w-28 shrink-0 truncate">{r.name}</span>
            <span className="text-muted-foreground">
              {r.mpp.p.toFixed(0)} W at {r.mpp.v.toFixed(1)} V · Voc {r.voc.toFixed(1)} · Isc {r.isc.toFixed(2)} · FF{" "}
              {(r.ff * 100).toFixed(0)}%
              {ratedW ? ` · ${((r.mpp.p / ratedW) * 100).toFixed(0)}% of nameplate` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The maximum power point is DERIVED by taking V×I across the whole curve, not read off a datasheet — and the fill
        factor, which is MPP over Voc×Isc, is what degrades first ·{" "}
        {best.name} peaks at {best.mpp.p.toFixed(0)} W{ratedW ? ` against a ${ratedW} W nameplate` : ""} · a module can
        hold its open-circuit voltage and short-circuit current perfectly while the knee collapses, and only the curve
        shows it
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ShadingLoss — the reason a small shadow costs a large fraction. A
 * string is series-connected, so the loss is derived from the WORST
 * substring, not from the shaded area.
 * ------------------------------------------------------------------ */
export function ShadingLoss({
  strings,
  className = "",
}: {
  /** each string's modules, with the fraction of each module shaded */
  strings: { name: string; modules: { shaded: number }[]; bypassDiodesPerModule?: number }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!strings.length) return null

  const rows = strings.map((s) => {
    const diodes = s.bypassDiodesPerModule ?? 3
    const area = s.modules.reduce((a, m) => a + m.shaded, 0) / Math.max(s.modules.length, 1)
    // a bypass diode drops a whole substring when any cell in it is shaded
    const lostSubstrings = s.modules.reduce(
      (a, m) => a + (m.shaded > 0 ? Math.min(diodes, Math.ceil(m.shaded * diodes)) : 0),
      0,
    )
    const totalSubstrings = s.modules.length * diodes
    const output = 1 - lostSubstrings / Math.max(totalSubstrings, 1)
    return { ...s, area, output, loss: 1 - output, amplification: (1 - output) / Math.max(area, 1e-9) }
  })
  const worst = rows.reduce((a, r) => (r.amplification > a.amplification ? r : a), rows[0])
  const maxModules = Math.max(...rows.map((r) => r.modules.length))

  return (
    <div className={className}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {(r.area * 100).toFixed(0)}% of the area shaded → {(r.loss * 100).toFixed(0)}% of the power
              </span>
            </div>
            <div className="mt-0.5 flex gap-px" style={{ width: `${(r.modules.length / maxModules) * 100}%` }}>
              {r.modules.map((m, i) => (
                <div
                  key={i}
                  className="h-5 min-w-0 flex-1 rounded-[1px] border border-foreground/25"
                  style={{
                    background:
                      m.shaded === 0
                        ? "color-mix(in oklch, currentColor 12%, transparent)"
                        : m.shaded >= 0.99
                          ? "currentColor"
                          : `linear-gradient(to top, currentColor 0 ${(m.shaded * 100).toFixed(0)}%, color-mix(in oklch, currentColor 12%, transparent) ${(m.shaded * 100).toFixed(0)}% 100%)`,
                  }}
                  title={`module ${i + 1}: ${(m.shaded * 100).toFixed(0)}% shaded`}
                />
              ))}
            </div>
            <div className="mt-1 h-2 rounded-[1px] bg-muted">
              <div className="h-full rounded-[1px] bg-foreground/60" style={{ width: `${r.output * 100}%` }} title={`${(r.output * 100).toFixed(0)}% of rated output`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.output * 100).toFixed(0)}% output ·{" "}
              {r.area === 0 ? "nothing shaded" : `the loss is ${r.amplification.toFixed(1)}× the shaded area`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A string is SERIES connected, so a bypass diode drops a whole substring the moment any cell under it is shaded —
        the loss is derived from the substrings lost, never from the shaded area · {worst.name} loses{" "}
        {worst.amplification.toFixed(1)}× its shaded fraction, which is why a flue pipe costs a roof · this is the entire
        argument for module-level electronics, and it cannot be made from a picture of a shadow
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PerformanceRatio — metered yield over what the irradiance should
 * have produced. It is the only number that compares one array with
 * another, because it divides out the weather.
 * ------------------------------------------------------------------ */
export function PerformanceRatio({
  months,
  kwp,
  target = 0.8,
  height = 190,
  className = "",
}: {
  /** metered generation and plane-of-array irradiance for each month */
  months: { label: string; kwh: number; irradianceKwhM2: number }[]
  /** the array's installed capacity */
  kwp: number
  target?: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!months.length) return null

  const rows = months.map((m) => {
    const expected = m.irradianceKwhM2 * kwp
    return { ...m, expected, pr: m.kwh / Math.max(expected, 1e-9), yield: m.kwh / Math.max(kwp, 1e-9) }
  })
  const annualKwh = rows.reduce((a, r) => a + r.kwh, 0)
  const annualExpected = rows.reduce((a, r) => a + r.expected, 0)
  const annualPr = annualKwh / Math.max(annualExpected, 1e-9)
  const below = rows.filter((r) => r.pr < target)
  const best = rows.reduce((a, r) => (r.yield > a.yield ? r : a), rows[0])
  const worstPr = rows.reduce((a, r) => (r.pr < a.pr ? r : a), rows[0])
  const maxYield = Math.max(...rows.map((r) => r.yield))

  return (
    <div className={className}>
      <div className="relative flex items-stretch gap-1 rounded-[2px] border border-foreground/15" style={{ height }}>
        {rows.map((r) => (
          <div key={r.label} className="relative min-w-0 flex-1" title={`${r.label}: ${r.kwh.toFixed(0)} kWh, PR ${(r.pr * 100).toFixed(0)}%`}>
            <div
              className="absolute inset-x-0 bottom-0 rounded-t-[1px]"
              style={{ height: `${(r.yield / maxYield) * 100}%`, background: "color-mix(in oklch, currentColor 24%, transparent)" }}
            />
            <div
              className="absolute inset-x-1 bottom-0 rounded-t-[1px]"
              style={{
                height: `${(r.yield / maxYield) * r.pr * 100}%`,
                background: r.pr < target ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "currentColor",
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex gap-1 text-[9px] text-muted-foreground">
        {rows.map((r) => (
          <span key={r.label} className="min-w-0 flex-1 truncate text-center">
            {r.label}
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Annual PR</dt>
          <dd className="font-medium tabular-nums">{(annualPr * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Yield</dt>
          <dd className="font-medium tabular-nums">{(annualKwh / kwp).toFixed(0)} kWh/kWp</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Best month</dt>
          <dd className="font-medium">{best.label}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Worst PR</dt>
          <dd className="font-medium">{worstPr.label}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is what the irradiance should have produced, solid is what was metered, and the RATIO is the only number
        that compares one array with another — it divides out the weather · {(annualPr * 100).toFixed(0)}% for the year,
        with {below.length} month{below.length === 1 ? "" : "s"} below the {(target * 100).toFixed(0)}% target ·{" "}
        {best.label} generated most and {worstPr.label} performed worst, which are different questions and are
        constantly confused
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SoilingDecay — output falling between cleans, with the OPTIMAL
 * interval derived from the loss rate and the cost of a clean. A
 * cleaning contract is sold on frequency; this is what it is worth.
 * ------------------------------------------------------------------ */
export function SoilingDecay({
  readings,
  cleanCost,
  dailyRevenueAtFull,
  height = 190,
  className = "",
}: {
  /** days since the last clean and output as a fraction of clean output */
  readings: { day: number; ratio: number }[]
  cleanCost: number
  /** what the array earns in a day when it is clean */
  dailyRevenueAtFull: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!readings.length) return null

  const pts = [...readings].sort((a, b) => a.day - b.day)
  const last = pts[pts.length - 1]
  const ratePerDay = (1 - last.ratio) / Math.max(last.day, 1e-9)
  // cost per day of a cycle of length n: clean cost amortised plus the
  // revenue lost to soiling over that cycle, which has a minimum
  const costAt = (n: number) => cleanCost / n + (ratePerDay * n * dailyRevenueAtFull) / 2
  let bestN = 1
  for (let n = 1; n <= 365; n++) if (costAt(n) < costAt(bestN)) bestN = n
  const lossAtBest = (ratePerDay * bestN) / 2
  const annualCost = costAt(bestN) * 365
  // mean loss over an uncleaned year × a YEAR of revenue — the earlier form
  // multiplied the mean loss by a single day's takings and reported it as annual
  const neverClean = ((ratePerDay * 365) / 2) * (dailyRevenueAtFull * 365)
  const px = (d: number) => (d / Math.max(Math.max(last.day, bestN * 1.4), 1e-9)) * 100
  const py = (r: number) => 100 - ((r - (1 - ratePerDay * Math.max(last.day, bestN * 1.4))) / Math.max(ratePerDay * Math.max(last.day, bestN * 1.4), 1e-9)) * 94 - 3

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <rect x={0} y={0} width={clamp(px(bestN), 0, 100)} height={100} fill="currentColor" opacity={0.11} />
          <polyline points={pts.map((p) => `${px(p.day)},${clamp(py(p.ratio), 0, 100)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute inset-y-0 w-px bg-foreground/60" style={{ left: `${clamp(px(bestN), 0, 100)}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>clean</span>
        <span>optimal interval {bestN} days</span>
        <span>{Math.round(Math.max(last.day, bestN * 1.4))} days</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Soiling rate</dt>
          <dd className="font-medium tabular-nums">{(ratePerDay * 100).toFixed(3)}%/day</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Interval</dt>
          <dd className="font-medium tabular-nums">{bestN} days</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mean loss</dt>
          <dd className="font-medium tabular-nums">{(lossAtBest * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Annual cost</dt>
          <dd className="font-medium tabular-nums">{money(annualCost)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The interval is DERIVED by minimising cleaning cost plus lost revenue together — cleaning more often is not
        better, it is a different point on the same curve · at {money(cleanCost)} a clean and {money(dailyRevenueAtFull)}{" "}
        a day, {bestN} days costs {money(annualCost)} a year against {money(neverClean)} for never cleaning at all ·{" "}
        {Math.round(365 / bestN)} cleans a year, which is the number to buy rather than the one on the quotation
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * InverterClipping — DC array against AC inverter, with the energy
 * clipped derived. Oversizing the array is usually correct, and the
 * number that decides it is annual clipped kWh, not peak kW.
 * ------------------------------------------------------------------ */
export function InverterClipping({
  hours,
  inverterKw,
  height = 190,
  className = "",
}: {
  /** DC power the array would have produced in each hour of a sample */
  hours: { label: string; dcKw: number }[]
  inverterKw: number
  height?: number
  className?: string
}) {
  // NOTHING TO DRAW IS NOT A CHART OF NOTHING. An empty array made every
  // scale here degenerate and wrote NaN into an SVG attribute, which the
  // browser drops — so the chart rendered as a blank box rather than as the
  // empty state the page around it is showing. `useRows` hands back `[]`
  // before the query settles and on every site whose owner has added nothing.
  if (!hours.length) return null

  const rows = hours.map((h) => ({ ...h, ac: Math.min(h.dcKw, inverterKw), clipped: Math.max(0, h.dcKw - inverterKw) }))
  const dcTotal = rows.reduce((a, r) => a + r.dcKw, 0)
  const clipped = rows.reduce((a, r) => a + r.clipped, 0)
  const clippedHours = rows.filter((r) => r.clipped > 0)
  const peak = Math.max(...rows.map((r) => r.dcKw))
  const dcAcRatio = peak / Math.max(inverterKw, 1e-9)

  return (
    <div className={className}>
      <div className="relative flex items-stretch gap-px rounded-[2px] border border-foreground/15" style={{ height }}>
        {rows.map((r) => (
          <div key={r.label} className="relative min-w-0 flex-1" title={`${r.label}: ${r.dcKw.toFixed(1)} kW DC → ${r.ac.toFixed(1)} kW AC`}>
            <div className="absolute inset-x-0 bottom-0" style={{ height: `${(r.ac / peak) * 100}%`, background: "color-mix(in oklch, currentColor 58%, transparent)" }} />
            {r.clipped > 0 && (
              <div
                className="absolute inset-x-0"
                style={{
                  bottom: `${(r.ac / peak) * 100}%`,
                  height: `${(r.clipped / peak) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: "1px solid currentColor",
                  outlineOffset: -1,
                }}
              />
            )}
          </div>
        ))}
        <span className="pointer-events-none absolute inset-x-0 border-t border-foreground/70" style={{ bottom: `${(inverterKw / peak) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{rows[0]?.label}</span>
        <span>line: {inverterKw} kW inverter</span>
        <span>{rows[rows.length - 1]?.label}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">DC:AC</dt>
          <dd className="font-medium tabular-nums">{dcAcRatio.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Clipped</dt>
          <dd className="font-medium tabular-nums">{((clipped / Math.max(dcTotal, 1e-9)) * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Hours</dt>
          <dd className="font-medium tabular-nums">
            {clippedHours.length}/{rows.length}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Peak DC</dt>
          <dd className="font-medium tabular-nums">{peak.toFixed(1)} kW</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched is energy the array made and the inverter could not pass · a {dcAcRatio.toFixed(2)} DC:AC ratio looks
        alarming as a peak and costs {((clipped / Math.max(dcTotal, 1e-9)) * 100).toFixed(1)}% of the ENERGY, which is
        the number that decides whether to oversize · it clips in {clippedHours.length} of {rows.length} hours here, all
        of them around noon, and the rest of the year the bigger array is free generation
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * TiltYield — annual yield across orientations, relative to the best.
 * Every roof is a compromise and the useful question is how much a
 * compromise costs, which a heatmap of absolutes cannot answer.
 * ------------------------------------------------------------------ */
export function TiltYield({
  tilts,
  azimuths,
  yields,
  roof,
  className = "",
}: {
  tilts: number[]
  /** degrees from south, negative east */
  azimuths: number[]
  /** yields[tilt][azimuth] in kWh/kWp */
  yields: number[][]
  /** the roof actually available */
  roof?: { tilt: number; azimuth: number }
  className?: string
}) {
  // NOTHING TO DRAW IS NOT A CHART OF NOTHING. An empty array made every
  // scale here degenerate and wrote NaN into an SVG attribute, which the
  // browser drops — so the chart rendered as a blank box rather than as the
  // empty state the page around it is showing. `useRows` hands back `[]`
  // before the query settles and on every site whose owner has added nothing.
  if (!tilts.length || !azimuths.length || !yields.length) return null

  const flat = yields.flat()
  const best = Math.max(...flat)
  const bestIdx = flat.indexOf(best)
  const bestTilt = tilts[Math.floor(bestIdx / azimuths.length)]
  const bestAz = azimuths[bestIdx % azimuths.length]
  const min = Math.min(...flat)
  const roofYield =
    roof === undefined ? null : yields[tilts.indexOf(roof.tilt)]?.[azimuths.indexOf(roof.azimuth)] ?? null
  const az = (a: number) => (a === 0 ? "S" : a < 0 ? `${Math.abs(a)}°E` : `${a}°W`)

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background pr-2 text-left font-normal text-muted-foreground">tilt \ azimuth</th>
              {azimuths.map((a) => (
                <th key={a} className="px-1 pb-1 font-normal text-muted-foreground">
                  {az(a)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tilts.map((t, ti) => (
              <tr key={t}>
                <td className="sticky left-0 bg-background pr-2 whitespace-nowrap">{t}°</td>
                {azimuths.map((a, ai) => {
                  const v = yields[ti]?.[ai] ?? 0
                  const rel = v / best
                  const isRoof = roof?.tilt === t && roof?.azimuth === a
                  return (
                    <td key={a} className="p-px">
                      <div
                        className="flex h-7 items-center justify-center rounded-[2px]"
                        style={{
                          background: `color-mix(in oklch, currentColor ${clamp(((v - min) / Math.max(best - min, 1e-9)) * 82 + 4, 4, 86).toFixed(0)}%, transparent)`,
                          outline: isRoof ? "2px solid currentColor" : undefined,
                          outlineOffset: -2,
                        }}
                        title={`${t}° at ${az(a)}: ${v.toFixed(0)} kWh/kWp, ${(rel * 100).toFixed(0)}% of best${v === best ? " — optimum" : ""}${isRoof ? " — this roof" : ""}`}
                      >
                        {/* an outline marks the ROOF and a glyph marks the optimum: two
                            outline weights are not a distinction anybody can read */}
                        <span className={(v - min) / Math.max(best - min, 1e-9) > 0.62 ? "text-background" : undefined}>
                          {(rel * 100).toFixed(0)}
                          {v === best ? "▲" : ""}
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
        Cells are RELATIVE to the best orientation, because the useful question about a roof is what the compromise
        costs, not the absolute yield · ▲ marks the optimum, {bestTilt}° facing {az(bestAz)} at {best.toFixed(0)} kWh/kWp
        {roofYield !== null
          ? `, and the outlined cell is the roof at ${roof!.tilt}° facing ${az(roof!.azimuth)}, which returns ${((roofYield / best) * 100).toFixed(0)}% of it — ${(100 - (roofYield / best) * 100).toFixed(0)} points, which is usually cheaper than the mounting frame that would recover them`
          : ""}{" "}
        · the surface is flat near the top, which is why east-west arrays are worth building
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * StringMismatch — modules in series run at the WEAKEST current, so a
 * string's output is set by its worst module, not its average. The
 * loss is derived from the spread.
 * ------------------------------------------------------------------ */
export function StringMismatch({
  strings,
  className = "",
}: {
  /** each string's modules, by measured Impp */
  strings: { name: string; modules: { name: string; impp: number }[] }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!strings.length) return null

  const rows = strings.map((s) => {
    const currents = s.modules.map((m) => m.impp)
    const mean = currents.reduce((a, v) => a + v, 0) / Math.max(currents.length, 1)
    const worst = Math.min(...currents)
    const bestM = Math.max(...currents)
    return { ...s, mean, worst, bestM, loss: 1 - worst / Math.max(mean, 1e-9), spread: bestM - worst }
  })
  const allMean = rows.reduce((a, r) => a + r.mean, 0) / Math.max(rows.length, 1)
  const maxI = Math.max(...rows.flatMap((r) => r.modules.map((m) => m.impp)))
  // TRUNCATED axis, stated below: these currents sit within a few percent of
  // each other and a zero baseline draws the whole subject as eight equal bars
  const floorI = Math.min(...rows.flatMap((r) => r.modules.map((m) => m.impp))) - (maxI - Math.min(...rows.flatMap((r) => r.modules.map((m) => m.impp)))) * 0.25
  const h = (v: number) => clamp(((v - floorI) / Math.max(maxI - floorI, 1e-9)) * 100, 2, 100)
  const worstString = rows.reduce((a, r) => (r.loss > a.loss ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                mean {r.mean.toFixed(2)} A · worst {r.worst.toFixed(2)} A · {(r.loss * 100).toFixed(1)}% lost
              </span>
            </div>
            {/* the limit line lives INSIDE the plot box, positioned against the
                same scale as the bars — a sibling with no height of its own
                has nothing to position against */}
            <div className="relative mt-0.5 flex items-stretch gap-px" style={{ height: 38 }}>
              {r.modules.map((m) => (
                <div key={m.name} className="relative min-w-0 flex-1" title={`${m.name}: ${m.impp.toFixed(2)} A`}>
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-[1px]"
                    style={{
                      height: `${h(m.impp)}%`,
                      background: m.impp <= r.worst + 1e-9 ? "currentColor" : "color-mix(in oklch, currentColor 32%, transparent)",
                    }}
                  />
                </div>
              ))}
              <span
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/60"
                style={{ bottom: `${h(r.worst)}%` }}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              the string runs at {r.worst.toFixed(2)} A — the solid module sets it
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Series modules all carry the SAME current, so a string runs at its worst module and the average is irrelevant —
        the solid bar in each string is the one setting the output · the bars start at{" "}
        {floorI.toFixed(2)} A rather than zero, because the whole subject is a spread of a few percent ·{" "}
        {worstString.name} loses{" "}
        {(worstString.loss * 100).toFixed(1)}% to a spread of {worstString.spread.toFixed(2)} A, against a{" "}
        {allMean.toFixed(2)} A fleet average · this is why modules are binned by current at the factory, and why one
        replacement panel of a different batch costs more than it looks
      </p>
    </div>
  )
}
