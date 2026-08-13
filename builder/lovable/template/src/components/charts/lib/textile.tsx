/**
 * Textile primitives — yarn count conversions, fabric weight, shrinkage,
 * colour fastness, seam strength and the cutting plan.
 *
 * Tex from Ne and Nm, GSM from the construction, residual shrinkage after each
 * wash, the fastness grade a use case demands, the seam efficiency against the
 * fabric it joins, and the marker utilisation are all DERIVED. Buying cloth off
 * a stated yield rather than a computed marker is how a cutting room runs out.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * YarnCount — the same yarn in every system, converted rather than
 * tabulated, so a spec sheet mixing systems can be checked.
 * ------------------------------------------------------------------ */
export function YarnCount({
  yarns,
  className = "",
}: {
  /** state ONE system; the rest are derived */
  yarns: { name: string; tex?: number; ne?: number; nm?: number; denier?: number }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!yarns.length) return null

  const rows = yarns.map((y) => {
    const tex = y.tex ?? (y.ne ? 590.5 / y.ne : y.nm ? 1000 / y.nm : y.denier ? y.denier / 9 : 0)
    return {
      ...y,
      tex,
      ne: 590.5 / Math.max(tex, 1e-9),
      nm: 1000 / Math.max(tex, 1e-9),
      denier: tex * 9,
      given: y.tex !== undefined ? "tex" : y.ne !== undefined ? "Ne" : y.nm !== undefined ? "Nm" : "denier",
    }
  })
  const maxTex = Math.max(...rows.map((r) => r.tex))
  const finest = rows.reduce((a, r) => (r.tex < a.tex ? r : a), rows[0])
  const coarsest = rows.reduce((a, r) => (r.tex > a.tex ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">given as {r.given}</span>
            </div>
            <div className="mt-0.5 h-4 rounded-[2px] bg-muted">
              {/* tex is a DIRECT system: bigger number, thicker yarn — so the bar
                  can be read as thickness, which Ne and Nm invert */}
              <div className="h-full rounded-[2px] bg-foreground/55" style={{ width: `${(r.tex / maxTex) * 100}%` }} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.tex.toFixed(1)} tex · Ne {r.ne.toFixed(1)} · Nm {r.nm.toFixed(1)} · {r.denier.toFixed(0)} den
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Bars are tex, the only DIRECT system here — a bigger tex is a thicker yarn, where a bigger Ne is a finer one ·{" "}
        {finest.name} is the finest at {finest.tex.toFixed(1)} tex and {coarsest.name} the coarsest at{" "}
        {coarsest.tex.toFixed(1)}, a factor of {(coarsest.tex / Math.max(finest.tex, 1e-9)).toFixed(1)}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * FabricWeight — GSM computed from the construction, so a spec whose
 * yarn and sett cannot produce the stated weight is caught.
 * ------------------------------------------------------------------ */
export function FabricWeight({
  fabrics,
  className = "",
}: {
  fabrics: {
    name: string
    /** ends and picks per centimetre */
    endsPerCm: number
    picksPerCm: number
    warpTex: number
    weftTex: number
    /** take-up as a fraction, the yarn consumed by crimp */
    crimp?: number
    statedGsm?: number
  }[]
  className?: string
}) {
  const rows = fabrics.map((f) => {
    const crimp = 1 + (f.crimp ?? 0.06)
    // g/m² = ends/m × tex/1000 × crimp, plus the same for picks
    const warp = f.endsPerCm * 100 * (f.warpTex / 1000) * crimp
    const weft = f.picksPerCm * 100 * (f.weftTex / 1000) * crimp
    const gsm = warp + weft
    return { ...f, warp, weft, gsm, drift: f.statedGsm === undefined ? null : gsm - f.statedGsm }
  })
  const max = Math.max(...rows.map((r) => Math.max(r.gsm, r.statedGsm ?? 0)))
  const off = rows.filter((r) => r.drift !== null && Math.abs(r.drift) / Math.max(r.statedGsm ?? 1, 1) > 0.05)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.endsPerCm}×{r.picksPerCm}/cm · {r.warpTex}/{r.weftTex} tex
              </span>
            </div>
            <div className="relative mt-0.5 flex h-4 gap-px" style={{ width: `${(r.gsm / max) * 100}%` }}>
              <div className="rounded-l-[2px] bg-foreground" style={{ flex: `${r.warp} 0 0` }} title={`warp ${r.warp.toFixed(0)} g/m²`} />
              <div
                className="rounded-r-[2px] border border-foreground/50"
                style={{ flex: `${r.weft} 0 0`, background: "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)" }}
                title={`weft ${r.weft.toFixed(0)} g/m²`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.gsm.toFixed(0)} g/m² computed
              {r.statedGsm !== undefined ? ` against ${r.statedGsm} stated (${(r.drift ?? 0) >= 0 ? "+" : "−"}${Math.abs(r.drift ?? 0).toFixed(0)})` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Solid is warp, hatched is weft, both computed from sett and yarn count with take-up ·{" "}
        {off.length
          ? `${off.map((r) => r.name).join(", ")} ${off.length === 1 ? "is" : "are"} more than 5% off the stated weight — the construction cannot produce the number on the spec sheet`
          : "every fabric lands within 5% of its stated weight"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Shrinkage — residual shrinkage after each wash, with the total and
 * the point it stabilises derived.
 * ------------------------------------------------------------------ */
export function Shrinkage({
  samples,
  tolerance = 3,
  height = 200,
  className = "",
}: {
  /** dimensional change per wash, as a percentage, warp and weft */
  samples: { name: string; warp: number[]; weft: number[] }[]
  /** the acceptable total change */
  tolerance?: number
  height?: number
  className?: string
}) {
  // NOTHING TO DRAW IS NOT A CHART OF NOTHING. An empty array made every
  // scale here degenerate and wrote NaN into an SVG attribute, which the
  // browser drops — so the chart rendered as a blank box rather than as the
  // empty state the page around it is showing. `useRows` hands back `[]`
  // before the query settles and on every site whose owner has added nothing.
  if (!samples.length) return null

  const rows = samples.map((s) => {
    const cum = (arr: number[]) => arr.reduce<number[]>((a, v) => [...a, (a[a.length - 1] ?? 0) + v], [])
    const warpCum = cum(s.warp)
    const weftCum = cum(s.weft)
    const totalWarp = warpCum[warpCum.length - 1] ?? 0
    const totalWeft = weftCum[weftCum.length - 1] ?? 0
    // stabilised = the first wash after which no further wash moves it by 0.3%
    const stable = s.warp.findIndex((_, i) => i > 0 && s.warp.slice(i).every((v) => Math.abs(v) < 0.3) && s.weft.slice(i).every((v) => Math.abs(v) < 0.3))
    return { ...s, warpCum, weftCum, totalWarp, totalWeft, stable, fails: Math.max(Math.abs(totalWarp), Math.abs(totalWeft)) > tolerance }
  })
  const washes = Math.max(...samples.map((s) => s.warp.length))
  const extent = Math.max(tolerance * 1.4, ...rows.flatMap((r) => [...r.warpCum, ...r.weftCum].map(Math.abs)))
  // i = −1 is the unwashed origin: without it every trace starts mid-air
  const px = (i: number) => ((i + 1) / washes) * 100
  const py = (v: number) => 50 - (v / extent) * 46
  const failed = rows.filter((r) => r.fails)

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <rect x={0} y={py(tolerance)} width={100} height={py(-tolerance) - py(tolerance)} fill="currentColor" opacity={0.08} />
          <line x1={0} y1={50} x2={100} y2={50} stroke="currentColor" strokeWidth={0.4} opacity={0.45} />
          {rows.map((r) => (
            <g key={r.name}>
              <polyline points={`${px(-1)},${py(0)} ${r.warpCum.map((v, i) => `${px(i)},${py(v)}`).join(" ")}`} fill="none" stroke="currentColor" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
              <polyline points={`${px(-1)},${py(0)} ${r.weftCum.map((v, i) => `${px(i)},${py(v)}`).join(" ")}`} fill="none" stroke="currentColor" strokeWidth={1.1} strokeDasharray="4 2" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>unwashed</span>
        <span>wash {washes}</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span aria-hidden className="w-3">
              {r.fails ? "✗" : "✓"}
            </span>
            <span className="w-24 shrink-0 truncate">{r.name}</span>
            <span className="text-muted-foreground">
              warp {r.totalWarp.toFixed(1)}%, weft {r.totalWeft.toFixed(1)}% ·{" "}
              {r.stable > 0 ? `stable after wash ${r.stable}` : "still moving at the last wash"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Solid is warp, dashed is weft; the band is ±{tolerance}% · a garment is cut to the FINISHED size, so what
        matters is the total after it stabilises, not the first wash ·{" "}
        {failed.length ? `${failed.map((r) => r.name).join(", ")} exceed${failed.length === 1 ? "s" : ""} tolerance` : "every sample stays inside tolerance"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ColourFastness — grades against the minimum each end use demands.
 * The pass is derived per use, not per test.
 * ------------------------------------------------------------------ */
export function ColourFastness({
  tests,
  endUses,
  className = "",
}: {
  /** grades on the grey scale, 1 (worst) to 5 */
  tests: { name: string; grade: number }[]
  /** the minimum grade each end use requires for each test */
  endUses: { name: string; minimums: Record<string, number> }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!tests.length || !endUses.length) return null

  const byTest = new Map(tests.map((t) => [t.name, t.grade]))
  const rows = endUses.map((u) => {
    const failing = Object.entries(u.minimums).filter(([t, m]) => (byTest.get(t) ?? 0) < m)
    return { ...u, failing, passes: failing.length === 0 }
  })
  const worstTest = tests.reduce((a, t) => (t.grade < a.grade ? t : a), tests[0])
  const blocked = rows.filter((r) => !r.passes)

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {tests.map((t) => (
          <li key={t.name} className="flex items-center gap-2">
            <span className="w-32 shrink-0 truncate text-[11px]">{t.name}</span>
            <div className="flex flex-1 gap-px">
              {[1, 2, 3, 4, 5].map((g) => (
                <div
                  key={g}
                  className="h-4 flex-1 rounded-[1px] border border-foreground/25"
                  style={{ background: g <= t.grade ? `color-mix(in oklch, currentColor ${18 + g * 13}%, transparent)` : "transparent" }}
                  title={`grade ${g}`}
                />
              ))}
            </div>
            <span className="w-16 shrink-0 text-right text-[11px] tabular-nums">grade {t.grade}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-3 space-y-1 text-[10px]">
        {rows.map((r) => (
          <li key={r.name} className="flex items-start gap-2">
            <span aria-hidden className="w-3">
              {r.passes ? "✓" : "✗"}
            </span>
            <span className="w-24 shrink-0 truncate font-medium">{r.name}</span>
            <span className="text-muted-foreground">
              {r.passes
                ? `meets every minimum (${Object.entries(r.minimums).map(([t, m]) => `${t} ≥${m}`).join(", ")})`
                : `fails ${r.failing.map(([t, m]) => `${t} (${byTest.get(t) ?? 0} against ≥${m})`).join(", ")}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">
        A grade is not a pass on its own — the SAME cloth passes for one end use and fails for another, because each
        use sets its own minimum · {worstTest.name} is the weakest test at grade {worstTest.grade}, and it is what
        blocks {blocked.length ? blocked.map((r) => r.name.toLowerCase()).join(" and ") : "nothing here"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SeamStrength — seam strength as a fraction of the fabric it joins,
 * because an absolute number says nothing without the cloth.
 * ------------------------------------------------------------------ */
export function SeamStrength({
  fabricStrengthN,
  seams,
  minimumEfficiency = 0.8,
  className = "",
}: {
  fabricStrengthN: number
  seams: { name: string; strengthN: number; stitchesPerCm?: number }[]
  minimumEfficiency?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!seams.length) return null

  const rows = seams
    .map((s) => ({ ...s, efficiency: s.strengthN / Math.max(fabricStrengthN, 1e-9) }))
    .sort((a, b) => b.efficiency - a.efficiency)
  const max = Math.max(fabricStrengthN, ...rows.map((r) => r.strengthN)) * 1.04
  const failing = rows.filter((r) => r.efficiency < minimumEfficiency)
  const best = rows[0]

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-2">
        <span className="w-28 shrink-0 text-[11px] font-medium">Fabric</span>
        <div className="h-4 flex-1 rounded-[2px] bg-muted">
          <div className="h-full rounded-[2px] bg-foreground/25" style={{ width: `${(fabricStrengthN / max) * 100}%` }} />
        </div>
        <span className="w-24 shrink-0 text-right text-[11px] tabular-nums">{fabricStrengthN} N</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-[11px]">{r.name}</span>
            <div className="relative h-4 flex-1 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(r.strengthN / max) * 100}%`,
                  background: r.efficiency < minimumEfficiency ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 52%, transparent)",
                  outline: r.efficiency < minimumEfficiency ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${((fabricStrengthN * minimumEfficiency) / max) * 100}%` }} />
            </div>
            <span className="w-28 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {r.strengthN} N · {(r.efficiency * 100).toFixed(0)}%
              {r.stitchesPerCm ? ` · ${r.stitchesPerCm}/cm` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The tick is {(minimumEfficiency * 100).toFixed(0)}% of the fabric's own strength, which is what a seam is
        judged against — a 300 N seam is excellent in poplin and a failure in canvas ·{" "}
        {failing.length
          ? `${failing.map((r) => r.name).join(", ")} fall short, and a seam that fails before the cloth is the garment's weakest point by design error rather than by wear`
          : `every seam clears it, ${best.name} best at ${(best.efficiency * 100).toFixed(0)}%`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CutPlan — the marker, with utilisation and the cloth actually needed
 * derived from the pieces rather than from a stated yield.
 * ------------------------------------------------------------------ */
export function CutPlan({
  markerLengthM,
  clothWidthCm,
  pieces,
  plies,
  className = "",
}: {
  markerLengthM: number
  clothWidthCm: number
  /** area of each pattern piece, and how many of it per garment */
  pieces: { name: string; areaCm2: number; per: number }[]
  plies: number
  className?: string
}) {
  const garmentArea = pieces.reduce((a, p) => a + p.areaCm2 * p.per, 0)
  const markerArea = markerLengthM * 100 * clothWidthCm
  const garmentsPerMarker = Math.floor(markerArea / Math.max(garmentArea, 1e-9))
  const usedArea = garmentsPerMarker * garmentArea
  const utilisation = usedArea / Math.max(markerArea, 1)
  const garments = garmentsPerMarker * plies
  const clothM = markerLengthM * plies
  const clothPerGarment = clothM / Math.max(garments, 1)
  const wasteM = clothM * (1 - utilisation)
  const max = Math.max(...pieces.map((p) => p.areaCm2 * p.per))

  return (
    <div className={className}>
      <div className="relative h-16 overflow-hidden rounded-[2px] border border-foreground/40 bg-muted">
        <div className="absolute inset-0 flex flex-wrap content-start">
          {pieces.flatMap((p) =>
            Array.from({ length: p.per }, (_, i) => (
              <span
                key={`${p.name}-${i}`}
                className="border border-foreground/30"
                style={{
                  width: `${((p.areaCm2 / garmentArea) * 100) / Math.max(p.per, 1)}%`,
                  height: "100%",
                  background: `color-mix(in oklch, currentColor ${18 + (p.areaCm2 / max) * 40}%, transparent)`,
                }}
                title={`${p.name}: ${p.areaCm2} cm²`}
              />
            )),
          )}
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center justify-center" style={{ width: `${(1 - utilisation) * 100}%`, background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 6px)" }}>
          <span className="bg-background px-1 text-[9px] text-muted-foreground">waste</span>
        </div>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {pieces
          .slice()
          .sort((a, b) => b.areaCm2 * b.per - a.areaCm2 * a.per)
          .map((p) => (
            <li key={p.name} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate">
                {p.per} × {p.name}
              </span>
              <div className="h-1.5 flex-1 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground" style={{ width: `${((p.areaCm2 * p.per) / max) * 100}%` }} />
              </div>
              <span className="w-28 shrink-0 text-right text-muted-foreground">
                {(p.areaCm2 * p.per).toLocaleString()} cm² · {(((p.areaCm2 * p.per) / garmentArea) * 100).toFixed(0)}%
              </span>
            </li>
          ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Utilisation</dt>
          <dd className="font-medium tabular-nums">{(utilisation * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Garments</dt>
          <dd className="font-medium tabular-nums">{garments.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cloth each</dt>
          <dd className="font-medium tabular-nums">{clothPerGarment.toFixed(2)} m</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {garmentsPerMarker} garments fit a {markerLengthM} m marker at {clothWidthCm} cm; {plies} plies gives{" "}
        {garments.toLocaleString()} from {clothM.toLocaleString()} m · {wasteM.toFixed(1)} m of that is bought and
        binned, and one point of marker utilisation is worth {(clothM * 0.01).toFixed(1)} m on this order alone
      </p>
    </div>
  )
}
