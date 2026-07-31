/**
 * Print-production primitives — ink coverage, dot gain, tone reproduction,
 * imposition, makeready and spoilage.
 *
 * Coverage per sheet, the gain curve against the aim, the total area
 * reproduction, how many pages actually fit a sheet, the cost of a makeready
 * spread over the run, and the break-even run length are all DERIVED. A cost
 * per copy stated as a prop cannot show where short runs stop paying.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) => "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/* ------------------------------------------------------------------ *
 * InkCoverage — area coverage per separation, with the total area
 * coverage summed because that, not any single channel, is what the
 * press has to dry.
 * ------------------------------------------------------------------ */
export function InkCoverage({
  separations,
  maxTotalArea = 300,
  className = "",
}: {
  /** mean area coverage of each separation, as a percentage */
  separations: { name: string; percent: number }[]
  /** the total-area-coverage limit for this stock and press */
  maxTotalArea?: number
  className?: string
}) {
  const total = separations.reduce((a, s) => a + s.percent, 0)
  const heaviest = separations.reduce((a, s) => (s.percent > a.percent ? s : a), separations[0])
  const over = total > maxTotalArea
  const max = Math.max(100, ...separations.map((s) => s.percent))

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {separations.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-[11px]">{s.name}</span>
            <div className="h-4 flex-1 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(s.percent / max) * 100}%`,
                  background: i % 2 === 0 ? "color-mix(in oklch, currentColor 52%, transparent)" : "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)",
                }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-[11px] tabular-nums">{s.percent.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
      <div className="mt-2">
        <div className="flex items-baseline justify-between text-[11px]">
          <span className="font-medium">Total area coverage</span>
          <span className="tabular-nums text-muted-foreground">
            {total.toFixed(0)}% against a {maxTotalArea}% limit
          </span>
        </div>
        <div className="relative mt-0.5 h-5 rounded-[2px] bg-muted">
          <div
            className="h-full rounded-[2px]"
            style={{
              width: `${clamp((total / (maxTotalArea * 1.3)) * 100, 0, 100)}%`,
              background: over ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 46%, transparent)",
              outline: over ? "1px solid currentColor" : undefined,
              outlineOffset: -1,
            }}
          />
          <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${(1 / 1.3) * 100}%` }} />
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        {heaviest.name} is the heaviest single separation at {heaviest.percent.toFixed(0)}%, but it is the SUM that
        decides whether the sheet dries ·{" "}
        {over
          ? `${(total - maxTotalArea).toFixed(0)} points over the limit — expect set-off and a slow run, whatever any one channel reads`
          : `${(maxTotalArea - total).toFixed(0)} points of headroom`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DotGain — measured gain against the aim curve, with the correction
 * needed at each patch derived.
 * ------------------------------------------------------------------ */
export function DotGain({
  patches,
  aimAt50 = 18,
  height = 200,
  className = "",
}: {
  /** the tint on the plate and what it measured on the sheet */
  patches: { fileTint: number; measured: number }[]
  /** the process aim for gain at the 50% patch */
  aimAt50?: number
  height?: number
  className?: string
}) {
  // the aim curve is a parabola through 0 and 100 peaking at the stated gain
  const aim = (t: number) => t + aimAt50 * 4 * (t / 100) * (1 - t / 100)
  const rows = [...patches]
    .sort((a, b) => a.fileTint - b.fileTint)
    .map((p) => ({ ...p, gain: p.measured - p.fileTint, aimGain: aim(p.fileTint) - p.fileTint, error: p.measured - aim(p.fileTint) }))
  const worst = rows.reduce((a, r) => (Math.abs(r.error) > Math.abs(a.error) ? r : a), rows[0])
  const maxGain = Math.max(...rows.map((r) => Math.max(Math.abs(r.gain), Math.abs(r.aimGain)))) * 1.15
  const px = (t: number) => t
  const py = (g: number) => 50 - (g / maxGain) * 46
  const inTolerance = rows.filter((r) => Math.abs(r.error) <= 3).length

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={50} x2={100} y2={50} stroke="currentColor" strokeWidth={0.4} opacity={0.45} />
          <polyline
            points={Array.from({ length: 51 }, (_, i) => `${px(i * 2)},${py(aim(i * 2) - i * 2)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="4 2"
            opacity={0.65}
            vectorEffect="non-scaling-stroke"
          />
          <polyline points={rows.map((r) => `${px(r.fileTint)},${py(r.gain)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="pointer-events-none absolute inset-0">
          {rows.map((r) => (
            <span
              key={r.fileTint}
              className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
              style={{ left: `${px(r.fileTint)}%`, top: `${py(r.gain)}%` }}
              title={`${r.fileTint}% → ${r.measured.toFixed(1)}%, gain ${r.gain.toFixed(1)}`}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0% tint</span>
        <span>100%</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Gain at 50</dt>
          <dd className="font-medium tabular-nums">
            {(rows.reduce((a, r) => (Math.abs(r.fileTint - 50) < Math.abs(a.fileTint - 50) ? r : a), rows[0]).gain).toFixed(1)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Aim</dt>
          <dd className="font-medium tabular-nums">{aimAt50}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">In tolerance</dt>
          <dd className="font-medium tabular-nums">
            {inTolerance}/{rows.length}
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Dashed is the aim curve, solid is measured, both plotted as GAIN rather than as tint — a tint-against-tint plot
        is a straight line and hides everything ·{" "}
        {Math.abs(worst.error) <= 3
          ? "every patch is within three points of aim"
          : `worst at the ${worst.fileTint}% patch, ${worst.error > 0 ? "+" : "−"}${Math.abs(worst.error).toFixed(1)} from aim, which is where the curve correction goes`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ToneCurve — input to output density, with the contrast in each
 * quarter-tone derived so a curve that crushes shadows is visible.
 * ------------------------------------------------------------------ */
export function ToneCurve({
  points,
  height = 210,
  className = "",
}: {
  /** input and output, both 0–100 */
  points: { input: number; output: number }[]
  height?: number
  className?: string
}) {
  const sorted = [...points].sort((a, b) => a.input - b.input)
  const at = (x: number) => {
    const i = sorted.findIndex((p) => p.input >= x)
    if (i <= 0) return sorted[0]?.output ?? 0
    const a = sorted[i - 1]
    const b = sorted[i]
    return a.output + ((b.output - a.output) * (x - a.input)) / Math.max(b.input - a.input, 1e-9)
  }
  const quarters = [
    { name: "Highlights", from: 0, to: 25 },
    { name: "Upper mid", from: 25, to: 50 },
    { name: "Lower mid", from: 50, to: 75 },
    { name: "Shadows", from: 75, to: 100 },
  ].map((q) => ({ ...q, slope: (at(q.to) - at(q.from)) / (q.to - q.from) }))
  const crushed = quarters.filter((q) => q.slope < 0.6)
  const stretched = quarters.filter((q) => q.slope > 1.4)

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height, aspectRatio: "1 / 1", maxWidth: height }}>
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <line x1={0} y1={100} x2={100} y2={0} stroke="currentColor" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.45} />
          {[25, 50, 75].map((g) => (
            <g key={g}>
              <line x1={g} y1={0} x2={g} y2={100} stroke="currentColor" strokeWidth={0.3} opacity={0.2} />
              <line x1={0} y1={g} x2={100} y2={g} stroke="currentColor" strokeWidth={0.3} opacity={0.2} />
            </g>
          ))}
          <polyline points={sorted.map((p) => `${p.input},${100 - p.output}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <ul className="mt-2 space-y-1">
        {quarters.map((q) => (
          <li key={q.name} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-[11px]">{q.name}</span>
            <div className="relative h-3.5 flex-1 rounded-[2px] bg-muted">
              <span className="absolute inset-y-0 w-px bg-foreground/60" style={{ left: `${(1 / 2.2) * 100}%` }} title="unity slope" />
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${clamp((q.slope / 2.2) * 100, 1, 100)}%`,
                  background: q.slope < 0.6 || q.slope > 1.4 ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 46%, transparent)",
                }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              slope {q.slope.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The tick on each bar is unity — a slope below it compresses that quarter and above it expands it, and the four
        must average to one, so every expansion is paid for somewhere ·{" "}
        {crushed.length
          ? `${crushed.map((q) => q.name.toLowerCase()).join(" and ")} compressed to buy ${stretched.map((q) => q.name.toLowerCase()).join(" and ") || "the rest"}`
          : "no quarter is materially compressed"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Imposition — how many pages actually fit a press sheet once trim and
 * gripper are taken off. The waste is what the calculation is for.
 * ------------------------------------------------------------------ */
export function Imposition({
  sheet,
  page,
  gripperMm = 12,
  trimMm = 3,
  className = "",
}: {
  sheet: { widthMm: number; heightMm: number }
  page: { widthMm: number; heightMm: number }
  gripperMm?: number
  trimMm?: number
  className?: string
}) {
  const usable = { w: sheet.widthMm - gripperMm, h: sheet.heightMm }
  const pw = page.widthMm + trimMm * 2
  const ph = page.heightMm + trimMm * 2
  const fit = (w: number, h: number) => Math.floor(usable.w / w) * Math.floor(usable.h / h)
  const upright = fit(pw, ph)
  const rotated = fit(ph, pw)
  const best = Math.max(upright, rotated)
  const rotate = rotated > upright
  const cols = Math.floor(usable.w / (rotate ? ph : pw))
  const rows = Math.floor(usable.h / (rotate ? pw : ph))
  const usedArea = best * pw * ph
  const sheetArea = sheet.widthMm * sheet.heightMm
  const waste = 1 - usedArea / sheetArea

  return (
    <div className={className}>
      <div
        className="relative mx-auto border border-foreground/45 bg-muted"
        style={{ aspectRatio: `${sheet.widthMm} / ${sheet.heightMm}`, maxWidth: 260 }}
      >
        <div className="absolute inset-y-0 left-0 bg-foreground/12" style={{ width: `${(gripperMm / sheet.widthMm) * 100}%` }} title={`${gripperMm} mm gripper`} />
        <div
          className="absolute grid"
          style={{
            left: `${(gripperMm / sheet.widthMm) * 100}%`,
            top: 0,
            width: `${((cols * (rotate ? ph : pw)) / sheet.widthMm) * 100}%`,
            height: `${((rows * (rotate ? pw : ph)) / sheet.heightMm) * 100}%`,
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
        >
          {Array.from({ length: cols * rows }, (_, i) => (
            <span key={i} className="border border-foreground/30 bg-background" />
          ))}
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Pages up</dt>
          <dd className="font-medium tabular-nums">
            {best} ({cols}×{rows})
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Orientation</dt>
          <dd className="font-medium tabular-nums">{rotate ? "rotated" : "upright"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Sheet waste</dt>
          <dd className="font-medium tabular-nums">{(waste * 100).toFixed(0)}%</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {sheet.widthMm}×{sheet.heightMm} mm sheet, {page.widthMm}×{page.heightMm} mm page plus {trimMm} mm trim all
        round, {gripperMm} mm off the edge for the gripper ·{" "}
        {rotate
          ? `rotating the page gives ${rotated} up against ${upright} upright, which is ${rotated - upright} more per sheet`
          : `upright gives ${upright} up against ${rotated} rotated`}{" "}
        · {(waste * 100).toFixed(0)}% of the sheet is bought and thrown away
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Makeready — the fixed cost spread over the run, so the break-even
 * against a digital alternative is SOLVED rather than asserted.
 * ------------------------------------------------------------------ */
export function Makeready({
  setupCost,
  runCostPerCopy,
  digitalCostPerCopy,
  maxRun,
  height = 200,
  className = "",
}: {
  setupCost: number
  runCostPerCopy: number
  /** the per-copy price with no setup at all */
  digitalCostPerCopy: number
  maxRun: number
  height?: number
  className?: string
}) {
  const breakEven = digitalCostPerCopy > runCostPerCopy ? setupCost / (digitalCostPerCopy - runCostPerCopy) : Infinity
  const points = Array.from({ length: 60 }, (_, i) => {
    const n = Math.max(1, Math.round((maxRun * (i + 1)) / 60))
    return { n, litho: setupCost / n + runCostPerCopy, digital: digitalCostPerCopy }
  })
  const maxCost = Math.max(points[0].litho, digitalCostPerCopy) * 1.05
  const px = (n: number) => (n / maxRun) * 100
  const py = (c: number) => 100 - (c / maxCost) * 100

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(digitalCostPerCopy)} x2={100} y2={py(digitalCostPerCopy)} stroke="currentColor" strokeWidth={1.1} strokeDasharray="4 2" opacity={0.75} />
          <polyline points={points.map((p) => `${px(p.n)},${py(p.litho)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          {Number.isFinite(breakEven) && breakEven <= maxRun && (
            <line x1={px(breakEven)} y1={0} x2={px(breakEven)} y2={100} stroke="currentColor" strokeWidth={0.5} opacity={0.6} />
          )}
        </svg>
        {Number.isFinite(breakEven) && breakEven <= maxRun && (
          <span
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground bg-background"
            style={{ left: `${px(breakEven)}%`, top: `${py(digitalCostPerCopy)}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>1 copy</span>
        <span>{maxRun.toLocaleString()}</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Makeready</dt>
          <dd className="font-medium tabular-nums">{money(setupCost)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Break-even run</dt>
          <dd className="font-medium tabular-nums">
            {Number.isFinite(breakEven) ? Math.ceil(breakEven).toLocaleString() : "never"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">At {maxRun.toLocaleString()}</dt>
          <dd className="font-medium tabular-nums">{money(setupCost / maxRun + runCostPerCopy)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Dashed is the digital price, which has no setup and therefore no curve · litho only beats it past{" "}
        {Number.isFinite(breakEven) ? `${Math.ceil(breakEven).toLocaleString()} copies` : "any run length, at these rates"}{" "}
        — the makeready is the whole argument, and it is a fixed cost divided by a number the customer chooses
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Spoilage — waste by cause across the run, with the sheets that must
 * be over-ordered derived from it.
 * ------------------------------------------------------------------ */
export function Spoilage({
  netCopies,
  causes,
  className = "",
}: {
  netCopies: number
  /** each cause as a percentage of the good sheets it spoils */
  causes: { name: string; percent: number; fixed?: number }[]
  className?: string
}) {
  // Worked BACKWARDS from the copies wanted: each stage spoils a share of what
  // reaches it plus a fixed number of sheets, so what has to arrive at that
  // stage is (what must leave it + its fixed loss) / (1 − its rate). Summing the
  // percentages instead understates the paper to buy, and by more the longer
  // the chain.
  let leaving = netCopies
  const stages = [...causes].reverse().map((c) => {
    const arriving = (leaving + (c.fixed ?? 0)) / Math.max(1 - c.percent / 100, 1e-6)
    const spoiled = arriving - leaving
    leaving = arriving
    return { ...c, arriving, spoiled }
  })
  const gross = Math.ceil(leaving)
  const totalSpoil = gross - netCopies
  const perCause = stages.slice().reverse()
  const max = Math.max(1, ...perCause.map((c) => c.spoiled))
  const naive = causes.reduce((a, c) => a + (netCopies * c.percent) / 100 + (c.fixed ?? 0), 0)

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {perCause
          .slice()
          .sort((a, b) => b.spoiled - a.spoiled)
          .map((c) => (
            <li key={c.name} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate text-[11px]">{c.name}</span>
              <div className="h-4 flex-1 rounded-[2px] bg-muted">
                <div className="h-full rounded-[2px] bg-foreground/55" style={{ width: `${(c.spoiled / max) * 100}%` }} />
              </div>
              <span className="w-32 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                {c.percent}%{c.fixed ? ` + ${c.fixed}` : ""} · {Math.round(c.spoiled).toLocaleString()} sheets
              </span>
            </li>
          ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Net wanted</dt>
          <dd className="font-medium tabular-nums">{netCopies.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Order gross</dt>
          <dd className="font-medium tabular-nums">{gross.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Overs</dt>
          <dd className="font-medium tabular-nums">
            {totalSpoil.toLocaleString()} ({((totalSpoil / Math.max(netCopies, 1)) * 100).toFixed(1)}%)
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Spoilage COMPOUNDS: worked back from {netCopies.toLocaleString()} through {causes.length} stages it needs{" "}
        {totalSpoil.toLocaleString()} overs, where adding the percentages up gives {Math.round(naive).toLocaleString()}{" "}
        — {(totalSpoil - naive).toFixed(0)} sheets of paper the simple sum would not have bought · the fixed sheets
        dominate on a short run, which is why a 500-copy job orders proportionally far more than a 50,000-copy one
      </p>
    </div>
  )
}
