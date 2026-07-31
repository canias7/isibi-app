/**
 * Mining primitives — grade-tonnage, cut-off economics, stripping, mill
 * recovery, drill logs and a block model section.
 *
 * The tonnage above each cut-off, the break-even grade from costs and
 * price, the incremental stripping ratio, the recovery at the feed grade,
 * the composited intervals and the block values are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e9 ? `$${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${(a / 1e3).toFixed(0)}k` : `$${a.toFixed(a < 10 ? 2 : 0)}`
  return v < 0 ? `−${s}` : s
}

/* ------------------------------------------------------------------ *
 * GradeTonnage — the curve every resource statement rests on. Both
 * axes are DERIVED from the block grades by cut-off; a table of
 * tonnes and grade at one cut-off hides how fast both move.
 * ------------------------------------------------------------------ */
export function GradeTonnage({
  blocks,
  cutoffs,
  unit = "g/t",
  height = 200,
  className = "",
}: {
  /** each block's tonnage and grade */
  blocks: { tonnes: number; grade: number }[]
  cutoffs: number[]
  unit?: string
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!blocks.length || !cutoffs.length) return null

  const rows = [...cutoffs]
    .sort((a, b) => a - b)
    .map((c) => {
      const above = blocks.filter((b) => b.grade >= c)
      const tonnes = above.reduce((a, b) => a + b.tonnes, 0)
      const metal = above.reduce((a, b) => a + b.tonnes * b.grade, 0)
      return { cutoff: c, tonnes, grade: tonnes > 0 ? metal / tonnes : 0, metal }
    })
  const maxT = Math.max(...rows.map((r) => r.tonnes))
  const maxG = Math.max(...rows.map((r) => r.grade))
  const maxM = Math.max(...rows.map((r) => r.metal))
  const bestMetal = rows.reduce((a, r) => (r.metal > a.metal ? r : a), rows[0])
  const px = (i: number) => (rows.length < 2 ? 50 : (i / (rows.length - 1)) * 100)

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={`0,100 ${rows.map((r, i) => `${px(i)},${100 - (r.tonnes / maxT) * 94 - 3}`).join(" ")} 100,100`} fill="currentColor" opacity={0.18} />
          <polyline points={rows.map((r, i) => `${px(i)},${100 - (r.tonnes / maxT) * 94 - 3}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <polyline points={rows.map((r, i) => `${px(i)},${100 - (r.grade / maxG) * 94 - 3}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.4} strokeDasharray="5 2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>cut-off {rows[0]?.cutoff} {unit}</span>
        <span>solid tonnes · dashed grade</span>
        <span>{rows[rows.length - 1]?.cutoff} {unit}</span>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[10px] tabular-nums">
          <thead>
            <tr className="text-muted-foreground">
              <th className="pr-2 text-left font-normal">cut-off</th>
              <th className="px-2 text-right font-normal">tonnes</th>
              <th className="px-2 text-right font-normal">grade</th>
              <th className="pl-2 text-right font-normal">contained metal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cutoff}>
                <td className="pr-2">{r.cutoff.toFixed(2)} {unit}</td>
                <td className="px-2 text-right">{(r.tonnes / 1e6).toFixed(2)} Mt</td>
                <td className="px-2 text-right">{r.grade.toFixed(2)}</td>
                <td className="pl-2">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="h-1.5 w-20 rounded-[1px] bg-muted">
                      <div className="h-full rounded-[1px] bg-foreground/60" style={{ width: `${(r.metal / maxM) * 100}%` }} />
                    </div>
                    <span className="w-14 text-right">{(r.metal / 1e3).toFixed(0)} kt·{unit.split("/")[0]}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Every number here is DERIVED from the block grades by cut-off, which is the only honest way to state a resource —
        raising the cut-off from {rows[0].cutoff} to {rows[rows.length - 1].cutoff} {unit} drops{" "}
        {(((rows[0].tonnes - rows[rows.length - 1].tonnes) / Math.max(rows[0].tonnes, 1)) * 100).toFixed(0)}% of the
        tonnage and lifts the grade {(((rows[rows.length - 1].grade - rows[0].grade) / Math.max(rows[0].grade, 1e-9)) * 100).toFixed(0)}%
        · contained metal falls monotonically with the cut-off by construction, so the real trade is that raising it
        discards{" "}
        {(((rows[0].metal - rows[rows.length - 1].metal) / Math.max(rows[0].metal, 1)) * 100).toFixed(0)}% of the metal
        to gain that grade · the tonnage and the grade never peak together
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CutOffGrade — the break-even grade from costs, price and recovery.
 * It is arithmetic, and it is quoted as a policy number that nobody
 * can check, so it is computed here from its parts.
 * ------------------------------------------------------------------ */
export function CutOffGrade({
  scenarios,
  unit = "g/t",
  className = "",
}: {
  scenarios: {
    name: string
    /** price per unit of recovered metal, in the same unit as the grade */
    pricePerUnit: number
    recovery: number
    miningCostPerT: number
    processingCostPerT: number
    gaPerT?: number
    /** the grade actually being fed */
    feedGrade?: number
  }[]
  unit?: string
  className?: string
}) {
  const rows = scenarios.map((s) => {
    const cost = s.miningCostPerT + s.processingCostPerT + (s.gaPerT ?? 0)
    const valuePerGrade = s.pricePerUnit * s.recovery
    const cutoff = cost / Math.max(valuePerGrade, 1e-9)
    // the marginal cut-off ignores mining cost — the rock is already broken
    const marginal = (s.processingCostPerT + (s.gaPerT ?? 0)) / Math.max(valuePerGrade, 1e-9)
    const margin = s.feedGrade === undefined ? null : s.feedGrade * valuePerGrade - cost
    return { ...s, cost, cutoff, marginal, margin }
  })
  const max = Math.max(...rows.map((r) => Math.max(r.cutoff, r.feedGrade ?? 0))) * 1.15
  const profitable = rows.filter((r) => r.margin !== null && r.margin > 0)

  return (
    <div className={className}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {money(r.pricePerUnit)}/{unit.split("/")[0]} · {(r.recovery * 100).toFixed(0)}% recovery ·{" "}
                {money(r.cost)}/t
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="h-full rounded-[2px] bg-foreground/22" style={{ width: `${(r.cutoff / max) * 100}%` }} title={`break-even ${r.cutoff.toFixed(2)}`} />
              <span className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${(r.marginal / max) * 100}%` }} title={`marginal ${r.marginal.toFixed(2)}`} />
              {r.feedGrade !== undefined && (
                <span className="absolute inset-y-0 w-1 rounded-[1px] bg-foreground" style={{ left: `${clamp((r.feedGrade / max) * 100, 0, 99)}%` }} title={`feed ${r.feedGrade}`} />
              )}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              break-even {r.cutoff.toFixed(2)} {unit} · marginal {r.marginal.toFixed(2)}
              {r.feedGrade !== undefined
                ? ` · feed ${r.feedGrade.toFixed(2)} → ${r.margin! >= 0 ? "+" : ""}${money(r.margin!)}/t`
                : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The cut-off is ARITHMETIC — total cost divided by price times recovery — and the thin mark is the MARGINAL
        cut-off, which drops mining cost because that rock is already broken and hauled · the gap between the two is the
        grade band worth processing but not worth mining for ·{" "}
        {profitable.length} of {rows.filter((r) => r.margin !== null).length} scenarios with a stated feed grade make
        money at it
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * StrippingRatio — waste over ore, by bench, with the INCREMENTAL
 * ratio derived. A life-of-mine average of 3:1 is fine right up to
 * the bench that is 9:1 on its own.
 * ------------------------------------------------------------------ */
export function StrippingRatio({
  benches,
  className = "",
}: {
  /** benches from the top down */
  benches: { name: string; oreT: number; wasteT: number }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!benches.length) return null

  let cumOre = 0
  let cumWaste = 0
  const rows = benches.map((b) => {
    cumOre += b.oreT
    cumWaste += b.wasteT
    return { ...b, ratio: b.wasteT / Math.max(b.oreT, 1e-9), cumRatio: cumWaste / Math.max(cumOre, 1e-9) }
  })
  const lom = cumWaste / Math.max(cumOre, 1e-9)
  const max = Math.max(...rows.map((r) => r.ratio)) * 1.1
  const worst = rows.reduce((a, r) => (r.ratio > a.ratio ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {(r.oreT / 1e6).toFixed(2)} Mt ore · {(r.wasteT / 1e6).toFixed(2)} Mt waste
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(r.ratio / max) * 100}%`,
                  background: r.ratio > lom ? "currentColor" : "color-mix(in oklch, currentColor 42%, transparent)",
                }}
                title={`${r.ratio.toFixed(2)}:1`}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(lom / max) * 100}%` }} title={`life of mine ${lom.toFixed(2)}:1`} />
              <span className="absolute inset-y-0 w-px bg-foreground/35" style={{ left: `${clamp((r.cumRatio / max) * 100, 0, 100)}%` }} title={`cumulative ${r.cumRatio.toFixed(2)}:1`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.ratio.toFixed(2)}:1 on this bench · {r.cumRatio.toFixed(2)}:1 cumulative
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The thick mark is the {lom.toFixed(2)}:1 life-of-mine ratio, which is the number that gets quoted, and the bars
        are what each bench actually costs · {worst.name} runs at {worst.ratio.toFixed(2)}:1 —{" "}
        {(worst.ratio / Math.max(lom, 1e-9)).toFixed(1)}× the average — and it is a single year of the schedule, paid
        in full · {rows.filter((r) => r.ratio > lom).length} of {rows.length} benches sit above the average, which is
        what an average made of unequal benches always does
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RecoveryCurve — mill recovery against feed grade. Recovery is not a
 * constant, and using a single number for it is how a plant misses
 * budget on ore that assayed exactly as forecast.
 * ------------------------------------------------------------------ */
export function RecoveryCurve({
  points,
  budgetRecovery,
  feedGrade,
  height = 190,
  className = "",
}: {
  /** plant data: feed grade against recovery achieved */
  points: { grade: number; recovery: number }[]
  /** the flat number the budget was built on */
  budgetRecovery?: number
  /** the grade currently being fed */
  feedGrade?: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!points.length) return null

  const pts = [...points].sort((a, b) => a.grade - b.grade)
  const lo = pts[0].grade
  const hi = pts[pts.length - 1].grade
  const rLo = Math.min(...pts.map((p) => p.recovery), budgetRecovery ?? 1)
  const rHi = Math.max(...pts.map((p) => p.recovery), budgetRecovery ?? 0)
  const pad = Math.max((rHi - rLo) * 0.2, 0.01)
  const px = (g: number) => ((g - lo) / Math.max(hi - lo, 1e-9)) * 100
  const py = (r: number) => 100 - ((r - (rLo - pad)) / (rHi - rLo + pad * 2)) * 100
  const at = (g: number) => {
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].grade >= g) {
        const a = pts[i - 1]
        const b = pts[i]
        return a.recovery + ((g - a.grade) * (b.recovery - a.recovery)) / Math.max(b.grade - a.grade, 1e-9)
      }
    }
    return pts[pts.length - 1].recovery
  }
  const atFeed = feedGrade === undefined ? null : at(clamp(feedGrade, lo, hi))
  const shortfall = atFeed !== null && budgetRecovery !== undefined ? atFeed - budgetRecovery : null

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {budgetRecovery !== undefined && <line x1={0} y1={py(budgetRecovery)} x2={100} y2={py(budgetRecovery)} stroke="currentColor" strokeWidth={1} strokeDasharray="4 2" />}
          <polyline points={pts.map((p) => `${px(p.grade)},${py(p.recovery)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
        {pts.map((p) => (
          <span
            key={p.grade}
            className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
            style={{ left: `${px(p.grade)}%`, top: `${py(p.recovery)}%` }}
            title={`${p.grade} → ${(p.recovery * 100).toFixed(1)}%`}
          />
        ))}
        {feedGrade !== undefined && atFeed !== null && (
          <>
            <span className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${clamp(px(feedGrade), 0, 100)}%` }} />
            <span
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-background"
              style={{ left: `${clamp(px(feedGrade), 0, 100)}%`, top: `${py(atFeed)}%` }}
              title={`at ${feedGrade}: ${(atFeed * 100).toFixed(1)}%`}
            />
          </>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{lo} feed grade</span>
        {budgetRecovery !== undefined && <span>budget {(budgetRecovery * 100).toFixed(1)}%</span>}
        <span>{hi}</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Recovery is a FUNCTION of feed grade, not a constant — the dashed line is the single number a budget is usually
        built on ·{" "}
        {atFeed === null
          ? `the curve runs from ${(pts[0].recovery * 100).toFixed(1)}% to ${(pts[pts.length - 1].recovery * 100).toFixed(1)}% across the grades this plant has actually seen`
          : `at a ${feedGrade} feed the plant returns ${(atFeed * 100).toFixed(1)}%${shortfall === null ? "" : `, which is ${Math.abs(shortfall * 100).toFixed(1)} points ${shortfall < 0 ? "BELOW" : "above"} budget`}`}{" "}
        · ore that assayed exactly as forecast still misses, because the grade fell and the recovery went with it
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DrillLog — assay intervals down a hole, with the composited grade
 * over the reported intersection derived. A press release quotes the
 * composite; the log is where the composite comes from.
 * ------------------------------------------------------------------ */
export function DrillLog({
  holes,
  cutoff,
  unit = "g/t",
  height = 210,
  className = "",
}: {
  holes: { name: string; intervals: { fromM: number; toM: number; grade: number }[] }[]
  /** the grade at or above which an interval counts towards the intersection */
  cutoff: number
  unit?: string
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!holes.length) return null

  const rows = holes.map((h) => {
    const ints = [...h.intervals].sort((a, b) => a.fromM - b.fromM)
    const ore = ints.filter((i) => i.grade >= cutoff)
    const length = ore.reduce((a, i) => a + (i.toM - i.fromM), 0)
    const weighted = ore.reduce((a, i) => a + i.grade * (i.toM - i.fromM), 0)
    const first = ore[0]
    const last = ore[ore.length - 1]
    return {
      ...h,
      ints,
      length,
      composite: length > 0 ? weighted / length : 0,
      fromM: first?.fromM ?? 0,
      toM: last?.toM ?? 0,
      depth: Math.max(...ints.map((i) => i.toM)),
    }
  })
  const deepest = Math.max(...rows.map((r) => r.depth))
  const maxGrade = Math.max(cutoff, ...rows.flatMap((r) => r.ints.map((i) => i.grade)))
  const best = rows.reduce((a, r) => (r.composite * r.length > a.composite * a.length ? r : a), rows[0])

  return (
    <div className={className}>
      <div className="flex gap-3" style={{ height }}>
        {rows.map((r) => (
          <div key={r.name} className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[10px] font-medium">{r.name}</span>
            <div className="relative mt-0.5 flex-1 rounded-[2px] border border-foreground/25 bg-muted">
              {r.ints.map((i) => (
                <div
                  key={i.fromM}
                  className="absolute inset-x-0"
                  style={{
                    top: `${(i.fromM / deepest) * 100}%`,
                    height: `${((i.toM - i.fromM) / deepest) * 100}%`,
                    background: `color-mix(in oklch, currentColor ${clamp((i.grade / maxGrade) * 92, 3, 92).toFixed(0)}%, transparent)`,
                    outline: i.grade >= cutoff ? "1px solid currentColor" : undefined,
                    outlineOffset: -1,
                  }}
                  title={`${i.fromM}–${i.toM} m: ${i.grade.toFixed(2)} ${unit}`}
                />
              ))}
            </div>
            <span className="mt-0.5 text-[9px] tabular-nums text-muted-foreground">
              {r.length > 0 ? `${r.length.toFixed(0)} m @ ${r.composite.toFixed(2)}` : "no intersection"}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 m</span>
        <span>outlined ≥ {cutoff} {unit}</span>
        <span>{deepest} m</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The composite under each hole is LENGTH-WEIGHTED from the intervals at or above {cutoff} {unit}, which is the
        number a release quotes and the one nobody can check without the log · {best.name} is the best intersection at{" "}
        {best.length.toFixed(0)} m @ {best.composite.toFixed(2)} {unit} from {best.fromM} m · a mean of the interval
        grades would over-weight the short ones, which is the arithmetic error this chart exists to make impossible
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * BlockModel — a section through the model, with each block's VALUE
 * derived from grade, recovery and cost. Grade shading alone shows
 * where the metal is, not what is worth mining.
 * ------------------------------------------------------------------ */
export function BlockModel({
  blocks,
  pricePerUnit,
  recovery,
  costPerT,
  tonnesPerBlock,
  className = "",
}: {
  /** blocks on a regular grid: column, row from surface, grade */
  blocks: { col: number; row: number; grade: number }[]
  pricePerUnit: number
  recovery: number
  costPerT: number
  tonnesPerBlock: number
  className?: string
}) {
  const cols = Math.max(...blocks.map((b) => b.col)) + 1
  const rowCount = Math.max(...blocks.map((b) => b.row)) + 1
  const rows = blocks.map((b) => {
    const value = (b.grade * pricePerUnit * recovery - costPerT) * tonnesPerBlock
    return { ...b, value, ore: value > 0 }
  })
  const ore = rows.filter((r) => r.ore)
  const totalValue = ore.reduce((a, r) => a + r.value, 0)
  const maxV = Math.max(1, ...rows.map((r) => Math.abs(r.value)))
  const grid = Array.from({ length: rowCount }, (_, r) =>
    Array.from({ length: cols }, (_, c) => rows.find((b) => b.col === c && b.row === r) ?? null),
  )
  const breakEvenGrade = costPerT / Math.max(pricePerUnit * recovery, 1e-9)

  return (
    <div className={className}>
      <div className="space-y-px">
        {grid.map((line, ri) => (
          <div key={ri} className="flex gap-px">
            {line.map((b, ci) => (
              <div
                key={ci}
                className="relative aspect-square min-w-0 flex-1 rounded-[1px]"
                style={{
                  background: !b
                    ? "transparent"
                    : b.ore
                      ? `color-mix(in oklch, currentColor ${clamp((b.value / maxV) * 88 + 12, 12, 96).toFixed(0)}%, transparent)`
                      : "color-mix(in oklch, currentColor 7%, transparent)",
                  outline: b?.ore ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={b ? `${b.grade.toFixed(2)} → ${money(b.value)}` : ""}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>surface</span>
        <span>outlined blocks pay for themselves</span>
        <span>{rowCount} benches</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Ore blocks</dt>
          <dd className="font-medium tabular-nums">
            {ore.length}/{rows.length}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Break-even</dt>
          <dd className="font-medium tabular-nums">{breakEvenGrade.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ore tonnes</dt>
          <dd className="font-medium tabular-nums">{((ore.length * tonnesPerBlock) / 1e6).toFixed(2)} Mt</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Value</dt>
          <dd className="font-medium tabular-nums">{money(totalValue)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Shading is block VALUE, not grade — a block is outlined when {" "}
        {money(pricePerUnit)} a unit at {(recovery * 100).toFixed(0)}% recovery beats the {money(costPerT)}/t it costs
        to mine and treat it, which is a grade of {breakEvenGrade.toFixed(2)} · {ore.length} of {rows.length} blocks
        clear it · a grade-shaded section shows where the metal is and says nothing about which of it is ore
      </p>
    </div>
  )
}
