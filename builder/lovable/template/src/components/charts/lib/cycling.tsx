/**
 * Cycling primitives — the power-duration curve, training load ramp, cadence,
 * aerodynamic drag, gearing and a climb profile.
 *
 * Critical power and W′ are FITTED from the mean-maximal efforts, the ramp rate
 * from the chronic load, the drag split from speed and CdA, every gear's
 * development from the ratio and wheel, and the gradient from the elevation
 * trace. A stated FTP is a claim; one solved from the curve is a measurement.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * PowerCurve — mean-maximal power against duration, with critical power
 * and W′ fitted by regression on the work-time form.
 * ------------------------------------------------------------------ */
export function PowerCurve({
  efforts,
  height = 200,
  className = "",
}: {
  /** best average power sustained for each duration */
  efforts: { seconds: number; watts: number }[]
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!efforts.length) return null

  // W = CP·t + W′ is linear in t, so a least-squares fit over the efforts
  // between two and twenty minutes gives both without an optimiser
  const fit = efforts.filter((e) => e.seconds >= 120 && e.seconds <= 1200)
  const pts = (fit.length >= 2 ? fit : efforts).map((e) => ({ t: e.seconds, w: e.watts * e.seconds }))
  const n = pts.length
  const mt = pts.reduce((a, p) => a + p.t, 0) / Math.max(n, 1)
  const mw = pts.reduce((a, p) => a + p.w, 0) / Math.max(n, 1)
  const num = pts.reduce((a, p) => a + (p.t - mt) * (p.w - mw), 0)
  const den = pts.reduce((a, p) => a + (p.t - mt) ** 2, 0)
  const cp = den === 0 ? 0 : num / den
  const wPrime = mw - cp * mt

  const sorted = [...efforts].sort((a, b) => a.seconds - b.seconds)
  const tLo = sorted[0].seconds
  const tHi = sorted[sorted.length - 1].seconds
  const maxW = Math.max(...sorted.map((e) => e.watts)) * 1.05
  const px = (t: number) => ((Math.log10(t) - Math.log10(tLo)) / (Math.log10(tHi) - Math.log10(tLo))) * 100
  const py = (w: number) => 100 - (w / maxW) * 100
  const model = Array.from({ length: 60 }, (_, i) => {
    const t = tLo * Math.pow(tHi / tLo, i / 59)
    return { t, w: cp + wPrime / t }
  })
  const fmt = (s: number) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s}s`)

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(cp)} x2={100} y2={py(cp)} stroke="currentColor" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.6} />
          <polyline points={model.map((m) => `${px(m.t)},${py(m.w)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="2 2" opacity={0.6} vectorEffect="non-scaling-stroke" />
          <polyline points={sorted.map((e) => `${px(e.seconds)},${py(e.watts)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="pointer-events-none absolute inset-0">
          {sorted.map((e) => (
            <span key={e.seconds} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" style={{ left: `${px(e.seconds)}%`, top: `${py(e.watts)}%` }} title={`${fmt(e.seconds)}: ${e.watts} W`} />
          ))}
        </div>
        <span className="absolute right-1 -translate-y-full bg-background px-1 text-[9px] text-muted-foreground" style={{ top: `${py(cp)}%` }}>
          CP {Math.round(cp)} W
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{fmt(tLo)}</span>
        <span>log duration</span>
        <span>{fmt(tHi)}</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Critical power</dt>
          <dd className="font-medium tabular-nums">{Math.round(cp)} W</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">W′</dt>
          <dd className="font-medium tabular-nums">{(wPrime / 1000).toFixed(1)} kJ</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">5-min predicted</dt>
          <dd className="font-medium tabular-nums">{Math.round(cp + wPrime / 300)} W</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        CP and W′ are FITTED from the two-to-twenty-minute efforts, not stated · W′ is the {(wPrime / 1000).toFixed(1)} kJ
        battery above CP, which is why a rider with a big W′ wins a sprint and loses an hour climb to the same CP
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * TssRamp — weekly load with the ramp rate derived, since it is the
 * change rather than the level that produces injury.
 * ------------------------------------------------------------------ */
export function TssRamp({
  weeks,
  safeRampPercent = 10,
  height = 200,
  className = "",
}: {
  /** training stress per week, oldest first */
  weeks: number[]
  safeRampPercent?: number
  height?: number
  className?: string
}) {
  const chronic = weeks.map((_, i) => {
    const slice = weeks.slice(Math.max(0, i - 3), i + 1)
    return slice.reduce((a, v) => a + v, 0) / slice.length
  })
  const ramp = weeks.map((w, i) => (i === 0 ? 0 : ((w - weeks[i - 1]) / Math.max(weeks[i - 1], 1)) * 100))
  const risky = ramp.map((r, i) => (i > 0 && r > safeRampPercent ? i : -1)).filter((i) => i > 0)
  const max = Math.max(...weeks, ...chronic) * 1.06
  const biggest = ramp.reduce((a, r, i) => (r > ramp[a] ? i : a), 0)

  return (
    <div className={className}>
      <div className="relative flex items-end gap-1" style={{ height }}>
        {weeks.map((w, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t-[2px]"
              style={{
                height: `${(w / max) * 100}%`,
                background: risky.includes(i) ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 46%, transparent)",
                outline: risky.includes(i) ? "1px solid currentColor" : undefined,
                outlineOffset: -1,
              }}
              title={`week ${i + 1}: ${w} TSS${i > 0 ? `, ${ramp[i] >= 0 ? "+" : "−"}${Math.abs(ramp[i]).toFixed(0)}%` : ""}`}
            />
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          <polyline
            points={chronic.map((c, i) => `${((i + 0.5) / weeks.length) * 100},${100 - (c / max) * 100}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.3}
            strokeDasharray="4 2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>week 1</span>
        <span>week {weeks.length}</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Latest week</dt>
          <dd className="font-medium tabular-nums">{weeks[weeks.length - 1]} TSS</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Four-week mean</dt>
          <dd className="font-medium tabular-nums">{Math.round(chronic[chronic.length - 1])}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Weeks over ramp</dt>
          <dd className="font-medium tabular-nums">{risky.length}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Dashed is the four-week mean; hatched weeks rose more than {safeRampPercent}% on the one before ·{" "}
        {risky.length
          ? `the biggest jump was week ${biggest + 1} at +${ramp[biggest].toFixed(0)}% — a high load reached gradually is trainable and the same load reached in a fortnight is an injury`
          : "no week rose faster than the safe ramp"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CadenceDistribution — time at each cadence against the torque it
 * implies, since the same power at 60 rpm is twice the pedal force.
 * ------------------------------------------------------------------ */
export function CadenceDistribution({
  bins,
  averagePower,
  height = 200,
  className = "",
}: {
  /** minutes spent in each cadence band */
  bins: { rpm: number; minutes: number }[]
  averagePower: number
  height?: number
  className?: string
}) {
  const rows = [...bins]
    .sort((a, b) => a.rpm - b.rpm)
    .map((b) => ({ ...b, torque: (averagePower * 60) / (2 * Math.PI * Math.max(b.rpm, 1)) }))
  const total = rows.reduce((a, r) => a + r.minutes, 0)
  const weighted = rows.reduce((a, r) => a + r.rpm * r.minutes, 0) / Math.max(total, 1)
  const maxMin = Math.max(...rows.map((r) => r.minutes))
  const maxTorque = Math.max(...rows.map((r) => r.torque))
  const grinding = rows.filter((r) => r.rpm < 70).reduce((a, r) => a + r.minutes, 0)

  return (
    <div className={className}>
      <div className="relative flex items-end gap-1" style={{ height }}>
        {rows.map((r) => (
          <div key={r.rpm} className="flex h-full flex-1 flex-col justify-end">
            <div className="w-full rounded-t-[2px] bg-foreground/50" style={{ height: `${(r.minutes / maxMin) * 100}%` }} title={`${r.rpm} rpm: ${r.minutes} min, ${r.torque.toFixed(0)} N·m`} />
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          <polyline
            points={rows.map((r, i) => `${((i + 0.5) / rows.length) * 100},${100 - (r.torque / maxTorque) * 96 - 2}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            strokeDasharray="4 2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="flex gap-1">
        {rows.map((r) => (
          <span key={r.rpm} className="flex-1 text-center text-[9px] tabular-nums text-muted-foreground">
            {r.rpm}
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Weighted cadence</dt>
          <dd className="font-medium tabular-nums">{weighted.toFixed(0)} rpm</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Torque at 60</dt>
          <dd className="font-medium tabular-nums">{((averagePower * 60) / (2 * Math.PI * 60)).toFixed(0)} N·m</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Torque at 100</dt>
          <dd className="font-medium tabular-nums">{((averagePower * 60) / (2 * Math.PI * 100)).toFixed(0)} N·m</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Bars are time, the dashed line is the pedal torque that cadence implies at {averagePower} W — the same power at
        60 rpm is {(100 / 60).toFixed(1)}× the force at 100 ·{" "}
        {grinding > 0
          ? `${grinding} minutes below 70 rpm, which is where the knee load is, and it does not show up in a power figure at all`
          : "no time below 70 rpm"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AeroDrag — the power split between aerodynamic drag, rolling
 * resistance and gravity, SOLVED at each speed from the physics.
 * ------------------------------------------------------------------ */
export function AeroDrag({
  cda,
  crr,
  massKg,
  gradient = 0,
  airDensity = 1.225,
  maxKph = 50,
  height = 200,
  className = "",
}: {
  cda: number
  crr: number
  massKg: number
  /** as a fraction, 0.05 = 5% */
  gradient?: number
  airDensity?: number
  maxKph?: number
  height?: number
  className?: string
}) {
  const g = 9.81
  const rows = Array.from({ length: 50 }, (_, i) => {
    const kph = ((i + 1) / 50) * maxKph
    const v = kph / 3.6
    const aero = 0.5 * airDensity * cda * v ** 3
    const roll = crr * massKg * g * v
    const climb = gradient * massKg * g * v
    return { kph, aero, roll, climb, total: aero + roll + climb }
  })
  const max = rows[rows.length - 1].total
  const crossover = rows.find((r) => r.aero > r.roll + r.climb)
  const at40 = rows.reduce((a, r) => (Math.abs(r.kph - 40) < Math.abs(a.kph - 40) ? r : a), rows[0])

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={`0,100 ${rows.map((r) => `${(r.kph / maxKph) * 100},${100 - ((r.roll + r.climb) / max) * 100}`).join(" ")} 100,100`} fill="currentColor" opacity={0.28} />
          <polygon
            points={`${rows.map((r) => `${(r.kph / maxKph) * 100},${100 - ((r.roll + r.climb) / max) * 100}`).join(" ")} ${rows
              .slice()
              .reverse()
              .map((r) => `${(r.kph / maxKph) * 100},${100 - (r.total / max) * 100}`)
              .join(" ")}`}
            fill="currentColor"
            opacity={0.11}
          />
          <polyline points={rows.map((r) => `${(r.kph / maxKph) * 100},${100 - (r.total / max) * 100}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          {crossover && <line x1={(crossover.kph / maxKph) * 100} y1={0} x2={(crossover.kph / maxKph) * 100} y2={100} stroke="currentColor" strokeWidth={0.5} opacity={0.55} />}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 km/h</span>
        <span>{maxKph} km/h</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">At 40 km/h</dt>
          <dd className="font-medium tabular-nums">{Math.round(at40.total)} W</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Aero share</dt>
          <dd className="font-medium tabular-nums">{((at40.aero / at40.total) * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Aero dominates</dt>
          <dd className="font-medium tabular-nums">{crossover ? `${crossover.kph.toFixed(0)} km/h` : "never"}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Dark is rolling and gravity, pale is aerodynamic drag · drag goes as the CUBE of speed, so it passes everything
        else at {crossover ? `${crossover.kph.toFixed(0)} km/h` : "no speed in this range"} and past that a position
        change is worth more than any weight saving
        {gradient > 0 ? ` — at ${(gradient * 100).toFixed(1)}% gravity keeps that crossover high, which is why climbing bikes are light and time-trial bikes are not` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * GearRatios — every combination's development, with the duplicates and
 * the gaps DERIVED. A gear table nobody has computed the steps of is a
 * list of numbers.
 * ------------------------------------------------------------------ */
export function GearRatios({
  chainrings,
  sprockets,
  wheelCircumferenceMm = 2096,
  className = "",
}: {
  chainrings: number[]
  sprockets: number[]
  wheelCircumferenceMm?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!chainrings.length || !sprockets.length) return null

  const combos = chainrings.flatMap((c) =>
    sprockets.map((s) => ({ c, s, development: (c / s) * (wheelCircumferenceMm / 1000) })),
  )
  const sorted = [...combos].sort((a, b) => a.development - b.development)
  const steps = sorted.map((g, i) => (i === 0 ? 0 : ((g.development - sorted[i - 1].development) / sorted[i - 1].development) * 100))
  // a duplicate is a step under 2%, which no rider can feel
  const duplicates = steps.filter((s) => s > 0 && s < 2).length
  const biggestStep = steps.reduce((a, s, i) => (s > steps[a] ? i : a), 0)
  const range = sorted[sorted.length - 1].development / sorted[0].development
  const max = sorted[sorted.length - 1].development

  return (
    <div className={className}>
      <div className="relative h-10 rounded-[2px] bg-muted">
        {sorted.map((g, i) => (
          <span
            key={`${g.c}-${g.s}`}
            className="absolute inset-y-1 w-0.5"
            style={{
              left: `${(g.development / max) * 100}%`,
              background: steps[i] > 0 && steps[i] < 2 ? "color-mix(in oklch, currentColor 35%, transparent)" : "currentColor",
            }}
            title={`${g.c}×${g.s}: ${g.development.toFixed(2)} m`}
          />
        ))}
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] tabular-nums text-muted-foreground">
        <span>{sorted[0].development.toFixed(2)} m</span>
        <span>{max.toFixed(2)} m per pedal turn</span>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="pr-1.5 pb-1 text-left font-normal text-muted-foreground">ring \ sprocket</th>
              {sprockets.map((s) => (
                <th key={s} className="px-0.5 pb-1 font-medium">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chainrings.map((c) => (
              <tr key={c}>
                <th className="pr-1.5 text-left font-medium">{c}</th>
                {sprockets.map((s) => {
                  const dev = (c / s) * (wheelCircumferenceMm / 1000)
                  const idx = sorted.findIndex((g) => g.c === c && g.s === s)
                  const dup = steps[idx] > 0 && steps[idx] < 2
                  return (
                    <td key={s} className="p-px">
                      <div
                        className="flex h-5 items-center justify-center rounded-[2px]"
                        style={{
                          background: `color-mix(in oklch, currentColor ${((dev / max) * 46).toFixed(0)}%, transparent)`,
                          outline: dup ? "1px dashed currentColor" : undefined,
                          outlineOffset: -1,
                        }}
                        title={dup ? `${dev.toFixed(2)} m — duplicates the gear below` : `${dev.toFixed(2)} m`}
                      >
                        {dev.toFixed(1)}
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
        Development in metres per pedal turn · {combos.length} combinations give{" "}
        {combos.length - duplicates} usable gears over a {range.toFixed(2)}:1 range — {duplicates} are within 2% of the
        gear below and nobody can feel the difference · the biggest step is{" "}
        {steps[biggestStep].toFixed(1)}% at {sorted[biggestStep]?.c}×{sorted[biggestStep]?.s}, which is where a cadence
        drops out from under you
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ClimbProfile — gradient computed from the elevation trace, with the
 * steepest sustained kilometre found rather than named.
 * ------------------------------------------------------------------ */
export function ClimbProfile({
  points,
  height = 200,
  className = "",
}: {
  /** distance in km and elevation in metres */
  points: { km: number; elevationM: number }[]
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!points.length) return null

  const sorted = [...points].sort((a, b) => a.km - b.km)
  const segments = sorted.map((p, i) => {
    const prev = sorted[i - 1]
    const run = prev ? p.km - prev.km : 0
    const rise = prev ? p.elevationM - prev.elevationM : 0
    return { ...p, run, rise, gradient: run > 0 ? rise / (run * 1000) : 0 }
  })
  const totalKm = sorted[sorted.length - 1].km - sorted[0].km
  const totalRise = segments.reduce((a, s) => a + Math.max(0, s.rise), 0)
  const average = totalRise / Math.max(totalKm * 1000, 1e-9)
  // the steepest continuous kilometre, found by sliding a 1 km window
  const elevAt = (km: number) => {
    const i = sorted.findIndex((p) => p.km >= km)
    if (i <= 0) return sorted[0].elevationM
    const a = sorted[i - 1]
    const b = sorted[i]
    return a.elevationM + ((b.elevationM - a.elevationM) * (km - a.km)) / Math.max(b.km - a.km, 1e-9)
  }
  let steepest = { at: sorted[0].km, gradient: -Infinity }
  for (let km = sorted[0].km; km + 1 <= sorted[sorted.length - 1].km; km += 0.1) {
    const grad = (elevAt(km + 1) - elevAt(km)) / 1000
    if (grad > steepest.gradient) steepest = { at: km, gradient: grad }
  }
  const minEl = Math.min(...sorted.map((p) => p.elevationM))
  const maxEl = Math.max(...sorted.map((p) => p.elevationM))
  const px = (km: number) => ((km - sorted[0].km) / Math.max(totalKm, 1e-9)) * 100
  const py = (e: number) => 100 - ((e - minEl) / Math.max(maxEl - minEl, 1e-9)) * 92 - 4

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <rect x={px(steepest.at)} y={0} width={px(steepest.at + 1) - px(steepest.at)} height={100} fill="currentColor" opacity={0.13} />
          <polygon points={`0,100 ${sorted.map((p) => `${px(p.km)},${py(p.elevationM)}`).join(" ")} 100,100`} fill="currentColor" opacity={0.2} />
          <polyline points={sorted.map((p) => `${px(p.km)},${py(p.elevationM)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        </svg>
        {/* a gradient strip, because a profile drawn to a compressed x-axis
            always looks gentler than the road feels */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-2.5">
          {segments.slice(1).map((s, i) => (
            <span
              key={i}
              style={{
                width: `${(s.run / Math.max(totalKm, 1e-9)) * 100}%`,
                background: `color-mix(in oklch, currentColor ${clamp(s.gradient * 700, 0, 88).toFixed(0)}%, transparent)`,
              }}
              title={`${(s.gradient * 100).toFixed(1)}%`}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{sorted[0].km.toFixed(1)} km</span>
        <span>{sorted[sorted.length - 1].km.toFixed(1)} km</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Length</dt>
          <dd className="font-medium tabular-nums">{totalKm.toFixed(1)} km</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ascent</dt>
          <dd className="font-medium tabular-nums">{Math.round(totalRise)} m</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Average</dt>
          <dd className="font-medium tabular-nums">{(average * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Steepest km</dt>
          <dd className="font-medium tabular-nums">{(steepest.gradient * 100).toFixed(1)}%</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        The strip along the bottom is gradient, dark for steep — a profile drawn to a compressed axis always looks
        gentler than the road feels · the hardest kilometre starts at {steepest.at.toFixed(1)} km at{" "}
        {(steepest.gradient * 100).toFixed(1)}%, against a {(average * 100).toFixed(1)}% average that appears on every
        sign at the bottom
      </p>
    </div>
  )
}
