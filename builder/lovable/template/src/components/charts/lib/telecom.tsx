/**
 * Telecommunications primitives — link budget, spectrum, handover, jitter
 * buffer, blocking probability and fibre traces.
 *
 * The margin, the guard bands, the ping-pong count, the loss-versus-latency
 * trade, the Erlang B blocking probability and the total fibre loss are all
 * DERIVED from the inputs. A caller cannot state a margin the budget refuses.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * LinkBudget — gains and losses accumulated to a received power, with
 * the margin over sensitivity computed at the end.
 * ------------------------------------------------------------------ */
export function LinkBudget({
  transmitDbm,
  elements,
  sensitivityDbm,
  height = 200,
  className = "",
}: {
  transmitDbm: number
  /** positive is gain, negative is loss */
  elements: { name: string; db: number }[]
  sensitivityDbm: number
  height?: number
  className?: string
}) {
  let level = transmitDbm
  const steps = [{ name: "Transmit power", db: 0, from: transmitDbm, to: transmitDbm }]
  elements.forEach((e) => {
    const from = level
    level += e.db
    steps.push({ name: e.name, db: e.db, from, to: level })
  })
  const received = level
  const margin = received - sensitivityDbm

  const lo = Math.min(sensitivityDbm, ...steps.map((s) => s.to)) - 6
  const hi = Math.max(transmitDbm, ...steps.map((s) => s.from)) + 4
  const py = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100
  const worst = elements.reduce((a, e) => (e.db < a.db ? e : a), elements[0] ?? { name: "—", db: 0 })

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex items-stretch gap-1">
          {steps.map((s, i) => (
            <div key={`${s.name}-${i}`} className="relative h-full flex-1" title={`${s.name}: ${s.db >= 0 ? "+" : ""}${s.db} dB → ${s.to.toFixed(1)} dBm`}>
              <div
                className="absolute right-0 left-0 rounded-[1px]"
                style={{
                  top: `${Math.min(py(s.from), py(s.to))}%`,
                  height: `${Math.max(1.5, Math.abs(py(s.to) - py(s.from)))}%`,
                  background:
                    i === 0
                      ? "currentColor"
                      : s.db >= 0
                        ? "color-mix(in oklch, currentColor 55%, transparent)"
                        : "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: i > 0 && s.db < 0 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
              />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground" style={{ top: `${py(sensitivityDbm)}%` }} />
        <span className="pointer-events-none absolute right-0 -translate-y-full bg-background px-1 text-[9px] text-muted-foreground" style={{ top: `${py(sensitivityDbm)}%` }}>
          sensitivity {sensitivityDbm} dBm
        </span>
      </div>
      <div className="mt-1 flex gap-1">
        {steps.map((s, i) => (
          <span key={`${s.name}-${i}`} className="flex-1 truncate text-center text-[8px] text-muted-foreground" title={s.name}>
            {s.name}
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Received</dt>
          <dd className="font-medium tabular-nums">{received.toFixed(1)} dBm</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Margin</dt>
          <dd className="font-medium tabular-nums">{margin.toFixed(1)} dB</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Largest loss</dt>
          <dd className="font-medium tabular-nums">
            {worst.name} {worst.db.toFixed(1)}
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Hatched steps are losses, pale are gains ·{" "}
        {margin < 0
          ? "the link does not close — received power is below sensitivity"
          : margin < 6
            ? `${margin.toFixed(1)} dB is thin; rain and ageing eat that in a season`
            : `${margin.toFixed(1)} dB of headroom over sensitivity`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SpectrumAllocation — assignments across a band. Guard bands and
 * overlaps are FOUND, not declared.
 * ------------------------------------------------------------------ */
export function SpectrumAllocation({
  bandLowMhz,
  bandHighMhz,
  assignments,
  className = "",
}: {
  bandLowMhz: number
  bandHighMhz: number
  assignments: { holder: string; fromMhz: number; toMhz: number; service?: string }[]
  className?: string
}) {
  const span = Math.max(1e-9, bandHighMhz - bandLowMhz)
  const sorted = [...assignments].sort((a, b) => a.fromMhz - b.fromMhz)
  const px = (m: number) => ((m - bandLowMhz) / span) * 100

  const gaps: { from: number; to: number }[] = []
  const overlaps: { a: string; b: string; mhz: number }[] = []
  let cursor = bandLowMhz
  sorted.forEach((s, i) => {
    if (s.fromMhz > cursor) gaps.push({ from: cursor, to: s.fromMhz })
    const prev = sorted[i - 1]
    if (prev && s.fromMhz < prev.toMhz) overlaps.push({ a: prev.holder, b: s.holder, mhz: prev.toMhz - s.fromMhz })
    cursor = Math.max(cursor, s.toMhz)
  })
  if (cursor < bandHighMhz) gaps.push({ from: cursor, to: bandHighMhz })
  const allocated = sorted.reduce((a, s) => a + (s.toMhz - s.fromMhz), 0)

  const hatches = [
    "color-mix(in oklch, currentColor 34%, transparent)",
    "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)",
    "repeating-linear-gradient(-45deg, currentColor 0 1.5px, transparent 1.5px 5px)",
    "repeating-linear-gradient(90deg, currentColor 0 1.5px, transparent 1.5px 5px)",
  ]

  return (
    <div className={className}>
      <div className="relative h-9 rounded-[3px] border border-foreground/30 bg-muted">
        {sorted.map((s, i) => (
          <div
            key={`${s.holder}-${s.fromMhz}`}
            className="absolute inset-y-0 border-x border-foreground/40"
            style={{ left: `${px(s.fromMhz)}%`, width: `${Math.max(0.6, px(s.toMhz) - px(s.fromMhz))}%`, background: hatches[i % hatches.length] }}
            title={`${s.holder} ${s.fromMhz}–${s.toMhz} MHz`}
          />
        ))}
        {gaps.map((g, i) => (
          <span
            key={`gap-${i}`}
            className="absolute inset-y-0 flex items-center justify-center text-[8px] text-muted-foreground"
            style={{ left: `${px(g.from)}%`, width: `${px(g.to) - px(g.from)}%` }}
          >
            {px(g.to) - px(g.from) > 5 ? `${(g.to - g.from).toFixed(0)}` : ""}
          </span>
        ))}
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] text-muted-foreground tabular-nums">
        <span>{bandLowMhz} MHz</span>
        <span>{bandHighMhz} MHz</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px]">
        {sorted.map((s, i) => (
          <li key={`${s.holder}-${s.fromMhz}`} className="flex items-center gap-2 tabular-nums">
            <span className="h-3 w-3 shrink-0 rounded-[2px] border border-foreground/40" style={{ background: hatches[i % hatches.length] }} aria-hidden />
            <span className="w-28 shrink-0 truncate">{s.holder}</span>
            <span className="text-muted-foreground">
              {s.fromMhz}–{s.toMhz} MHz ({(s.toMhz - s.fromMhz).toFixed(0)} MHz)
              {s.service ? ` · ${s.service}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10px] text-muted-foreground tabular-nums">
        {((allocated / span) * 100).toFixed(0)}% of the band assigned · {gaps.length} unassigned gap
        {gaps.length === 1 ? "" : "s"} totalling {gaps.reduce((a, g) => a + (g.to - g.from), 0).toFixed(0)} MHz
        {overlaps.length ? ` · ${overlaps.length} OVERLAP — ${overlaps.map((o) => `${o.a}/${o.b} by ${o.mhz.toFixed(0)} MHz`).join(", ")}` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CellHandover — signal from each cell along a route, with the serving
 * cell and every handover DERIVED from the strongest signal plus the
 * hysteresis margin. Ping-pong is counted.
 * ------------------------------------------------------------------ */
export function CellHandover({
  cells,
  hysteresisDb = 3,
  height = 190,
  className = "",
}: {
  /** one signal series per cell, sampled along the route */
  cells: { name: string; rsrp: number[] }[]
  hysteresisDb?: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!cells.length) return null

  const n = Math.min(...cells.map((c) => c.rsrp.length))
  const serving: number[] = []
  for (let i = 0; i < n; i++) {
    const prev = serving[i - 1]
    const best = cells.reduce((a, c, ci) => (c.rsrp[i] > cells[a].rsrp[i] ? ci : a), 0)
    // only hand over once the candidate beats the incumbent by the margin —
    // without that the serving cell flaps on every sample of measurement noise
    if (prev === undefined) serving.push(best)
    else serving.push(cells[best].rsrp[i] > cells[prev].rsrp[i] + hysteresisDb ? best : prev)
  }
  const handovers: number[] = []
  for (let i = 1; i < n; i++) if (serving[i] !== serving[i - 1]) handovers.push(i)
  // a ping-pong is a handover back to the cell we just left, within ten samples
  const pingPong = handovers.filter((h, k) => {
    const prevH = handovers[k - 1]
    return prevH !== undefined && h - prevH <= 10 && serving[h] === serving[prevH - 1]
  }).length

  const lo = Math.min(...cells.flatMap((c) => c.rsrp)) - 3
  const hi = Math.max(...cells.flatMap((c) => c.rsrp)) + 3
  const px = (i: number) => (i / Math.max(1, n - 1)) * 100
  const py = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100
  const dashes = ["", "4 2", "1 2", "6 2 1 2"]

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {cells.map((c, ci) => (
            <polyline
              key={c.name}
              points={c.rsrp.slice(0, n).map((v, i) => `${px(i)},${py(v)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray={dashes[ci % dashes.length]}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {handovers.map((h) => (
            <line key={h} x1={px(h)} y1={0} x2={px(h)} y2={100} stroke="currentColor" strokeWidth={0.4} opacity={0.4} />
          ))}
        </svg>
      </div>
      <div className="mt-1 flex h-4 overflow-hidden rounded-[2px]">
        {serving.map((s, i) => (
          <div
            key={i}
            className="min-w-0 flex-1"
            style={{ background: `color-mix(in oklch, currentColor ${18 + (s / Math.max(1, cells.length - 1)) * 62}%, transparent)` }}
            title={`sample ${i}: ${cells[s].name}`}
          />
        ))}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
        {cells.map((c, ci) => (
          <li key={c.name} className="flex items-center gap-1.5">
            <svg width={18} height={6} aria-hidden>
              <line x1={0} y1={3} x2={18} y2={3} stroke="currentColor" strokeWidth={1.4} strokeDasharray={dashes[ci % dashes.length]} />
            </svg>
            {c.name}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {handovers.length} handover{handovers.length === 1 ? "" : "s"} with {hysteresisDb} dB of hysteresis ·{" "}
        {pingPong
          ? `${pingPong} of them bounced straight back — that is the case for widening the margin`
          : "none bounced back, so the margin is holding"}{" "}
        · the strip is the serving cell
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * JitterBuffer — the trade between buffer depth and lost packets, with
 * the knee found rather than named.
 * ------------------------------------------------------------------ */
export function JitterBuffer({
  arrivals,
  height = 190,
  className = "",
}: {
  /** one-way delay per packet, in milliseconds */
  arrivals: number[]
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!arrivals.length) return null

  const sorted = [...arrivals].sort((a, b) => a - b)
  const at = (p: number) => sorted[clamp(Math.floor(p * (sorted.length - 1)), 0, sorted.length - 1)]
  const min = sorted[0]
  const depths = Array.from({ length: 40 }, (_, i) => {
    const depth = (i / 39) * (at(0.999) - min)
    const late = arrivals.filter((a) => a - min > depth).length
    return { depth, loss: (late / arrivals.length) * 100, added: depth }
  })
  // the knee: the smallest depth that keeps loss under 1%, which is the
  // conventional ceiling for intelligible speech
  const knee = depths.find((d) => d.loss <= 1) ?? depths[depths.length - 1]
  const maxDepth = depths[depths.length - 1].depth || 1
  const px = (d: number) => (d / maxDepth) * 100
  // log axis: loss falls by orders of magnitude and the interesting part is
  // entirely below 5%, which a linear axis flattens onto the baseline
  const lossLo = 0.01
  const py = (l: number) => {
    const v = Math.max(lossLo, l)
    return ((Math.log10(depths[0].loss || 100) - Math.log10(v)) / (Math.log10(depths[0].loss || 100) - Math.log10(lossLo))) * 94 + 3
  }

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(1)} x2={100} y2={py(1)} stroke="currentColor" strokeWidth={0.4} strokeDasharray="3 2" opacity={0.5} />
          <polygon points={`0,100 ${depths.map((d) => `${px(d.depth)},${py(d.loss)}`).join(" ")} 100,100`} fill="currentColor" opacity={0.12} />
          <polyline points={depths.map((d) => `${px(d.depth)},${py(d.loss)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
          <line x1={px(knee.depth)} y1={0} x2={px(knee.depth)} y2={100} stroke="currentColor" strokeWidth={0.5} opacity={0.6} />
        </svg>
        <span
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground bg-background"
          style={{ left: `${px(knee.depth)}%`, top: `${py(knee.loss)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 ms buffer</span>
        <span>{maxDepth.toFixed(0)} ms</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Median delay</dt>
          <dd className="font-medium tabular-nums">{at(0.5).toFixed(0)} ms</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Jitter (p99−p50)</dt>
          <dd className="font-medium tabular-nums">{(at(0.99) - at(0.5)).toFixed(0)} ms</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Buffer for 1%</dt>
          <dd className="font-medium tabular-nums">{knee.depth.toFixed(0)} ms</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mouth-to-ear</dt>
          <dd className="font-medium tabular-nums">{(at(0.5) + knee.depth).toFixed(0)} ms</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Every millisecond of buffer buys fewer late packets and costs the same millisecond of delay ·{" "}
        {at(0.5) + knee.depth > 150
          ? "past 150 ms mouth-to-ear people start talking over each other, so this call needs the network fixed, not a deeper buffer"
          : "the total stays under the 150 ms where conversation starts to collide"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ErlangBlocking — blocking probability against circuit count, computed
 * by the Erlang B recursion.
 * ------------------------------------------------------------------ */
export function ErlangBlocking({
  offeredErlangs,
  maxCircuits,
  targetGrade = 0.01,
  height = 190,
  className = "",
}: {
  offeredErlangs: number
  maxCircuits: number
  /** the grade of service to size for, e.g. 0.01 = one call in a hundred blocked */
  targetGrade?: number
  height?: number
  className?: string
}) {
  // B(0, A) = 1 ; B(n, A) = A·B(n−1,A) / (n + A·B(n−1,A))
  const series: { circuits: number; blocking: number }[] = []
  let b = 1
  for (let nCirc = 1; nCirc <= maxCircuits; nCirc++) {
    b = (offeredErlangs * b) / (nCirc + offeredErlangs * b)
    series.push({ circuits: nCirc, blocking: b })
  }
  const sized = series.find((s) => s.blocking <= targetGrade)
  const carried = sized ? offeredErlangs * (1 - sized.blocking) : 0
  const efficiency = sized ? carried / sized.circuits : 0

  const px = (c: number) => ((c - 1) / Math.max(1, maxCircuits - 1)) * 100
  const py = (p: number) => {
    const l = Math.log10(Math.max(1e-5, p))
    return ((l - Math.log10(1)) / (Math.log10(1e-5) - Math.log10(1))) * 94 + 3
  }

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(targetGrade)} x2={100} y2={py(targetGrade)} stroke="currentColor" strokeWidth={0.4} strokeDasharray="3 2" opacity={0.55} />
          <polyline points={series.map((s) => `${px(s.circuits)},${py(s.blocking)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
          {sized && <line x1={px(sized.circuits)} y1={0} x2={px(sized.circuits)} y2={100} stroke="currentColor" strokeWidth={0.5} opacity={0.55} />}
        </svg>
        <span className="absolute right-1 -translate-y-full bg-background px-1 text-[9px] text-muted-foreground" style={{ top: `${py(targetGrade)}%` }}>
          target {(targetGrade * 100).toFixed(1)}%
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>1 circuit</span>
        <span>{maxCircuits} circuits</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Offered traffic</dt>
          <dd className="font-medium tabular-nums">{offeredErlangs} E</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Circuits needed</dt>
          <dd className="font-medium tabular-nums">{sized ? sized.circuits : `>${maxCircuits}`}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Utilisation</dt>
          <dd className="font-medium tabular-nums">{(efficiency * 100).toFixed(0)}%</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Log axis, because blocking falls by orders of magnitude ·{" "}
        {sized
          ? `${sized.circuits} circuits carry ${carried.toFixed(1)} E at ${(sized.blocking * 100).toFixed(2)}% blocking — the last few circuits each buy an order of magnitude and sit idle almost always`
          : `${maxCircuits} circuits still block more than the target`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * FibreOtdr — a reflectometer trace with events located and the total
 * loss budget summed from them.
 * ------------------------------------------------------------------ */
export function FibreOtdr({
  lengthKm,
  attenuationDbPerKm,
  events,
  height = 200,
  className = "",
}: {
  lengthKm: number
  attenuationDbPerKm: number
  events: { atKm: number; kind: "splice" | "connector" | "bend" | "break"; lossDb: number }[]
  height?: number
  className?: string
}) {
  const sorted = [...events].sort((a, b) => a.atKm - b.atKm)
  const breakAt = sorted.find((e) => e.kind === "break")
  const usable = breakAt ? breakAt.atKm : lengthKm

  // the trace: linear attenuation with a vertical drop at each event
  const pts: { km: number; db: number }[] = [{ km: 0, db: 0 }]
  let level = 0
  sorted
    .filter((e) => e.atKm <= usable)
    .forEach((e) => {
      level = -(e.atKm * attenuationDbPerKm) - sorted.filter((x) => x.atKm < e.atKm).reduce((a, x) => a + x.lossDb, 0)
      pts.push({ km: e.atKm, db: level })
      pts.push({ km: e.atKm, db: level - e.lossDb })
    })
  const endLoss = usable * attenuationDbPerKm + sorted.filter((e) => e.atKm <= usable).reduce((a, e) => a + e.lossDb, 0)
  pts.push({ km: usable, db: -endLoss })

  const fibreLoss = usable * attenuationDbPerKm
  const eventLoss = endLoss - fibreLoss
  const px = (k: number) => (k / lengthKm) * 100
  const py = (d: number) => (-d / Math.max(1e-9, endLoss * 1.12)) * 100
  const glyph = (k: string) => (k === "break" ? "✕" : k === "connector" ? "◇" : k === "bend" ? "◠" : "|")

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {breakAt && <rect x={px(breakAt.atKm)} y={0} width={100 - px(breakAt.atKm)} height={100} fill="currentColor" opacity={0.07} />}
          <polyline points={pts.map((p) => `${px(p.km)},${py(p.db)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
        </svg>
        {sorted.map((e) => (
          <span key={`${e.atKm}-${e.kind}`} className="absolute inset-y-0" style={{ left: `${px(e.atKm)}%` }}>
            <span className="absolute inset-y-0 w-px bg-foreground/25" aria-hidden />
            <span
              className="absolute top-0 -translate-x-1/2 bg-background px-0.5 text-[10px] text-muted-foreground"
              title={`${e.kind} at ${e.atKm} km, ${e.lossDb} dB`}
            >
              <span aria-hidden>{glyph(e.kind)}</span>
            </span>
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 km</span>
        <span>{lengthKm} km</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {sorted.map((e) => (
          <li key={`${e.atKm}-${e.kind}-row`} className="flex items-center gap-2">
            <span aria-hidden className="w-3">
              {glyph(e.kind)}
            </span>
            <span className="w-16">{e.atKm.toFixed(2)} km</span>
            <span className="w-20 capitalize">{e.kind}</span>
            <span className="text-muted-foreground">{e.kind === "break" ? "trace ends here" : `${e.lossDb.toFixed(2)} dB`}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {endLoss.toFixed(2)} dB total over {usable.toFixed(1)} km — {fibreLoss.toFixed(2)} dB is the fibre itself and{" "}
        {eventLoss.toFixed(2)} dB is the {sorted.filter((e) => e.atKm <= usable && e.kind !== "break").length} joints
        {breakAt ? ` · the fibre is BROKEN at ${breakAt.atKm} km, so everything beyond is dark` : ""}
      </p>
    </div>
  )
}
