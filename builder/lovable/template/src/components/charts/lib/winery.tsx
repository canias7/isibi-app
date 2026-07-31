/**
 * Winemaking primitives — ripeness, barrel programmes, blending trials,
 * ferment temperature, phenolics and vintage conditions.
 *
 * The pick window where three measures agree, the cost a barrel regime puts
 * on a bottle, the blend the scores actually favour, the hours a ferment
 * spent outside its band, the seed-to-skin gap and the growing season's
 * index are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) =>
  "£" + (Math.abs(v) < 10 ? Math.abs(v).toFixed(2) : Math.round(Math.abs(v)).toLocaleString("en-GB"))

/* ------------------------------------------------------------------ *
 * RipenessCurve — sugar, acid and pH across the ripening period, with
 * the PICK WINDOW derived from where all three sit inside their
 * targets. Sugar alone is what gets sampled and it decides least.
 * ------------------------------------------------------------------ */
export function RipenessCurve({
  samples,
  targetBrix,
  maxPh,
  minTa,
  height = 200,
  className = "",
}: {
  /** each sampling date's must analysis */
  samples: { date: string; brix: number; ph: number; taGL: number }[]
  targetBrix: [number, number]
  maxPh: number
  /** titratable acidity below which the wine will taste flabby */
  minTa: number
  height?: number
  className?: string
}) {
  const rows = samples.map((s) => ({
    ...s,
    brixOk: s.brix >= targetBrix[0] && s.brix <= targetBrix[1],
    phOk: s.ph <= maxPh,
    taOk: s.taGL >= minTa,
  }))
  const withAll = rows.map((r) => ({ ...r, all: r.brixOk && r.phOk && r.taOk }))
  const window = withAll.filter((r) => r.all)
  const first = withAll.findIndex((r) => r.all)
  const last = withAll.map((r) => r.all).lastIndexOf(true)
  // which measure fails FIRST after the window — asserting that pH closes it is
  // true of a warm year and wrong whenever acid falls away before the pH climbs
  const after = last >= 0 ? withAll[last + 1] : undefined
  const closedBy = !after
    ? null
    : !after.phOk
      ? { name: "pH", value: after.ph.toFixed(2), limit: maxPh.toFixed(2) }
      : !after.taOk
        ? { name: "acidity", value: `${after.taGL.toFixed(1)} g/L`, limit: `${minTa.toFixed(1)} g/L` }
        : { name: "sugar", value: `${after.brix.toFixed(1)} Brix`, limit: `${targetBrix[1].toFixed(1)} Brix` }
  const norm = (v: number, lo: number, hi: number) => clamp((v - lo) / Math.max(hi - lo, 1e-9), 0, 1)
  const brixLo = Math.min(...rows.map((r) => r.brix)) - 1
  const brixHi = Math.max(...rows.map((r) => r.brix), targetBrix[1]) + 1
  const phLo = Math.min(...rows.map((r) => r.ph)) - 0.1
  const phHi = Math.max(...rows.map((r) => r.ph), maxPh) + 0.1
  const taLo = Math.min(...rows.map((r) => r.taGL), minTa) - 0.5
  const taHi = Math.max(...rows.map((r) => r.taGL)) + 0.5
  const px = (i: number) => (rows.length < 2 ? 50 : (i / (rows.length - 1)) * 100)
  const py = (t: number) => 100 - t * 94 - 3
  const series: [string, (r: (typeof rows)[number]) => number, string][] = [
    ["Brix", (r) => norm(r.brix, brixLo, brixHi), "none"],
    ["pH", (r) => norm(r.ph, phLo, phHi), "5 2"],
    ["TA g/L", (r) => norm(r.taGL, taLo, taHi), "2 2"],
  ]

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {first >= 0 && (
            <rect x={px(first)} y={0} width={Math.max(0.8, px(last) - px(first))} height={100} fill="currentColor" opacity={0.13} />
          )}
          {series.map(([name, f, dash]) => (
            <polyline
              key={name}
              points={rows.map((r, i) => `${px(i)},${py(f(r))}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray={dash}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{rows[0]?.date}</span>
        <span>solid Brix · dashed pH · dotted TA</span>
        <span>{rows[rows.length - 1]?.date}</span>
      </div>
      {/* the three verdicts per sample, which is what the shading is made of */}
      <div className="mt-2 space-y-1">
        {(["brixOk", "phOk", "taOk"] as const).map((k, ki) => (
          <div key={k} className="flex items-center gap-1">
            <span className="w-14 shrink-0 text-[9px] text-muted-foreground">{["Brix", "pH", "TA"][ki]}</span>
            <div className="flex flex-1 gap-px">
              {withAll.map((r) => (
                <span
                  key={r.date}
                  className="h-2.5 min-w-0 flex-1 rounded-[1px]"
                  style={{ background: r[k] ? "currentColor" : "color-mix(in oklch, currentColor 12%, transparent)" }}
                  title={`${r.date} ${["Brix", "pH", "TA"][ki]}: ${r[k] ? "in target" : "out"}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The shaded band is where ALL THREE measures sit inside their targets, which is the pick window — sugar alone is
        what gets sampled daily and it is the measure that decides least ·{" "}
        {window.length === 0
          ? "no sample had all three in range, which is the normal answer in a hot year and the reason acid is added"
          : `${window.length} of ${rows.length} samples qualify, from ${withAll[first].date} to ${withAll[last].date}` +
            (closedBy
              ? `, and it is ${closedBy.name} that closes it — ${closedBy.value} on ${after!.date} against a ${closedBy.limit} limit`
              : `, and it was still open at the last sampling`)}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * BarrelProgram — the oak inventory, with the COST PER BOTTLE derived.
 * A cooperage invoice is an annual number; what matters is what each
 * regime adds to a bottle, and nobody computes it per regime.
 * ------------------------------------------------------------------ */
export function BarrelProgram({
  regimes,
  bottlesPerBarrel = 300,
  className = "",
}: {
  regimes: { name: string; barrels: number; costEach: number; lifeFills: number; newOakShare: number }[]
  bottlesPerBarrel?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!regimes.length) return null

  const rows = regimes
    .map((r) => {
      // a barrel is amortised over its fills, not charged to one vintage
      const perFill = r.costEach / Math.max(r.lifeFills, 1)
      return {
        ...r,
        perFill,
        perBottle: perFill / Math.max(bottlesPerBarrel, 1),
        annual: r.barrels * perFill,
        bottles: r.barrels * bottlesPerBarrel,
      }
    })
    .sort((a, b) => b.perBottle - a.perBottle)
  const totalAnnual = rows.reduce((a, r) => a + r.annual, 0)
  const totalBottles = rows.reduce((a, r) => a + r.bottles, 0)
  const blended = totalAnnual / Math.max(totalBottles, 1)
  const max = Math.max(...rows.map((r) => r.perBottle))
  const dearest = rows[0]
  const cheapest = rows[rows.length - 1]

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.barrels} barrels · {money(r.costEach)} each · {r.lifeFills} fills ·{" "}
                {(r.newOakShare * 100).toFixed(0)}% new
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(r.perBottle / max) * 100}%`,
                  background: `color-mix(in oklch, currentColor ${(28 + r.newOakShare * 62).toFixed(0)}%, transparent)`,
                }}
                title={`${money(r.perBottle)} a bottle`}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(blended / max) * 100}%` }} title={`blended ${money(blended)}`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.perBottle)} a bottle · {money(r.annual)} a year · {r.bottles.toLocaleString()} bottles
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is cost PER BOTTLE, amortised over each barrel's fills rather than charged whole to one vintage — a
        cooperage invoice is {money(totalAnnual)} a year and says nothing about which wine it lands on · the fill
        darkens with the new-oak share, and the mark is the {money(blended)} blended average ·{" "}
        {dearest.name} costs {(dearest.perBottle / Math.max(cheapest.perBottle, 1e-9)).toFixed(1)}× what{" "}
        {cheapest.name.toLowerCase()} does, which is a pricing decision made in the barrel hall
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * BlendTrial — trial blends against their tasting scores, with each
 * component's CONTRIBUTION derived by regression through the trials.
 * Tasting notes rank blends; only the arithmetic ranks varieties.
 * ------------------------------------------------------------------ */
export function BlendTrial({
  components,
  trials,
  className = "",
}: {
  components: string[]
  /** the proportion of each component, and the panel's score */
  trials: { name: string; shares: number[]; score: number }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!components.length || !trials.length) return null

  // least squares through the origin on the shares — with shares summing to
  // one this gives each component's implied contribution to the score
  const n = components.length
  const xtx = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => trials.reduce((a, t) => a + t.shares[i] * t.shares[j], 0)),
  )
  const xty = Array.from({ length: n }, (_, i) => trials.reduce((a, t) => a + t.shares[i] * t.score, 0))
  // Gaussian elimination with a ridge term, so a near-singular design (two
  // components that never vary independently) degrades instead of exploding
  const A = xtx.map((row, i) => [...row.map((v, j) => v + (i === j ? 1e-6 : 0)), xty[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    ;[A[c], A[p]] = [A[p], A[c]]
    const pivot = A[c][c] || 1e-9
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = A[r][c] / pivot
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]
    }
  }
  const coef = A.map((row, i) => row[n] / (row[i] || 1e-9))
  const best = coef.reduce((a, v, i) => (v > coef[a] ? i : a), 0)
  const worst = coef.reduce((a, v, i) => (v < coef[a] ? i : a), 0)
  const lo = Math.min(...coef)
  const hi = Math.max(...coef)
  const bestTrial = trials.reduce((a, t) => (t.score > a.score ? t : a), trials[0])
  const maxScore = Math.max(...trials.map((t) => t.score))
  const minScore = Math.min(...trials.map((t) => t.score))

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {[...trials].sort((a, b) => b.score - a.score).map((t) => (
          <li key={t.name} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span className="w-20 shrink-0 truncate">{t.name}</span>
            <div className="flex h-4 flex-1 overflow-hidden rounded-[2px] border border-foreground/20">
              {t.shares.map((s, i) => (
                <div
                  key={i}
                  className="border-r border-background last:border-r-0"
                  style={{ width: `${s * 100}%`, background: `color-mix(in oklch, currentColor ${(86 - i * 17).toFixed(0)}%, transparent)` }}
                  title={`${components[i]}: ${(s * 100).toFixed(0)}%`}
                />
              ))}
            </div>
            <span className="w-10 shrink-0 text-right font-medium">{t.score.toFixed(1)}</span>
          </li>
        ))}
      </ul>
      {/* the derived half: what each component is worth on its own */}
      <ul className="mt-3 space-y-1">
        {components.map((c, i) => (
          <li key={c} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span
              className="inline-block h-2.5 w-4 shrink-0 rounded-[1px] border border-foreground/25"
              style={{ background: `color-mix(in oklch, currentColor ${(86 - i * 17).toFixed(0)}%, transparent)` }}
            />
            <span className="w-24 shrink-0 truncate">{c}</span>
            <div className="h-2 flex-1 rounded-[1px] bg-muted">
              <div
                className="h-full rounded-[1px] bg-foreground/65"
                style={{ width: `${clamp(((coef[i] - lo) / Math.max(hi - lo, 1e-9)) * 92 + 8, 8, 100)}%` }}
              title={`${c}: ${coef[i].toFixed(1)} points`}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-muted-foreground">{coef[i].toFixed(1)} pts</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The lower bars are each variety's implied contribution, FITTED through the trials rather than tasted — a panel
        ranks blends, and only the arithmetic ranks the components inside them · those bars span the fitted RANGE
        rather than starting at zero, because the differences are a few points on a scale that starts near ninety ·{" "}
        {components[best]} carries{" "}
        {(coef[best] - coef[worst]).toFixed(1)} points more than {components[worst].toLowerCase()} ·{" "}
        {bestTrial.name} scored highest at {maxScore.toFixed(1)} against {minScore.toFixed(1)} for the weakest, and the
        fit says why · with {trials.length} trials over {n} components this is a small design, and a component that
        never varied on its own cannot be separated from the ones it travelled with
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * FermentTemp — must temperature against the band, with the HOURS
 * outside it derived. A ferment logged twice a day looks fine; the
 * excursions happen overnight and are what strip the aromatics.
 * ------------------------------------------------------------------ */
export function FermentTemp({
  readings,
  band,
  height = 190,
  className = "",
}: {
  /** hours since pitching and the must temperature */
  readings: { hour: number; c: number }[]
  band: [number, number]
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!readings.length) return null

  const [lo, hi] = band
  const pts = [...readings].sort((a, b) => a.hour - b.hour)
  // hours outside the band, by trapezoid between readings rather than by
  // counting readings — a reading is a moment and an excursion is a duration
  let outHot = 0
  let outCold = 0
  for (let i = 1; i < pts.length; i++) {
    const dt = pts[i].hour - pts[i - 1].hour
    const mid = (pts[i].c + pts[i - 1].c) / 2
    if (mid > hi) outHot += dt
    else if (mid < lo) outCold += dt
  }
  const peak = pts.reduce((a, p) => (p.c > a.c ? p : a), pts[0])
  const span = pts[pts.length - 1].hour - pts[0].hour
  const tLo = Math.min(lo, ...pts.map((p) => p.c)) - 1
  const tHi = Math.max(hi, ...pts.map((p) => p.c)) + 1
  const px = (h: number) => ((h - pts[0].hour) / Math.max(span, 1e-9)) * 100
  const py = (c: number) => 100 - ((c - tLo) / Math.max(tHi - tLo, 1e-9)) * 100

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <rect x={0} y={py(hi)} width={100} height={Math.max(0, py(lo) - py(hi))} fill="currentColor" opacity={0.11} />
          <polyline points={pts.map((p) => `${px(p.hour)},${py(p.c)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute right-1 -translate-y-1/2 bg-background px-0.5 text-[9px] tabular-nums text-muted-foreground" style={{ top: `${py(hi)}%` }}>
          {hi}°C
        </span>
        <span className="absolute right-1 -translate-y-1/2 bg-background px-0.5 text-[9px] tabular-nums text-muted-foreground" style={{ top: `${py(lo)}%` }}>
          {lo}°C
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{pts[0].hour} h</span>
        <span>{pts[pts.length - 1].hour} h</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Peak</dt>
          <dd className="font-medium tabular-nums">{peak.c.toFixed(1)}°C</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Hours over</dt>
          <dd className="font-medium tabular-nums">{outHot.toFixed(0)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Hours under</dt>
          <dd className="font-medium tabular-nums">{outCold.toFixed(0)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">In band</dt>
          <dd className="font-medium tabular-nums">{(((span - outHot - outCold) / Math.max(span, 1e-9)) * 100).toFixed(0)}%</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The excursion is measured in HOURS between readings, not in readings — a log taken twice a day counts two points
        and misses the whole night · {outHot.toFixed(0)} hours above {hi}°C, peaking at {peak.c.toFixed(1)}°C at hour{" "}
        {peak.hour}, is where the aromatics go, and {outCold.toFixed(0)} hours below {lo}°C is where the ferment sticks
        · {(((span - outHot - outCold) / Math.max(span, 1e-9)) * 100).toFixed(0)}% of the ferment sat inside the band
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PhenolicRipeness — seed against skin tannin over the ripening
 * period. They ripen at different rates, and picking on sugar alone
 * takes the fruit with green seeds, which is the bitterness.
 * ------------------------------------------------------------------ */
export function PhenolicRipeness({
  samples,
  seedTarget,
  height = 190,
  className = "",
}: {
  /** skin and seed tannin extractability, 0-1, with the sugar for reference */
  samples: { date: string; skin: number; seed: number; brix: number }[]
  /** the seed maturity below which the wine will be green */
  seedTarget: number
  height?: number
  className?: string
}) {
  const rows = samples.map((s) => ({ ...s, gap: s.skin - s.seed }))
  const ready = rows.findIndex((r) => r.seed >= seedTarget)
  const sugarReady = rows.findIndex((r) => r.brix >= 24)
  const lag = ready >= 0 && sugarReady >= 0 ? ready - sugarReady : null
  const px = (i: number) => (rows.length < 2 ? 50 : (i / (rows.length - 1)) * 100)
  const py = (v: number) => 100 - v * 94 - 3

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon
            points={`${rows.map((r, i) => `${px(i)},${py(r.skin)}`).join(" ")} ${[...rows].reverse().map((r, i) => `${px(rows.length - 1 - i)},${py(r.seed)}`).join(" ")}`}
            fill="currentColor"
            opacity={0.14}
          />
          <line x1={0} y1={py(seedTarget)} x2={100} y2={py(seedTarget)} stroke="currentColor" strokeWidth={0.9} strokeDasharray="4 2" />
          <polyline points={rows.map((r, i) => `${px(i)},${py(r.skin)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <polyline points={rows.map((r, i) => `${px(i)},${py(r.seed)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        </svg>
        {sugarReady >= 0 && <span className="absolute inset-y-0 w-px bg-foreground/45" style={{ left: `${px(sugarReady)}%` }} title="24 Brix" />}
        {ready >= 0 && <span className="absolute inset-y-0 w-0.5 bg-foreground/75" style={{ left: `${px(ready)}%` }} title="seeds ripe" />}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{rows[0]?.date}</span>
        <span>solid skin · dashed seed</span>
        <span>{rows[rows.length - 1]?.date}</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The shaded gap is skin MINUS seed, and it is the bitterness — skins are ready first and seeds catch up late ·{" "}
        {ready < 0
          ? `the seeds never reached ${seedTarget.toFixed(2)} in this record, which is the argument for hanging longer or for a gentler extraction`
          : `seeds reach ${seedTarget.toFixed(2)} on ${rows[ready].date}` +
            (lag === null
              ? ""
              : lag > 0
                ? `, ${lag} sampling${lag === 1 ? "" : "s"} AFTER the sugar hit 24 Brix — picking on sugar alone takes the fruit with green seeds`
                : `, at or before the sugar reached 24 Brix, which is the easy year`)}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * VintageIndex — the growing season's heat and rain against the
 * score. Every vintage chart is a memory; this is the two numbers
 * that produced it, with the correlation derived.
 * ------------------------------------------------------------------ */
export function VintageIndex({
  vintages,
  height = 200,
  className = "",
}: {
  vintages: { year: number; growingDegreeDays: number; harvestRainMm: number; score: number }[]
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!vintages.length) return null

  const xs = vintages.map((v) => v.growingDegreeDays)
  const ys = vintages.map((v) => v.score)
  const rs = vintages.map((v) => v.harvestRainMm)
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(a.length, 1)
  const corr = (a: number[], b: number[]) => {
    const ma = mean(a)
    const mb = mean(b)
    const num = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0)
    const da = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0))
    const db = Math.sqrt(b.reduce((s, v) => s + (v - mb) ** 2, 0))
    return num / Math.max(da * db, 1e-9)
  }
  const rHeat = corr(xs, ys)
  const rRain = corr(rs, ys)
  const xLo = Math.min(...xs) * 0.98
  const xHi = Math.max(...xs) * 1.02
  const yLo = Math.min(...ys) - 2
  const yHi = Math.max(...ys) + 2
  const maxRain = Math.max(...rs)
  const px = (v: number) => ((v - xLo) / Math.max(xHi - xLo, 1e-9)) * 100
  const py = (v: number) => 100 - ((v - yLo) / Math.max(yHi - yLo, 1e-9)) * 100
  const best = vintages.reduce((a, v) => (v.score > a.score ? v : a), vintages[0])
  const wettest = vintages.reduce((a, v) => (v.harvestRainMm > a.harvestRainMm ? v : a), vintages[0])

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        {vintages.map((v) => {
          // the marker's SIZE is harvest rain, which is the second variable —
          // a scatter of two axes cannot show a third without one
          const d = 6 + (v.harvestRainMm / Math.max(maxRain, 1e-9)) * 16
          return (
            <span
              key={v.year}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground"
              style={{
                left: `${clamp(px(v.growingDegreeDays), 2, 98)}%`,
                top: `${clamp(py(v.score), 3, 97)}%`,
                width: d,
                height: d,
                background: `color-mix(in oklch, currentColor ${clamp((1 - v.harvestRainMm / Math.max(maxRain, 1e-9)) * 70 + 8, 8, 78).toFixed(0)}%, transparent)`,
              }}
              title={`${v.year}: ${v.growingDegreeDays} GDD, ${v.harvestRainMm} mm at harvest, scored ${v.score}`}
            />
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{Math.round(xLo)} GDD</span>
        <span>size and paleness are harvest rain</span>
        <span>{Math.round(xHi)} GDD</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Heat vs score</dt>
          <dd className="font-medium tabular-nums">r {rHeat.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rain vs score</dt>
          <dd className="font-medium tabular-nums">r {rRain.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Best</dt>
          <dd className="font-medium tabular-nums">{best.year}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Both correlations are DERIVED from the record rather than remembered — a vintage chart is somebody's memory of{" "}
        {vintages.length} years · heat correlates {rHeat.toFixed(2)} with the score and harvest rain{" "}
        {rRain.toFixed(2)}, so{" "}
        {Math.abs(rRain) > Math.abs(rHeat)
          ? "the rain at picking matters more here than the summer did"
          : "the summer matters more here than the rain at picking"}{" "}
        · {best.year} is the best at {best.score} and {wettest.year} took {wettest.harvestRainMm} mm at harvest, which
        is the year everybody remembers for the wrong reason
      </p>
    </div>
  )
}
