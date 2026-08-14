/**
 * Ecology and population-biology primitives — sampling effort, community
 * structure, niche geometry, predator–prey dynamics and capture–recapture.
 *
 * Everything a field ecologist would otherwise compute by hand is DERIVED here:
 * asymptotes, evenness, overlap coefficients, cycle period and phase lag,
 * expected richness at a rarefied depth, and the Lincoln–Petersen estimate with
 * its interval. None of those are accepted as props.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * SpeciesAccumulation — richness against sampling effort, with the
 * asymptote fitted rather than declared.
 * ------------------------------------------------------------------ */
export function SpeciesAccumulation({
  samples,
  height = 170,
  className = "",
}: {
  /** cumulative species count after each sample, in order */
  samples: number[]
  height?: number
  className?: string
}) {
  // NOTHING TO DRAW IS NOT A CHART OF NOTHING. An empty array made every
  // scale here degenerate and wrote NaN into an SVG attribute, which the
  // browser drops — so the chart rendered as a blank box rather than as the
  // empty state the page around it is showing. `useRows` hands back `[]`
  // before the query settles and on every site whose owner has added nothing.
  if (!samples.length) return null

  const n = samples.length
  const observed = samples[n - 1] ?? 0

  // Michaelis–Menten asymptote fitted by linear regression on the
  // Lineweaver–Burk transform: 1/S = (K/Smax)(1/x) + 1/Smax
  const pts = samples.map((s, i) => ({ x: 1 / (i + 1), y: s > 0 ? 1 / s : 0 })).filter((p) => p.y > 0)
  const mx = pts.reduce((a, p) => a + p.x, 0) / Math.max(1, pts.length)
  const my = pts.reduce((a, p) => a + p.y, 0) / Math.max(1, pts.length)
  const num = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0)
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0)
  const slope = den === 0 ? 0 : num / den
  const intercept = my - slope * mx
  const asymptote = intercept > 0 ? 1 / intercept : observed
  const halfSat = intercept > 0 ? slope / intercept : 0

  const top = Math.max(asymptote, observed) * 1.06
  const px = (i: number) => (i / Math.max(1, n - 1)) * 100
  const py = (v: number) => 100 - (v / top) * 100

  const fitted = Array.from({ length: 60 }, (_, k) => {
    const x = 1 + ((n - 1) * k) / 59
    return { x, y: (asymptote * x) / (halfSat + x) }
  })

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line
            x1={0}
            y1={py(asymptote)}
            x2={100}
            y2={py(asymptote)}
            stroke="currentColor"
            strokeWidth={0.4}
            strokeDasharray="3 2"
            opacity={0.5}
          />
          <polyline
            points={fitted.map((p) => `${px(p.x - 1)},${py(p.y)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.7}
            strokeDasharray="2 2"
            opacity={0.55}
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={samples.map((s, i) => `${px(i)},${py(s)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          className="pointer-events-none absolute right-0 -translate-y-1/2 bg-background px-1 text-[9px] text-muted-foreground"
          style={{ top: `${py(asymptote)}%` }}
        >
          est. {asymptote.toFixed(0)}
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>1 sample</span>
        <span>{n} samples</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Observed</dt>
          <dd className="font-medium tabular-nums">{observed}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Estimated total</dt>
          <dd className="font-medium tabular-nums">{asymptote.toFixed(0)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Completeness</dt>
          <dd className="font-medium tabular-nums">{((observed / Math.max(asymptote, 1e-9)) * 100).toFixed(0)}%</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Dashed curve is the fitted Michaelis–Menten accumulation; half the estimated richness arrives by sample{" "}
        {Math.max(1, Math.round(halfSat))}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RankAbundance — a Whittaker plot. Evenness and dominance are computed.
 * ------------------------------------------------------------------ */
export function RankAbundance({
  species,
  height = 170,
  className = "",
}: {
  species: { name: string; count: number }[]
  height?: number
  className?: string
}) {
  const ranked = [...species].filter((s) => s.count > 0).sort((a, b) => b.count - a.count)
  const total = ranked.reduce((a, s) => a + s.count, 0)
  const props = ranked.map((s) => s.count / Math.max(total, 1))
  const shannon = -props.reduce((a, p) => a + (p > 0 ? p * Math.log(p) : 0), 0)
  const evenness = ranked.length > 1 ? shannon / Math.log(ranked.length) : 1
  const simpson = 1 - props.reduce((a, p) => a + p * p, 0)

  const logMax = Math.log10(Math.max(1, ranked[0]?.count ?? 1))
  const logMin = Math.log10(Math.max(0.5, ranked[ranked.length - 1]?.count ?? 1))
  const range = Math.max(0.3, logMax - logMin)
  const py = (c: number) => 100 - ((Math.log10(Math.max(0.5, c)) - logMin) / range) * 94 - 3
  const px = (i: number) => (i / Math.max(1, ranked.length - 1)) * 100

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline
            points={ranked.map((s, i) => `${px(i)},${py(s.count)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0">
          {ranked.map((s, i) => (
            <span
              key={s.name}
              className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
              style={{ left: `${px(i)}%`, top: `${py(s.count)}%` }}
              title={`${s.name}: ${s.count}`}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span className="truncate">{ranked[0]?.name}</span>
        <span className="truncate">{ranked[ranked.length - 1]?.name}</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Shannon H′</dt>
          <dd className="font-medium tabular-nums">{shannon.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Evenness J′</dt>
          <dd className="font-medium tabular-nums">{evenness.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Simpson 1−D</dt>
          <dd className="font-medium tabular-nums">{simpson.toFixed(2)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Log abundance against rank · the most abundant species is {((props[0] ?? 0) * 100).toFixed(0)}% of{" "}
        {total.toLocaleString()} individuals
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * NicheOverlap — resource-use curves per species, with pairwise
 * Pianka overlap computed from the curves themselves.
 * ------------------------------------------------------------------ */
export function NicheOverlap({
  axis,
  species,
  height = 150,
  className = "",
}: {
  /** resource axis labels, e.g. seed sizes */
  axis: string[]
  /** utilisation per species along the axis; need not be normalised */
  species: { name: string; use: number[] }[]
  height?: number
  className?: string
}) {
  const norm = species.map((s) => {
    const t = s.use.reduce((a, v) => a + v, 0) || 1
    return { name: s.name, p: s.use.map((v) => v / t) }
  })
  const max = Math.max(1e-9, ...norm.flatMap((s) => s.p))

  const pianka = (a: number[], b: number[]) => {
    const num = a.reduce((acc, v, i) => acc + v * (b[i] ?? 0), 0)
    const den = Math.sqrt(a.reduce((acc, v) => acc + v * v, 0) * b.reduce((acc, v) => acc + v * v, 0))
    return den === 0 ? 0 : num / den
  }

  const pairs: { a: string; b: string; o: number }[] = []
  for (let i = 0; i < norm.length; i++)
    for (let j = i + 1; j < norm.length; j++) pairs.push({ a: norm[i].name, b: norm[j].name, o: pianka(norm[i].p, norm[j].p) })

  const px = (i: number) => (i / Math.max(1, axis.length - 1)) * 100
  const py = (v: number) => 100 - (v / max) * 92 - 4
  const dashes = ["", "4 2", "1 2", "6 2 1 2"]

  return (
    <div className={className}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
        {norm.map((s, si) => (
          <g key={s.name}>
            <polygon
              points={`0,100 ${s.p.map((v, i) => `${px(i)},${py(v)}`).join(" ")} 100,100`}
              fill="currentColor"
              opacity={0.08}
            />
            <polyline
              points={s.p.map((v, i) => `${px(i)},${py(v)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray={dashes[si % dashes.length]}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
        {axis.map((a) => (
          <span key={a} className="flex-1 truncate text-center">
            {a}
          </span>
        ))}
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px]">
        {norm.map((s, si) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <svg width={18} height={6} aria-hidden>
              <line
                x1={0}
                y1={3}
                x2={18}
                y2={3}
                stroke="currentColor"
                strokeWidth={1.2}
                strokeDasharray={dashes[si % dashes.length]}
              />
            </svg>
            <span>{s.name}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground tabular-nums">
        {pairs.map((p) => (
          <li key={`${p.a}|${p.b}`}>
            {p.a} × {p.b}: overlap {p.o.toFixed(2)}
            {p.o > 0.6 ? " — strong competition" : p.o < 0.3 ? " — largely partitioned" : ""}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PopulationCycle — predator and prey through time. The period and the
 * predator's phase lag are MEASURED off the series.
 * ------------------------------------------------------------------ */
export function PopulationCycle({
  prey,
  predator,
  labels,
  height = 170,
  className = "",
}: {
  prey: number[]
  predator: number[]
  labels?: string[]
  height?: number
  className?: string
}) {
  const n = Math.min(prey.length, predator.length)
  const peaks = (xs: number[]) => {
    const out: number[] = []
    for (let i = 1; i < xs.length - 1; i++) if (xs[i] > xs[i - 1] && xs[i] >= xs[i + 1]) out.push(i)
    return out
  }
  const preyPeaks = peaks(prey)
  const predPeaks = peaks(predator)
  const period =
    preyPeaks.length > 1
      ? (preyPeaks[preyPeaks.length - 1] - preyPeaks[0]) / (preyPeaks.length - 1)
      : 0
  const lags = preyPeaks
    .map((p) => {
      const after = predPeaks.filter((q) => q > p)
      return after.length ? after[0] - p : null
    })
    .filter((v): v is number => v !== null)
  const lag = lags.length ? lags.reduce((a, v) => a + v, 0) / lags.length : 0

  const preyMax = Math.max(1e-9, ...prey)
  const predMax = Math.max(1e-9, ...predator)
  const px = (i: number) => (i / Math.max(1, n - 1)) * 100
  const line = (xs: number[], m: number) => xs.slice(0, n).map((v, i) => `${px(i)},${100 - (v / m) * 92 - 4}`).join(" ")

  return (
    <div className={className}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
        <polygon points={`0,100 ${line(prey, preyMax)} 100,100`} fill="currentColor" opacity={0.12} />
        <polyline points={line(prey, preyMax)} fill="none" stroke="currentColor" strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
        <polyline
          points={line(predator, predMax)}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.1}
          strokeDasharray="4 2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {labels && (
        <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
        <span className="flex items-center gap-1.5">
          <svg width={18} height={6} aria-hidden>
            <line x1={0} y1={3} x2={18} y2={3} stroke="currentColor" strokeWidth={1.4} />
          </svg>
          prey (peak {Math.round(preyMax).toLocaleString()})
        </span>
        <span className="flex items-center gap-1.5">
          <svg width={18} height={6} aria-hidden>
            <line x1={0} y1={3} x2={18} y2={3} stroke="currentColor" strokeWidth={1.4} strokeDasharray="4 2" />
          </svg>
          predator (peak {Math.round(predMax).toLocaleString()})
        </span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {period > 0 ? `Cycle ≈ ${period.toFixed(1)} periods` : "No repeating cycle detected"}
        {lag > 0 ? ` · predator peaks ${lag.toFixed(1)} periods behind prey` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Rarefaction — expected richness at any sampling depth, computed by
 * the Hurlbert formula from the abundance vector alone.
 * ------------------------------------------------------------------ */
export function Rarefaction({
  abundances,
  compareAt,
  height = 170,
  className = "",
}: {
  abundances: number[]
  /** optional depth to read the curve at; defaults to half the total */
  compareAt?: number
  height?: number
  className?: string
}) {
  // NOTHING TO DRAW IS NOT A CHART OF NOTHING. An empty array made every
  // scale here degenerate and wrote NaN into an SVG attribute, which the
  // browser drops — so the chart rendered as a blank box rather than as the
  // empty state the page around it is showing. `useRows` hands back `[]`
  // before the query settles and on every site whose owner has added nothing.
  if (!abundances.length) return null

  const N = abundances.reduce((a, v) => a + v, 0)
  // E[S_n] = S − Σ_i C(N−N_i, n) / C(N, n), computed in log space for stability
  const lnFact: number[] = [0]
  for (let i = 1; i <= N; i++) lnFact[i] = lnFact[i - 1] + Math.log(i)
  const lnC = (a: number, b: number) => (b < 0 || b > a ? -Infinity : lnFact[a] - lnFact[b] - lnFact[a - b])
  const expected = (n: number) =>
    abundances.reduce((acc, ni) => {
      const l = lnC(N - ni, n) - lnC(N, n)
      return acc + (l === -Infinity ? 0 : Math.exp(l))
    }, 0)
  const S = abundances.filter((v) => v > 0).length

  const steps = 48
  const curve = Array.from({ length: steps + 1 }, (_, k) => {
    const n = Math.max(1, Math.round((N * k) / steps))
    return { n, s: S - expected(n) }
  })
  const at = clamp(compareAt ?? Math.round(N / 2), 1, N)
  const atS = S - expected(at)

  const px = (n: number) => (n / N) * 100
  const py = (s: number) => 100 - (s / Math.max(S, 1)) * 92 - 4

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(S)} x2={100} y2={py(S)} stroke="currentColor" strokeWidth={0.4} strokeDasharray="3 2" opacity={0.45} />
          <line x1={px(at)} y1={0} x2={px(at)} y2={100} stroke="currentColor" strokeWidth={0.4} strokeDasharray="2 2" opacity={0.45} />
          <polyline
            points={curve.map((p) => `${px(p.n)},${py(p.s)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground bg-background"
          style={{ left: `${px(at)}%`, top: `${py(atS)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0</span>
        <span>{N.toLocaleString()} individuals</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Species found</dt>
          <dd className="font-medium tabular-nums">{S}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">At n = {at}</dt>
          <dd className="font-medium tabular-nums">{atS.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Marginal</dt>
          <dd className="font-medium tabular-nums">
            {(S - (S - expected(Math.max(1, N - 1)))).toFixed(3)}/ind
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Expected richness if only n individuals had been counted — the honest way to compare samples of different size
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * MarkRecapture — Lincoln–Petersen with the Chapman correction and a
 * normal-approximation interval, all derived from the three counts.
 * ------------------------------------------------------------------ */
export function MarkRecapture({
  marked,
  captured,
  recaptured,
  height = 120,
  className = "",
}: {
  /** individuals marked and released in the first session */
  marked: number
  /** individuals caught in the second session */
  captured: number
  /** of those, how many carried a mark */
  recaptured: number
  height?: number
  className?: string
}) {
  const chapman = ((marked + 1) * (captured + 1)) / (recaptured + 1) - 1
  const variance =
    ((marked + 1) * (captured + 1) * (marked - recaptured) * (captured - recaptured)) /
    ((recaptured + 1) ** 2 * (recaptured + 2))
  const se = Math.sqrt(Math.max(0, variance))
  const lo = Math.max(captured, chapman - 1.96 * se)
  const hi = chapman + 1.96 * se
  const markedFraction = recaptured / Math.max(1, captured)

  // A square has to be big enough to read AS a square. 400 cells inside 120px is
  // a grey slab, so the grid is sized to a legible cell and the scale is stated
  // whenever one square stands for more than one animal.
  const cols = 24
  const rows = Math.max(2, Math.min(8, Math.round(height / 14)))
  const cells = cols * rows
  const population = Math.max(1, Math.round(chapman))
  const perCell = population / cells
  const markedCells = Math.round(marked / perCell)

  return (
    <div className={className}>
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, height: rows * 12 }}
      >
        {Array.from({ length: cells }, (_, i) => (
          <span
            key={i}
            className="rounded-[1px] border border-foreground/25"
            style={{
              background: i < markedCells ? "currentColor" : "color-mix(in oklch, currentColor 10%, transparent)",
            }}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        {cells} squares for the whole estimated population
        {perCell >= 1.05 || perCell <= 0.95 ? ` — one square is ${perCell.toFixed(1)} animals` : ""} · the{" "}
        {markedCells} solid ones are the {marked} already marked
      </p>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Population</dt>
          <dd className="font-medium tabular-nums">{Math.round(chapman).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">95% interval</dt>
          <dd className="font-medium tabular-nums">
            {Math.round(lo).toLocaleString()}–{Math.round(hi).toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Recapture rate</dt>
          <dd className="font-medium tabular-nums">{(markedFraction * 100).toFixed(1)}%</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Chapman-corrected Lincoln–Petersen from {marked} marked, {captured} caught, {recaptured} bearing a mark
        {recaptured < 7 ? " · fewer than 7 recaptures makes this estimate unreliable" : ""}
      </p>
    </div>
  )
}
