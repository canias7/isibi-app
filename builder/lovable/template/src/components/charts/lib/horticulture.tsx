/**
 * Horticulture primitives — light integral, nutrient solution, germination,
 * grafting, pruning and the two temperature accumulations growers actually
 * plan around.
 *
 * Everything a grower would otherwise sum by hand is DERIVED: DLI from the
 * hourly PPFD trace, EC and the N:K ratio from the salt weights, T50 and the
 * uniformity index from the germination counts, chill units by the Utah model
 * and growing degree days against each stage's threshold.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * LightIntegral — the daily light integral summed from the PPFD trace,
 * against what the crop needs. A DLI passed as a prop cannot disagree
 * with the trace beneath it; one computed from it can.
 * ------------------------------------------------------------------ */
export function LightIntegral({
  ppfd,
  minutesPerSample = 60,
  cropTarget,
  supplementalPpfd,
  height = 190,
  className = "",
}: {
  /** photosynthetic photon flux density, µmol/m²/s */
  ppfd: number[]
  minutesPerSample?: number
  /** mol/m²/day the crop wants */
  cropTarget?: number
  /** what the lamps add when they are on */
  supplementalPpfd?: number
  height?: number
  className?: string
}) {
  const secs = minutesPerSample * 60
  const dli = ppfd.reduce((a, v) => a + (v * secs) / 1e6, 0)
  const shortfall = cropTarget === undefined ? 0 : Math.max(0, cropTarget - dli)
  // how many lamp-hours would close the gap, which is the decision being made
  const lampHours = supplementalPpfd && shortfall > 0 ? (shortfall * 1e6) / (supplementalPpfd * 3600) : 0
  const peak = Math.max(1, ...ppfd)
  const daylightSamples = ppfd.filter((v) => v > 10).length

  return (
    <div className={className}>
      <div className="flex items-end gap-px" style={{ height }}>
        {ppfd.map((v, i) => (
          <div
            key={i}
            className="min-w-0 flex-1 rounded-t-[1px] bg-foreground/65"
            style={{ height: `${(v / peak) * 100}%` }}
            title={`${((i * minutesPerSample) / 60).toFixed(1)} h: ${Math.round(v)} µmol/m²/s`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>00:00</span>
        <span>{((ppfd.length * minutesPerSample) / 60).toFixed(0)} h</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">DLI</dt>
          <dd className="font-medium tabular-nums">{dli.toFixed(1)} mol/m²</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Peak PPFD</dt>
          <dd className="font-medium tabular-nums">{Math.round(peak)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Daylight</dt>
          <dd className="font-medium tabular-nums">{((daylightSamples * minutesPerSample) / 60).toFixed(1)} h</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Integrated from the trace, not stated ·{" "}
        {cropTarget === undefined
          ? "no crop target given"
          : shortfall === 0
            ? `${(dli - cropTarget).toFixed(1)} mol/m² over the ${cropTarget} the crop wants`
            : lampHours > 0
              ? `${shortfall.toFixed(1)} mol/m² short of ${cropTarget} — ${lampHours.toFixed(1)} h of supplement at ${supplementalPpfd} µmol closes it`
              : `${shortfall.toFixed(1)} mol/m² short of ${cropTarget}`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * NutrientSolution — a recipe with the delivered ppm of each element,
 * the EC and the ratios computed from the salt weights.
 * ------------------------------------------------------------------ */
export type SaltAnalysis = { N?: number; P?: number; K?: number; Ca?: number; Mg?: number; S?: number }

export function NutrientSolution({
  salts,
  litres,
  target,
  className = "",
}: {
  /** grams of each salt, with its analysis as percentage by weight */
  salts: { name: string; grams: number; analysis: SaltAnalysis }[]
  litres: number
  /** ppm the grower is aiming for */
  target?: SaltAnalysis
  className?: string
}) {
  const ELEMENTS: (keyof SaltAnalysis)[] = ["N", "P", "K", "Ca", "Mg", "S"]
  const ppm = ELEMENTS.map((el) => ({
    el,
    value: salts.reduce((a, s) => a + (s.grams * ((s.analysis[el] ?? 0) / 100) * 1000) / Math.max(litres, 1e-9), 0),
  }))
  const byElement = new Map(ppm.map((p) => [p.el, p.value]))
  const totalPpm = ppm.reduce((a, p) => a + p.value, 0)
  // EC ≈ total dissolved salts / 640 as a working rule for hydroponic feeds
  const ec = totalPpm / 640
  const nk = (byElement.get("N") ?? 0) / Math.max(byElement.get("K") ?? 0, 1e-9)
  const caMg = (byElement.get("Ca") ?? 0) / Math.max(byElement.get("Mg") ?? 0, 1e-9)
  const max = Math.max(1, ...ppm.map((p) => p.value), ...ELEMENTS.map((e) => target?.[e] ?? 0))

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {ppm.map((p) => {
          const t = target?.[p.el]
          return (
            <li key={p.el} className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-[11px] font-medium">{p.el}</span>
              <div className="relative h-4 flex-1 rounded-[2px] bg-muted">
                <div className="h-full rounded-[2px] bg-foreground/45" style={{ width: `${(p.value / max) * 100}%` }} />
                {t !== undefined && <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${(t / max) * 100}%` }} />}
              </div>
              <span className="w-28 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                {p.value.toFixed(0)} ppm
                {t !== undefined ? ` vs ${t}` : ""}
              </span>
            </li>
          )
        })}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">EC</dt>
          <dd className="font-medium tabular-nums">{ec.toFixed(2)} mS/cm</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">N:K</dt>
          <dd className="font-medium tabular-nums">1:{(1 / Math.max(nk, 1e-9)).toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ca:Mg</dt>
          <dd className="font-medium tabular-nums">{caMg.toFixed(1)}:1</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {salts.length} salts in {litres} L · ticks are the target · the ratios are what the plant responds to —{" "}
        {caMg < 2
          ? "Ca:Mg below 2:1 usually shows as magnesium lockout before it shows as a deficiency"
          : "Ca:Mg is in the usual working range"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * GerminationCurve — cumulative emergence with T50 and the uniformity
 * index solved from the counts.
 * ------------------------------------------------------------------ */
export function GerminationCurve({
  lots,
  sown,
  height = 190,
  className = "",
}: {
  /** cumulative germinated count on each day, per seed lot */
  lots: { name: string; counts: number[] }[]
  sown: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!lots.length) return null

  const days = Math.max(...lots.map((l) => l.counts.length))
  const rows = lots.map((l) => {
    const final = l.counts[l.counts.length - 1] ?? 0
    const pct = (n: number) => {
      const target = (final * n) / 100
      const i = l.counts.findIndex((c) => c >= target)
      if (i <= 0) return i
      const a = l.counts[i - 1]
      const b = l.counts[i]
      return i - 1 + (target - a) / Math.max(b - a, 1e-9)
    }
    const t10 = pct(10)
    const t50 = pct(50)
    const t90 = pct(90)
    return { ...l, final, rate: final / Math.max(sown, 1), t50, spread: t90 - t10 }
  })
  const px = (d: number) => (d / Math.max(1, days - 1)) * 100
  const py = (c: number) => 100 - (c / Math.max(sown, 1)) * 94 - 3
  const dashes = ["", "4 2", "1 2", "6 2 1 2"]
  const best = rows.reduce((a, r) => (r.rate > a.rate ? r : a), rows[0])
  const tightest = rows.reduce((a, r) => (r.spread < a.spread ? r : a), rows[0])

  return (
    <div className={className}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
        <line x1={0} y1={py(sown * 0.5)} x2={100} y2={py(sown * 0.5)} stroke="currentColor" strokeWidth={0.4} strokeDasharray="3 2" opacity={0.4} />
        {rows.map((r, ri) => (
          <polyline
            key={r.name}
            points={r.counts.map((c, i) => `${px(i)},${py(c)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            strokeDasharray={dashes[ri % dashes.length]}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>day 0</span>
        <span>day {days - 1}</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {rows.map((r, ri) => (
          <li key={r.name} className="flex items-center gap-2">
            <svg width={18} height={6} className="shrink-0" aria-hidden>
              <line x1={0} y1={3} x2={18} y2={3} stroke="currentColor" strokeWidth={1.4} strokeDasharray={dashes[ri % dashes.length]} />
            </svg>
            <span className="w-24 shrink-0 truncate">{r.name}</span>
            <span className="text-muted-foreground">
              {(r.rate * 100).toFixed(0)}% germinated · T50 day {r.t50.toFixed(1)} · spread {r.spread.toFixed(1)} d
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {best.name} has the highest final rate, {tightest.name} the tightest spread · a lot that all comes up in two days
        transplants as one crop; the same total over a week is two crops in one tray
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * GraftingSuccess — take rate by rootstock and method, with the
 * interaction visible rather than each factor averaged separately.
 * ------------------------------------------------------------------ */
export function GraftingSuccess({
  rootstocks,
  methods,
  taken,
  attempted,
  className = "",
}: {
  rootstocks: string[]
  methods: string[]
  /** taken[rootstock][method] */
  taken: number[][]
  attempted: number[][]
  className?: string
}) {
  const rate = (r: number, m: number) => (taken[r]?.[m] ?? 0) / Math.max(attempted[r]?.[m] ?? 0, 1)
  const byRootstock = rootstocks.map((_, r) => {
    const t = methods.reduce((a, _m, m) => a + (taken[r]?.[m] ?? 0), 0)
    const n = methods.reduce((a, _m, m) => a + (attempted[r]?.[m] ?? 0), 0)
    return t / Math.max(n, 1)
  })
  const byMethod = methods.map((_, m) => {
    const t = rootstocks.reduce((a, _r, r) => a + (taken[r]?.[m] ?? 0), 0)
    const n = rootstocks.reduce((a, _r, r) => a + (attempted[r]?.[m] ?? 0), 0)
    return t / Math.max(n, 1)
  })
  // the cell that most departs from what the two margins alone would predict
  let outlier = { r: 0, m: 0, gap: 0 }
  rootstocks.forEach((_, r) =>
    methods.forEach((_, m) => {
      const expected = byRootstock[r] * byMethod[m] * (1 / Math.max(byRootstock.reduce((a, v) => a + v, 0) / rootstocks.length, 1e-9))
      const gap = rate(r, m) - expected
      if (Math.abs(gap) > Math.abs(outlier.gap)) outlier = { r, m, gap }
    }),
  )

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="pr-1.5 pb-1 text-left font-normal text-muted-foreground">rootstock \ method</th>
              {methods.map((m) => (
                <th key={m} className="px-0.5 pb-1 font-medium">
                  <span className="block max-w-[4rem] truncate">{m}</span>
                </th>
              ))}
              <th className="pl-1.5 pb-1 font-medium">all</th>
            </tr>
          </thead>
          <tbody>
            {rootstocks.map((rs, r) => (
              <tr key={rs}>
                <th className="pr-1.5 text-left font-medium whitespace-nowrap">{rs}</th>
                {methods.map((m, mi) => {
                  const v = rate(r, mi)
                  const isOut = r === outlier.r && mi === outlier.m
                  return (
                    <td key={m} className="p-px">
                      <div
                        className="flex h-6 items-center justify-center rounded-[2px]"
                        style={{
                          background: `color-mix(in oklch, currentColor ${(v * 78).toFixed(0)}%, transparent)`,
                          outline: isOut ? "1.5px solid currentColor" : undefined,
                          outlineOffset: -1.5,
                        }}
                        title={`${rs} × ${m}: ${taken[r]?.[mi] ?? 0} of ${attempted[r]?.[mi] ?? 0}`}
                      >
                        {/* colour on the child: on this div it would redefine
                            currentColor for the background above and blank the cell */}
                        <span style={{ color: v > 0.55 ? "var(--background)" : undefined }}>{(v * 100).toFixed(0)}</span>
                      </div>
                    </td>
                  )
                })}
                <td className="pl-1.5 text-center font-medium">{(byRootstock[r] * 100).toFixed(0)}</td>
              </tr>
            ))}
            <tr>
              <th className="pt-1 pr-1.5 text-left font-medium">all</th>
              {byMethod.map((v, i) => (
                <td key={methods[i]} className="pt-1 text-center font-medium">
                  {(v * 100).toFixed(0)}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Take rate as a percentage · the outlined cell departs most from what the two margins alone would predict —{" "}
        {rootstocks[outlier.r]} with {methods[outlier.m]}, {outlier.gap >= 0 ? "better" : "worse"} than either factor
        explains, which is the pairing worth repeating
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PruningPlan — what comes off each tree and what is left, with the
 * removal fraction derived because that is the number that decides
 * whether the tree responds or sulks.
 * ------------------------------------------------------------------ */
export function PruningPlan({
  trees,
  maxSafeRemoval = 0.25,
  className = "",
}: {
  trees: { name: string; canopyM3: number; removeM3: number; note?: string }[]
  /** fraction of live canopy above which a mature tree is stressed */
  maxSafeRemoval?: number
  className?: string
}) {
  const rows = trees.map((t) => ({ ...t, fraction: t.removeM3 / Math.max(t.canopyM3, 1e-9) }))
  const max = Math.max(...rows.map((r) => r.canopyM3))
  const over = rows.filter((r) => r.fraction > maxSafeRemoval)
  const totalRemoved = rows.reduce((a, r) => a + r.removeM3, 0)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.removeM3.toFixed(1)} of {r.canopyM3.toFixed(1)} m³
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/25" style={{ width: `${(r.canopyM3 / max) * 100}%` }} />
              <div
                className="absolute inset-y-0 rounded-l-[2px] border-r border-foreground"
                style={{
                  width: `${(r.removeM3 / max) * 100}%`,
                  background: r.fraction > maxSafeRemoval ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 60%, transparent)",
                }}
              />
              <span
                className="absolute inset-y-0 w-px bg-foreground/60"
                style={{ left: `${((r.canopyM3 * maxSafeRemoval) / max) * 100}%` }}
                title={`${(maxSafeRemoval * 100).toFixed(0)}% of this tree's canopy`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              <span aria-hidden>{r.fraction > maxSafeRemoval ? "✗" : "✓"}</span> {(r.fraction * 100).toFixed(0)}% of live
              canopy{r.note ? ` · ${r.note}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        {totalRemoved.toFixed(1)} m³ off {trees.length} trees · the tick on each bar is that tree's own{" "}
        {(maxSafeRemoval * 100).toFixed(0)}% limit, which is a fraction and not a fixed volume ·{" "}
        {over.length
          ? `${over.map((r) => r.name).join(", ")} ${over.length === 1 ? "is" : "are"} over it — expect watersprouts next season`
          : "every tree stays inside it"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ChillHours — winter chill accumulated by the Utah model, which
 * SUBTRACTS for warm spells. A running total that only ever rises is
 * the mistake this chart exists to prevent.
 * ------------------------------------------------------------------ */
export function ChillHours({
  hourlyC,
  requirement,
  height = 190,
  className = "",
}: {
  hourlyC: number[]
  /** the cultivar's chill requirement in Utah chill units */
  requirement: number
  height?: number
  className?: string
}) {
  // Utah model weights, including the negative ones for warm hours
  const weight = (t: number) => {
    if (t <= 1.4) return 0
    if (t <= 2.4) return 0.5
    if (t <= 9.1) return 1
    if (t <= 12.4) return 0.5
    if (t <= 15.9) return 0
    if (t <= 18) return -0.5
    return -1
  }
  const cumulative: number[] = []
  let run = 0
  hourlyC.forEach((t) => {
    run += weight(t)
    cumulative.push(run)
  })
  const total = run
  const negativeHours = hourlyC.filter((t) => weight(t) < 0).length
  const lost = hourlyC.reduce((a, t) => a + Math.min(0, weight(t)), 0)
  const metAt = cumulative.findIndex((c) => c >= requirement)
  const peak = Math.max(requirement, ...cumulative)
  const px = (i: number) => (i / Math.max(1, cumulative.length - 1)) * 100
  const py = (c: number) => 100 - (Math.max(0, c) / peak) * 96 - 2

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(requirement)} x2={100} y2={py(requirement)} stroke="currentColor" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.6} />
          <polygon points={`0,100 ${cumulative.map((c, i) => `${px(i)},${py(c)}`).join(" ")} 100,100`} fill="currentColor" opacity={0.12} />
          <polyline points={cumulative.map((c, i) => `${px(i)},${py(c)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
          {metAt > 0 && <line x1={px(metAt)} y1={0} x2={px(metAt)} y2={100} stroke="currentColor" strokeWidth={0.5} opacity={0.55} />}
        </svg>
        <span className="absolute right-1 -translate-y-full bg-background px-1 text-[9px] text-muted-foreground" style={{ top: `${py(requirement)}%` }}>
          needs {requirement}
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>hour 0</span>
        <span>{hourlyC.length} h</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Accumulated</dt>
          <dd className="font-medium tabular-nums">{total.toFixed(0)} CU</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Warm hours</dt>
          <dd className="font-medium tabular-nums">{negativeHours}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Chill undone</dt>
          <dd className="font-medium tabular-nums">{Math.abs(lost).toFixed(0)} CU</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        The Utah model SUBTRACTS for hours above 16 °C, so this total can fall — {negativeHours} warm hours undid{" "}
        {Math.abs(lost).toFixed(0)} chill units ·{" "}
        {metAt > 0
          ? `requirement met at hour ${metAt}`
          : `still ${(requirement - total).toFixed(0)} CU short, which shows up in spring as a ragged, drawn-out bloom`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * HeatUnits — growing degree days against each stage's own base
 * temperature, so the forecast date for each stage is computed.
 * ------------------------------------------------------------------ */
export function HeatUnits({
  days,
  baseC,
  stages,
  height = 190,
  className = "",
}: {
  /** daily minimum and maximum, in order */
  days: { min: number; max: number }[]
  baseC: number
  /** each stage and the GDD it needs from sowing */
  stages: { name: string; gdd: number }[]
  height?: number
  className?: string
}) {
  const cumulative: number[] = []
  let run = 0
  days.forEach((d) => {
    run += Math.max(0, (d.max + d.min) / 2 - baseC)
    cumulative.push(run)
  })
  const total = run
  const recentRate = cumulative.length > 7 ? (total - cumulative[cumulative.length - 8]) / 7 : total / Math.max(1, cumulative.length)
  const rows = [...stages]
    .sort((a, b) => a.gdd - b.gdd)
    .map((s) => {
      const reached = cumulative.findIndex((c) => c >= s.gdd)
      const daysAway = reached >= 0 ? null : Math.ceil((s.gdd - total) / Math.max(recentRate, 1e-9))
      return { ...s, reached, daysAway }
    })
  const peak = Math.max(total, ...stages.map((s) => s.gdd)) * 1.04
  const px = (i: number) => (i / Math.max(1, cumulative.length - 1)) * 100
  const py = (c: number) => 100 - (c / peak) * 96 - 2

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {rows.map((s) => (
            <line key={s.name} x1={0} y1={py(s.gdd)} x2={100} y2={py(s.gdd)} stroke="currentColor" strokeWidth={0.4} strokeDasharray="3 2" opacity={0.45} />
          ))}
          <polygon points={`0,100 ${cumulative.map((c, i) => `${px(i)},${py(c)}`).join(" ")} 100,100`} fill="currentColor" opacity={0.12} />
          <polyline points={cumulative.map((c, i) => `${px(i)},${py(c)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Labels are pushed apart to a minimum vertical gap. Two stages a
            hundred degree-days apart on a 1350 axis land on the same pixel and
            the words overprint each other. */}
        {rows
          .map((st, i) => ({ st, y: py(st.gdd), i }))
          .sort((a, b) => a.y - b.y)
          .reduce<{ st: (typeof rows)[number]; y: number }[]>((acc, cur) => {
            const prev = acc[acc.length - 1]
            const y = prev && cur.y - prev.y < 7 ? prev.y + 7 : cur.y
            return [...acc, { st: cur.st, y }]
          }, [])
          .map(({ st, y }) => (
            <span key={st.name} className="absolute right-1 -translate-y-1/2 bg-background px-1 text-[9px] text-muted-foreground" style={{ top: `${y}%` }}>
              {st.name}
            </span>
          ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>sowing</span>
        <span>day {days.length}</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {rows.map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <span aria-hidden className="w-3">
              {s.reached >= 0 ? "●" : "○"}
            </span>
            <span className="w-28 shrink-0 truncate">{s.name}</span>
            <span className="text-muted-foreground">
              {s.gdd} GDD ·{" "}
              {s.reached >= 0 ? `reached on day ${s.reached + 1}` : `about ${s.daysAway} days away at the current rate`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {total.toFixed(0)} GDD above {baseC} °C, accumulating {recentRate.toFixed(1)}/day this week · the forecast dates
        are extrapolated from that rate, so a cold snap moves all of them together
      </p>
    </div>
  )
}
