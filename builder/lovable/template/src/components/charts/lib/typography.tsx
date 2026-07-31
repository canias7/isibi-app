/**
 * Typography primitives — modular scale, kerning, x-height comparison,
 * measure, weight ramp and OpenType feature coverage.
 *
 * The ratios, the optical gaps, the characters-per-line and the effective
 * contrast between weights are all MEASURED or DERIVED — a type scale that
 * takes its own step sizes as props is a list, not a scale.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * ModularScale — sizes generated from a base and a ratio, so every step
 * is derived and the rounding error against the grid is visible.
 * ------------------------------------------------------------------ */
export function ModularScale({
  basePx,
  ratio,
  stepsUp = 5,
  stepsDown = 2,
  gridPx = 4,
  sample = "Handgloves",
  className = "",
}: {
  basePx: number
  ratio: number
  stepsUp?: number
  stepsDown?: number
  /** the baseline grid the sizes are meant to land on */
  gridPx?: number
  sample?: string
  className?: string
}) {
  const steps = Array.from({ length: stepsUp + stepsDown + 1 }, (_, i) => {
    const n = i - stepsDown
    const exact = basePx * Math.pow(ratio, n)
    const snapped = Math.round(exact / gridPx) * gridPx
    return { n, exact, snapped, drift: snapped - exact }
  }).reverse()
  const worst = steps.reduce((a, s) => (Math.abs(s.drift) > Math.abs(a.drift) ? s : a), steps[0])

  return (
    <div className={className}>
      <ul className="space-y-1">
        {steps.map((s) => (
          <li key={s.n} className="flex items-baseline gap-3 overflow-hidden">
            <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {s.n === 0 ? "base" : s.n > 0 ? `+${s.n}` : s.n}
            </span>
            {/* clipped, not ellipsised: an ellipsis on the biggest step reads as a
                broken component, where a clean clip reads as "this one is large" */}
            <span
              className="min-w-0 flex-1 overflow-hidden whitespace-nowrap leading-none"
              style={{ fontSize: clamp(s.exact, 6, 40), fontWeight: s.n === 0 ? 600 : 400 }}
            >
              {sample}
            </span>
            <span className="w-28 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {s.exact.toFixed(1)} → {s.snapped}px
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Base {basePx}px × {ratio} · every size is generated, not chosen · snapping to a {gridPx}px grid moves step{" "}
        {worst.n > 0 ? `+${worst.n}` : worst.n} by {Math.abs(worst.drift).toFixed(1)}px, which is where a scale stops
        being a ratio
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * KerningPairs — the optical gap in troublesome pairs, with the
 * correction expressed as the fraction of an em it actually is.
 * ------------------------------------------------------------------ */
export function KerningPairs({
  pairs,
  sizePx = 44,
  className = "",
}: {
  pairs: { pair: string; defaultEm: number; kernedEm: number }[]
  sizePx?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!pairs.length) return null

  const rows = pairs.map((p) => ({ ...p, delta: p.kernedEm - p.defaultEm }))
  const worst = rows.reduce((a, r) => (Math.abs(r.delta) > Math.abs(a.delta) ? r : a), rows[0])
  const maxAbs = Math.max(0.001, ...rows.map((r) => Math.abs(r.delta)))

  return (
    <div className={className}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.pair} className="flex items-center gap-3">
            <div className="flex w-32 shrink-0 items-baseline gap-3">
              <span style={{ fontSize: sizePx, letterSpacing: `${r.defaultEm}em`, lineHeight: 1 }}>{r.pair}</span>
              <span style={{ fontSize: sizePx, letterSpacing: `${r.kernedEm}em`, lineHeight: 1, fontWeight: 500 }}>{r.pair}</span>
            </div>
            <div className="relative h-3 flex-1 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/40" />
              <div
                className="absolute inset-y-0.5 rounded-[1px] bg-foreground"
                style={{
                  left: r.delta >= 0 ? "50%" : `${50 - (Math.abs(r.delta) / maxAbs) * 46}%`,
                  width: `${(Math.abs(r.delta) / maxAbs) * 46}%`,
                }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {r.delta >= 0 ? "+" : "−"}
              {Math.abs(r.delta * 1000).toFixed(0)}/1000 em
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Left of each pair is unkerned, right is corrected · {worst.pair} needs the most at{" "}
        {Math.abs(worst.delta * 1000).toFixed(0)}/1000 em, which is {(Math.abs(worst.delta) * sizePx).toFixed(1)}px at{" "}
        {sizePx}px and invisible at 12
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * XHeightCompare — the same point size across families, showing why
 * point size alone never matches optical size.
 * ------------------------------------------------------------------ */
export function XHeightCompare({
  families,
  sizePx = 40,
  className = "",
}: {
  /** ratios are fractions of the em: x-height, cap height, ascender */
  families: { name: string; stack: string; xHeight: number; capHeight: number; ascender: number }[]
  className?: string
  sizePx?: number
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!families.length) return null

  const maxX = Math.max(...families.map((f) => f.xHeight))
  const minX = Math.min(...families.map((f) => f.xHeight))
  const spread = ((maxX - minX) / minX) * 100
  const biggest = families.reduce((a, f) => (f.xHeight > a.xHeight ? f : a), families[0])
  const smallest = families.reduce((a, f) => (f.xHeight < a.xHeight ? f : a), families[0])

  return (
    <div className={className}>
      <ul className="space-y-3">
        {families.map((f) => (
          <li key={f.name}>
            <div className="flex items-baseline justify-between text-[10px] text-muted-foreground">
              <span>{f.name}</span>
              <span className="tabular-nums">
                x {(f.xHeight * 100).toFixed(0)}% · cap {(f.capHeight * 100).toFixed(0)}% of em
              </span>
            </div>
            <div className="relative mt-0.5" style={{ height: sizePx * 1.25 }}>
              {/* baseline, x-height and cap-height rules, drawn from the metrics */}
              <div className="absolute inset-x-0 border-t border-foreground/40" style={{ bottom: sizePx * 0.25 }} />
              <div className="absolute inset-x-0 border-t border-dashed border-foreground/30" style={{ bottom: sizePx * 0.25 + f.xHeight * sizePx }} />
              <div className="absolute inset-x-0 border-t border-dotted border-foreground/25" style={{ bottom: sizePx * 0.25 + f.capHeight * sizePx }} />
              <span
                className="absolute left-0 leading-none"
                style={{ bottom: sizePx * 0.25, fontFamily: f.stack, fontSize: sizePx }}
              >
                Hamburgefonstiv
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        All set at {sizePx}px · solid rule is the baseline, dashed is x-height, dotted is cap height ·{" "}
        {biggest.name} reads {spread.toFixed(0)}% larger than {smallest.name} at the same point size, which is why
        matching sizes across families never matches optically
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * LineLength — characters per line at each column width, against the
 * readable band. The count is MEASURED from the average character
 * width, not stated.
 * ------------------------------------------------------------------ */
export function LineLength({
  columns,
  fontSizePx,
  averageCharWidthEm = 0.5,
  comfortable = { low: 45, high: 75 },
  className = "",
}: {
  columns: { name: string; widthPx: number }[]
  fontSizePx: number
  averageCharWidthEm?: number
  comfortable?: { low: number; high: number }
  className?: string
}) {
  const charPx = fontSizePx * averageCharWidthEm
  const rows = columns.map((c) => {
    const cpl = c.widthPx / charPx
    return { ...c, cpl, ok: cpl >= comfortable.low && cpl <= comfortable.high }
  })
  const axis = Math.max(comfortable.high * 1.25, ...rows.map((r) => r.cpl)) * 1.05
  const px = (v: number) => (v / axis) * 100
  const fix = rows.filter((r) => !r.ok)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span>{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.widthPx}px → {r.cpl.toFixed(0)} characters
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 bg-foreground/12"
                style={{ left: `${px(comfortable.low)}%`, width: `${px(comfortable.high) - px(comfortable.low)}%` }}
              />
              <div
                className="absolute inset-y-1 rounded-[1px]"
                style={{
                  left: 0,
                  width: `${px(r.cpl)}%`,
                  background: r.ok ? "currentColor" : "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: r.ok ? undefined : "1px solid currentColor",
                  outlineOffset: -1,
                }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground">
              <span aria-hidden>{r.ok ? "✓" : "✗"}</span>{" "}
              {r.ok ? "inside the comfortable band" : r.cpl < comfortable.low ? "too short — the eye returns constantly" : "too long — the eye loses the next line"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Shaded band is {comfortable.low}–{comfortable.high} characters at {fontSizePx}px ·{" "}
        {fix.length
          ? `${fix.length} column${fix.length === 1 ? "" : "s"} outside it — the fix is the type size or the measure, never the line height`
          : "every column falls inside it"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * WeightRamp — the family's weights with the perceptual step between
 * adjacent ones derived, because the numbers are not evenly spaced in
 * how they look.
 * ------------------------------------------------------------------ */
export function WeightRamp({
  weights,
  stack,
  sample = "Aa",
  className = "",
}: {
  /** the numeric weights available, and the stem width each one draws */
  weights: { weight: number; stemPx?: number }[]
  stack?: string
  sample?: string
  className?: string
}) {
  const sorted = [...weights].sort((a, b) => a.weight - b.weight)
  // stem width, where it is measured, is the honest axis; without it fall back
  // to the numeric weight, and say which one is being used
  const measured = sorted.every((w) => w.stemPx !== undefined)
  const value = (w: (typeof sorted)[number]) => (measured ? (w.stemPx as number) : w.weight)
  const gaps = sorted.map((w, i) => (i === 0 ? null : value(w) - value(sorted[i - 1])))
  const usable = gaps.filter((g): g is number => g !== null)
  const meanGap = usable.reduce((a, g) => a + g, 0) / Math.max(1, usable.length)
  const tightest = usable.length ? Math.min(...usable) : 0
  const tightIdx = gaps.findIndex((g) => g === tightest)

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {sorted.map((w, i) => (
          <li key={w.weight} className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-[10px] tabular-nums text-muted-foreground">{w.weight}</span>
            <span className="w-16 shrink-0 text-2xl leading-none" style={{ fontFamily: stack, fontWeight: w.weight }}>
              {sample}
            </span>
            <div className="h-4 flex-1 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px] bg-foreground"
                style={{ width: `${(value(w) / value(sorted[sorted.length - 1])) * 100}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {i === 0 ? "—" : `+${(gaps[i] as number).toFixed(measured ? 2 : 0)} from ${sorted[i - 1].weight}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Bars are {measured ? "measured stem width" : "the numeric weight, which is a name and not a measurement"} · the
        step from {sorted[Math.max(0, tightIdx - 1)]?.weight} to {sorted[tightIdx]?.weight} is the tightest at{" "}
        {tightest.toFixed(measured ? 2 : 0)} against a mean of {meanGap.toFixed(measured ? 2 : 0)} — adjacent weights
        that close together will not read as different on a screen
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * OpentypeFeatures — which features each face in the family actually
 * ships. The gaps are the point.
 * ------------------------------------------------------------------ */
export function OpentypeFeatures({
  faces,
  features,
  supported,
  className = "",
}: {
  faces: string[]
  features: { tag: string; name: string }[]
  /** supported[face][feature] */
  supported: boolean[][]
  className?: string
}) {
  const perFeature = features.map((_, fi) => faces.filter((_, ai) => supported[ai]?.[fi]).length)
  const perFace = faces.map((_, ai) => features.filter((_, fi) => supported[ai]?.[fi]).length)
  const universal = features.filter((_, fi) => perFeature[fi] === faces.length).length
  const partial = features.filter((_, fi) => perFeature[fi] > 0 && perFeature[fi] < faces.length)

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px]">
          <thead>
            <tr>
              <th className="pr-1.5 pb-1 text-left font-normal text-muted-foreground">feature</th>
              {faces.map((f) => (
                <th key={f} className="px-0.5 pb-1 text-center font-medium">
                  <span className="block max-w-[3.5rem] truncate">{f}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((ft, fi) => (
              <tr key={ft.tag}>
                <th className="pr-1.5 text-left font-normal whitespace-nowrap">
                  <span className="font-mono">{ft.tag}</span> <span className="text-muted-foreground">{ft.name}</span>
                </th>
                {faces.map((f, ai) => {
                  const on = !!supported[ai]?.[fi]
                  return (
                    <td key={f} className="p-px">
                      <div
                        className="flex h-5 items-center justify-center rounded-[2px] border border-foreground/25"
                        style={{ background: on ? "color-mix(in oklch, currentColor 28%, transparent)" : "transparent" }}
                      >
                        <span aria-hidden>{on ? "✓" : "·"}</span>
                        <span className="sr-only">
                          {ft.name} {on ? "supported" : "missing"} in {f}
                        </span>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <th className="pt-1 pr-1.5 text-left font-medium">total</th>
              {perFace.map((c, i) => (
                <td key={faces[i]} className="pt-1 text-center text-[10px] font-medium tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {universal} of {features.length} features are in every face ·{" "}
        {partial.length
          ? `${partial.map((p) => p.tag).join(", ")} ${partial.length === 1 ? "is" : "are"} only in some, which is the kind of gap that shows up as one weight rendering differently from the rest`
          : "nothing is partially supported, so a feature set works across the whole family"}
      </p>
    </div>
  )
}
