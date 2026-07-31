/**
 * Transport-planning primitives — reachability, mode share, stop-level
 * loading, dwell, fare response, accessibility and kerbside occupancy.
 *
 * Load, cumulative reach, elasticity, effective occupancy and turnover are all
 * DERIVED from the raw counts. Monochrome: bands are distinguished by fill
 * weight and hatch, never hue; every threshold carries a written value.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * IsochroneRings — population reachable within each travel-time band.
 * Marginal gain per band is computed, not supplied.
 * ------------------------------------------------------------------ */
export function IsochroneRings({
  bands,
  size = 190,
  className = "",
}: {
  /** ordered outward; population is the count reachable WITHIN that time */
  bands: { minutes: number; population: number }[]
  size?: number
  className?: string
}) {
  const sorted = [...bands].sort((a, b) => a.minutes - b.minutes)
  const maxT = Math.max(1, sorted[sorted.length - 1]?.minutes ?? 1)
  const total = sorted[sorted.length - 1]?.population ?? 0
  const marginal = sorted.map((b, i) => b.population - (sorted[i - 1]?.population ?? 0))

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          {[...sorted].reverse().map((b, ri) => {
            const i = sorted.length - 1 - ri
            const r = (b.minutes / maxT) * 100
            return (
              <span
                key={b.minutes}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/45"
                style={{
                  width: `${r}%`,
                  height: `${r}%`,
                  background: `color-mix(in oklch, currentColor ${(8 + (1 - i / Math.max(1, sorted.length - 1)) * 26).toFixed(1)}%, transparent)`,
                }}
              />
            )
          })}
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
          {sorted.map((b) => (
            <span
              key={b.minutes}
              className="absolute left-1/2 -translate-x-1/2 bg-background px-1 text-[9px] tabular-nums text-muted-foreground"
              style={{ top: `${50 - (b.minutes / maxT) * 50}%` }}
            >
              {b.minutes}′
            </span>
          ))}
        </div>
        <ul className="flex-1 space-y-1 text-[11px]">
          {sorted.map((b, i) => (
            <li key={b.minutes}>
              <div className="flex items-baseline justify-between">
                <span>within {b.minutes} min</span>
                <span className="tabular-nums font-medium">{b.population.toLocaleString()}</span>
              </div>
              <div className="mt-0.5 h-1.5 rounded-[1px] bg-muted">
                <div
                  className="h-full rounded-[1px] bg-foreground"
                  style={{ width: `${(b.population / Math.max(total, 1)) * 100}%` }}
                />
              </div>
              <span className="text-[9px] tabular-nums text-muted-foreground">
                +{marginal[i].toLocaleString()} in this band
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ModalSplit — mode share now versus a target, with the shift required
 * per mode derived.
 * ------------------------------------------------------------------ */
export function ModalSplit({
  modes,
  className = "",
}: {
  modes: { name: string; current: number; target?: number }[]
  className?: string
}) {
  const sum = modes.reduce((a, m) => a + m.current, 0) || 1
  const rows = modes.map((m) => ({
    ...m,
    share: (m.current / sum) * 100,
    gap: m.target === undefined ? null : m.target - (m.current / sum) * 100,
  }))
  const hatches = [
    "none",
    "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)",
    "repeating-linear-gradient(-45deg, currentColor 0 1.5px, transparent 1.5px 5px)",
    "repeating-linear-gradient(90deg, currentColor 0 1.5px, transparent 1.5px 5px)",
    "repeating-linear-gradient(0deg, currentColor 0 1.5px, transparent 1.5px 5px)",
  ]

  return (
    <div className={className}>
      <div className="flex h-7 w-full overflow-hidden rounded-[3px] border border-foreground/30">
        {rows.map((r, i) => (
          <div
            key={r.name}
            className="relative border-r border-foreground/25 last:border-r-0"
            style={{
              width: `${r.share}%`,
              background: i === 0 ? "color-mix(in oklch, currentColor 34%, transparent)" : hatches[i % hatches.length],
            }}
            title={`${r.name} ${r.share.toFixed(1)}%`}
          />
        ))}
      </div>
      <ul className="mt-2 space-y-1 text-[11px]">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-[2px] border border-foreground/40"
              style={{
                background: i === 0 ? "color-mix(in oklch, currentColor 34%, transparent)" : hatches[i % hatches.length],
              }}
              aria-hidden
            />
            <span className="flex-1 truncate">{r.name}</span>
            <span className="w-12 text-right tabular-nums font-medium">{r.share.toFixed(1)}%</span>
            {r.gap !== null && (
              <span className="w-20 text-right text-[10px] tabular-nums text-muted-foreground">
                <span aria-hidden>{r.gap >= 0 ? "↑" : "↓"}</span> {Math.abs(r.gap).toFixed(1)} to target
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {sum.toLocaleString()} trips
        {rows.some((r) => r.gap !== null)
          ? ` · ${rows
              .filter((r) => (r.gap ?? 0) > 0)
              .reduce((a, r) => a + (r.gap ?? 0), 0)
              .toFixed(1)} points must move to hit every target`
          : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * BoardingAlighting — per-stop ons and offs with the running load
 * derived, so the peak-load point is visible rather than asserted.
 * ------------------------------------------------------------------ */
export function BoardingAlighting({
  stops,
  capacity,
  height = 180,
  className = "",
}: {
  stops: { name: string; on: number; off: number }[]
  capacity?: number
  height?: number
  className?: string
}) {
  const load = stops.reduce<number[]>((acc, s) => {
    const prev = acc[acc.length - 1] ?? 0
    return [...acc, Math.max(0, prev + s.on - s.off)]
  }, [])
  const peak = Math.max(...load, 1)
  const peakAt = load.indexOf(Math.max(...load))
  const flowMax = Math.max(1, ...stops.map((s) => Math.max(s.on, s.off)))
  const top = Math.max(peak, capacity ?? 0)

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polygon
            points={`0,100 ${load.map((v, i) => `${(i / Math.max(1, load.length - 1)) * 100},${100 - (v / top) * 100}`).join(" ")} 100,100`}
            fill="currentColor"
            opacity={0.13}
          />
          {capacity !== undefined && (
            <line
              x1={0}
              y1={100 - (capacity / top) * 100}
              x2={100}
              y2={100 - (capacity / top) * 100}
              stroke="currentColor"
              strokeWidth={0.5}
              strokeDasharray="3 2"
              opacity={0.6}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-end gap-px">
          {stops.map((s, i) => (
            <div key={s.name} className="flex flex-1 flex-col justify-end" style={{ height: "100%" }}>
              <div className="flex h-1/2 flex-col justify-end">
                <div
                  className="w-full rounded-t-[1px] bg-foreground/70"
                  style={{ height: `${(s.on / flowMax) * 100}%` }}
                  title={`${s.name}: ${s.on} on`}
                />
              </div>
              <div className="h-px w-full bg-foreground/30" />
              <div className="h-1/2">
                <div
                  className="w-full rounded-b-[1px] border-x border-b border-foreground/50"
                  style={{
                    height: `${(s.off / flowMax) * 100}%`,
                    background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 4px)",
                  }}
                  title={`${s.name}: ${s.off} off`}
                />
              </div>
              {i === peakAt && <span className="pointer-events-none absolute inset-y-0 w-px bg-foreground/50" />}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex gap-px">
        {stops.map((s) => (
          <span
            key={s.name}
            className="flex-1 truncate text-center text-[8px] text-muted-foreground"
            style={{ writingMode: stops.length > 10 ? "vertical-rl" : undefined }}
          >
            {s.name}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Solid up = boardings, hatched down = alightings, shaded area = load · peak {peak} after{" "}
        {stops[peakAt]?.name}
        {capacity !== undefined
          ? peak > capacity
            ? ` — ${peak - capacity} over the ${capacity} seated capacity`
            : ` — ${((peak / capacity) * 100).toFixed(0)}% of ${capacity} capacity`
          : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DwellTime — dwell decomposed into door cycle and passenger service,
 * with the boarding rate regressed out of the observations.
 * ------------------------------------------------------------------ */
export function DwellTime({
  observations,
  height = 170,
  className = "",
}: {
  /** one row per observed stop event */
  observations: { passengers: number; seconds: number }[]
  height?: number
  className?: string
}) {
  const n = observations.length || 1
  const mx = observations.reduce((a, o) => a + o.passengers, 0) / n
  const my = observations.reduce((a, o) => a + o.seconds, 0) / n
  const num = observations.reduce((a, o) => a + (o.passengers - mx) * (o.seconds - my), 0)
  const den = observations.reduce((a, o) => a + (o.passengers - mx) ** 2, 0)
  const perPax = den === 0 ? 0 : num / den
  const fixed = my - perPax * mx

  const ssTot = observations.reduce((a, o) => a + (o.seconds - my) ** 2, 0)
  const ssRes = observations.reduce((a, o) => a + (o.seconds - (fixed + perPax * o.passengers)) ** 2, 0)
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot

  const maxP = Math.max(1, ...observations.map((o) => o.passengers))
  const maxS = Math.max(1, ...observations.map((o) => o.seconds), fixed + perPax * maxP)

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line
            x1={0}
            y1={100 - (fixed / maxS) * 100}
            x2={100}
            y2={100 - ((fixed + perPax * maxP) / maxS) * 100}
            stroke="currentColor"
            strokeWidth={0.6}
            opacity={0.7}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0">
          {observations.map((o, i) => (
            <span
              key={i}
              className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/70"
              style={{ left: `${(o.passengers / maxP) * 100}%`, top: `${100 - (o.seconds / maxS) * 100}%` }}
              title={`${o.passengers} pax, ${o.seconds}s`}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 passengers</span>
        <span>{maxP}</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Fixed dwell</dt>
          <dd className="font-medium tabular-nums">{fixed.toFixed(1)}s</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Per passenger</dt>
          <dd className="font-medium tabular-nums">{perPax.toFixed(2)}s</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fit R²</dt>
          <dd className="font-medium tabular-nums">{r2.toFixed(2)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Door cycle costs {fixed.toFixed(1)}s before anyone moves — {(fixed / Math.max(my, 1e-9) * 100).toFixed(0)}% of the
        average {my.toFixed(0)}s dwell
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * FareElasticity — ridership and revenue against fare. The
 * revenue-maximising fare and the arc elasticity are SOLVED.
 * ------------------------------------------------------------------ */
export function FareElasticity({
  points,
  currentFare,
  height = 180,
  className = "",
}: {
  points: { fare: number; riders: number }[]
  currentFare?: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!points.length) return null

  const sorted = [...points].sort((a, b) => a.fare - b.fare)
  const rev = sorted.map((p) => p.fare * p.riders)
  const bestIdx = rev.indexOf(Math.max(...rev))
  const maxFare = Math.max(...sorted.map((p) => p.fare))
  const minFare = Math.min(...sorted.map((p) => p.fare))
  const maxRiders = Math.max(1, ...sorted.map((p) => p.riders))
  const maxRev = Math.max(1, ...rev)

  const cur = currentFare ?? sorted[Math.floor(sorted.length / 2)]?.fare ?? minFare
  const ci = sorted.reduce((best, p, i) => (Math.abs(p.fare - cur) < Math.abs(sorted[best].fare - cur) ? i : best), 0)
  const a = sorted[Math.max(0, ci - 1)]
  const b = sorted[Math.min(sorted.length - 1, ci + 1)]
  const arcE =
    a === b
      ? 0
      : ((b.riders - a.riders) / ((b.riders + a.riders) / 2)) / ((b.fare - a.fare) / ((b.fare + a.fare) / 2))

  const px = (f: number) => ((f - minFare) / Math.max(1e-9, maxFare - minFare)) * 100

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon
            points={`0,100 ${sorted.map((p, i) => `${px(p.fare)},${100 - (rev[i] / maxRev) * 96}`).join(" ")} 100,100`}
            fill="currentColor"
            opacity={0.13}
          />
          <polyline
            points={sorted.map((p) => `${px(p.fare)},${100 - (p.riders / maxRiders) * 96}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={sorted.map((p, i) => `${px(p.fare)},${100 - (rev[i] / maxRev) * 96}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="4 2"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={px(sorted[bestIdx].fare)}
            y1={0}
            x2={px(sorted[bestIdx].fare)}
            y2={100}
            stroke="currentColor"
            strokeWidth={0.4}
            strokeDasharray="2 2"
            opacity={0.5}
          />
        </svg>
        {currentFare !== undefined && (
          <span
            className="absolute inset-y-0 w-px bg-foreground/60"
            style={{ left: `${px(currentFare)}%` }}
            aria-hidden
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>${minFare.toFixed(2)}</span>
        <span>${maxFare.toFixed(2)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
        <span className="flex items-center gap-1.5">
          <svg width={18} height={6} aria-hidden>
            <line x1={0} y1={3} x2={18} y2={3} stroke="currentColor" strokeWidth={1.4} />
          </svg>
          riders
        </span>
        <span className="flex items-center gap-1.5">
          <svg width={18} height={6} aria-hidden>
            <line x1={0} y1={3} x2={18} y2={3} stroke="currentColor" strokeWidth={1.4} strokeDasharray="4 2" />
          </svg>
          revenue
        </span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Revenue peaks at ${sorted[bestIdx].fare.toFixed(2)} · arc elasticity near ${cur.toFixed(2)} is{" "}
        {arcE.toFixed(2)} — {Math.abs(arcE) < 1 ? "inelastic, a rise raises revenue" : "elastic, a rise loses revenue"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AccessibilityLadder — the chain of steps between street and vehicle.
 * A single missing step breaks the journey, and that is what is reported.
 * ------------------------------------------------------------------ */
export function AccessibilityLadder({
  stations,
  steps,
  className = "",
}: {
  stations: string[]
  /** steps[stationIndex][stepIndex] — true when that link is provided */
  steps: { name: string; provided: boolean[] }[]
  className?: string
}) {
  const usable = stations.map((_, si) => steps.every((s) => s.provided[si]))
  const broken = stations.map((_, si) => steps.filter((s) => !s.provided[si]).map((s) => s.name))
  const count = usable.filter(Boolean).length

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr>
              <th className="pb-1 text-left font-normal text-muted-foreground">step</th>
              {stations.map((s) => (
                <th key={s} className="px-0.5 pb-1 text-center font-medium">
                  <span className="block max-w-[3.5rem] truncate">{s}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.name}>
                <th className="py-px pr-2 text-left font-normal">{step.name}</th>
                {stations.map((s, si) => (
                  <td key={s} className="p-px">
                    <div
                      className="flex h-5 items-center justify-center rounded-[2px] border border-foreground/25 text-[9px]"
                      style={{
                        background: step.provided[si] ? "color-mix(in oklch, currentColor 26%, transparent)" : "transparent",
                      }}
                    >
                      <span aria-hidden>{step.provided[si] ? "✓" : "✗"}</span>
                      <span className="sr-only">{step.provided[si] ? "provided" : "missing"}</span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th className="pt-1 pr-2 text-left font-medium">step-free</th>
              {stations.map((s, si) => (
                <td key={s} className="p-px pt-1 text-center">
                  <span className="text-[11px] font-medium" aria-hidden>
                    {usable[si] ? "●" : "○"}
                  </span>
                  <span className="sr-only">{usable[si] ? "usable end to end" : "not usable"}</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {count} of {stations.length} usable end to end
        {broken.some((b) => b.length === 1)
          ? ` · ${broken.filter((b) => b.length === 1).length} fail on a single missing step`
          : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ParkingOccupancy — occupancy across the day per block, with turnover
 * and the practical-capacity threshold derived.
 * ------------------------------------------------------------------ */
export function ParkingOccupancy({
  blocks,
  hours,
  practicalCapacity = 0.85,
  className = "",
}: {
  blocks: { name: string; spaces: number; occupied: number[] }[]
  hours: string[]
  /** the occupancy above which drivers start circling */
  practicalCapacity?: number
  className?: string
}) {
  const rows = blocks.map((b) => {
    const occ = b.occupied.map((o) => clamp(o / Math.max(1, b.spaces), 0, 1.2))
    const overHours = occ.filter((o) => o >= practicalCapacity).length
    return { ...b, occ, overHours, peak: Math.max(...occ) }
  })
  const cityOver = rows.reduce((a, r) => a + r.overHours, 0)

  return (
    <div className={className}>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.spaces} spaces · peak {(r.peak * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-0.5 flex h-5 gap-px">
              {r.occ.map((o, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-[1px]"
                  style={{
                    background:
                      o >= practicalCapacity
                        ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)"
                        : `color-mix(in oklch, currentColor ${(o * 60).toFixed(1)}%, transparent)`,
                    outline: o >= practicalCapacity ? "1px solid currentColor" : undefined,
                    outlineOffset: -1,
                  }}
                  title={`${hours[i]}: ${(o * 100).toFixed(0)}%`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-px text-[9px] text-muted-foreground">
        {hours.map((h, i) => (
          <span key={h} className="flex-1 text-center">
            {i % 2 === 0 ? h : ""}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched hours are at or above {(practicalCapacity * 100).toFixed(0)}% practical capacity — {cityOver} block-hours
        of circling across {blocks.length} blocks
      </p>
    </div>
  )
}
