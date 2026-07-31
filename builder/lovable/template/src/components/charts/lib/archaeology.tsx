/**
 * Archaeology primitives — stratigraphic sequence, radiocarbon calibration,
 * seriation, find density, site phasing and isotope provenance.
 *
 * The relationships are DERIVED: a Harris matrix's levels come from the
 * stated contacts rather than a supplied depth, seriation orders itself by
 * centre of gravity, the calibrated range is read off the curve, and the
 * provenance verdict falls out of the reference ellipses.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * HarrisMatrix — the stratigraphic sequence. Each context's LEVEL is
 * computed from the "above" relations by longest-path, so two contexts
 * with no relation between them sit side by side rather than in a
 * sequence nobody asserted.
 * ------------------------------------------------------------------ */
export function HarrisMatrix({
  contexts,
  className = "",
}: {
  /** `above` names the contexts this one physically sits on top of */
  contexts: { id: string; kind?: "cut" | "fill" | "layer" | "structure"; above?: string[] }[]
  className?: string
}) {
  const byId = new Map(contexts.map((c) => [c.id, c]))
  const memo = new Map<string, number>()
  const depth = (id: string, seen: Set<string> = new Set()): number => {
    if (memo.has(id)) return memo.get(id) as number
    if (seen.has(id)) return 0 // a cycle is a recording error, not an infinite site
    seen.add(id)
    const below = byId.get(id)?.above ?? []
    const d = below.length === 0 ? 0 : 1 + Math.max(...below.map((b) => depth(b, new Set(seen))))
    memo.set(id, d)
    return d
  }
  const levels: string[][] = []
  contexts.forEach((c) => {
    const d = depth(c.id)
    ;(levels[d] ||= []).push(c.id)
  })
  const ordered = [...levels].reverse().filter(Boolean)

  const glyph = (k?: string) => (k === "cut" ? "▽" : k === "fill" ? "▨" : k === "structure" ? "▤" : "▬")

  return (
    <div className={className}>
      <ol className="space-y-1">
        {ordered.map((row, ri) => (
          <li key={ri}>
            <div className="flex items-center gap-1.5">
              <span className="w-10 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">
                {ri === 0 ? "latest" : ri === ordered.length - 1 ? "earliest" : ""}
              </span>
              <div className="flex flex-1 flex-wrap gap-1">
                {row.map((id) => {
                  const c = byId.get(id)
                  return (
                    <span
                      key={id}
                      className="flex items-center gap-1 rounded-[2px] border border-foreground/45 px-1.5 py-0.5 text-[10px]"
                      title={c?.above?.length ? `above ${c.above.join(", ")}` : "earliest in its chain"}
                    >
                      <span aria-hidden className="text-muted-foreground">
                        {glyph(c?.kind)}
                      </span>
                      {id}
                    </span>
                  )
                })}
              </div>
            </div>
            {ri < ordered.length - 1 && <div className="my-0.5 ml-[3.125rem] h-2 w-px bg-foreground/30" />}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {ordered.length} stratigraphic levels from {contexts.length} contexts · contexts on the same row have no
        recorded relationship to each other, which is a statement about the evidence rather than about the site
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RadiocarbonCalibration — an uncalibrated determination projected
 * through the calibration curve. The calendar range is READ OFF the
 * curve rather than supplied.
 * ------------------------------------------------------------------ */
export function RadiocarbonCalibration({
  bp,
  sigma,
  curve,
  height = 210,
  className = "",
}: {
  /** conventional radiocarbon age, years BP */
  bp: number
  /** one standard deviation on that measurement */
  sigma: number
  /** the calibration curve: calendar year (negative = BC) to radiocarbon BP */
  curve: { calendar: number; bp: number }[]
  height?: number
  className?: string
}) {
  const sorted = [...curve].sort((a, b) => a.calendar - b.calendar)
  // every calendar year whose curve value falls within ±2σ of the measurement
  const hits = sorted.filter((p) => Math.abs(p.bp - bp) <= 2 * sigma)
  const calLo = hits.length ? Math.min(...hits.map((h) => h.calendar)) : sorted[0].calendar
  const calHi = hits.length ? Math.max(...hits.map((h) => h.calendar)) : sorted[sorted.length - 1].calendar
  // a plateau shows up as a calendar span far wider than the measurement precision
  const plateau = calHi - calLo > 4 * sigma

  const xLo = sorted[0].calendar
  const xHi = sorted[sorted.length - 1].calendar
  const yLo = Math.min(...sorted.map((p) => p.bp), bp - 3 * sigma)
  const yHi = Math.max(...sorted.map((p) => p.bp), bp + 3 * sigma)
  const px = (c: number) => ((c - xLo) / Math.max(1e-9, xHi - xLo)) * 100
  const py = (v: number) => 100 - ((v - yLo) / Math.max(1e-9, yHi - yLo)) * 100
  const yr = (c: number) => (c < 0 ? `${Math.abs(Math.round(c))} BC` : `AD ${Math.round(c)}`)

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <rect x={0} y={py(bp + 2 * sigma)} width={100} height={Math.abs(py(bp - 2 * sigma) - py(bp + 2 * sigma))} fill="currentColor" opacity={0.1} />
          <rect x={px(calLo)} y={0} width={Math.max(0.6, px(calHi) - px(calLo))} height={100} fill="currentColor" opacity={0.1} />
          <line x1={0} y1={py(bp)} x2={100} y2={py(bp)} stroke="currentColor" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.65} />
          <polyline
            points={sorted.map((p) => `${px(p.calendar)},${py(p.bp)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{yr(xLo)}</span>
        <span>calendar years</span>
        <span>{yr(xHi)}</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Measured</dt>
          <dd className="font-medium tabular-nums">
            {bp} ± {sigma} BP
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Calibrated (2σ)</dt>
          <dd className="font-medium tabular-nums">
            {yr(calLo)}–{yr(calHi)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Calendar span</dt>
          <dd className="font-medium tabular-nums">{Math.round(calHi - calLo)} yr</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {plateau
          ? "The curve runs flat across this determination, so a precise measurement still gives a wide calendar range — that width is the curve's, not the laboratory's"
          : "The curve is steep here, so the calendar range is about as tight as the measurement allows"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Seriation — a battleship plot. The row order is SOLVED by centre of
 * gravity, which is the whole method; taking an order as a prop would
 * make the chart a drawing of an answer somebody already had.
 * ------------------------------------------------------------------ */
export function Seriation({
  assemblages,
  types,
  counts,
  className = "",
}: {
  assemblages: string[]
  types: string[]
  /** counts[assemblage][type] */
  counts: number[][]
  className?: string
}) {
  const props = counts.map((row) => {
    const t = row.reduce((a, v) => a + v, 0) || 1
    return row.map((v) => v / t)
  })
  // order types by their weighted mean assemblage, then assemblages likewise
  const typeCog = types.map((_, ti) => {
    const w = props.reduce((a, r, ai) => a + (r[ti] ?? 0) * ai, 0)
    const s = props.reduce((a, r) => a + (r[ti] ?? 0), 0)
    return s === 0 ? 0 : w / s
  })
  const typeOrder = types.map((_, i) => i).sort((a, b) => typeCog[a] - typeCog[b])
  const asmCog = props.map((r) => {
    const w = r.reduce((a, v, ti) => a + v * typeOrder.indexOf(ti), 0)
    const s = r.reduce((a, v) => a + v, 0)
    return s === 0 ? 0 : w / s
  })
  const asmOrder = assemblages.map((_, i) => i).sort((a, b) => asmCog[a] - asmCog[b])

  return (
    <div className={className}>
      <div className="flex gap-1">
        <div className="w-16 shrink-0" />
        {typeOrder.map((ti) => (
          <span key={ti} className="min-w-0 flex-1 truncate text-center text-[9px] text-muted-foreground" title={types[ti]}>
            {types[ti]}
          </span>
        ))}
      </div>
      <div className="mt-1 space-y-[3px]">
        {asmOrder.map((ai) => (
          <div key={ai} className="flex items-center gap-1">
            <span className="w-16 shrink-0 truncate text-[10px]">{assemblages[ai]}</span>
            {typeOrder.map((ti) => {
              const p = props[ai]?.[ti] ?? 0
              return (
                <div key={ti} className="flex h-3.5 flex-1 items-center justify-center">
                  <div
                    className="h-full rounded-[1px] bg-foreground"
                    style={{ width: `${Math.max(p > 0 ? 6 : 0, p * 100)}%` }}
                    title={`${assemblages[ai]} · ${types[ti]}: ${(p * 100).toFixed(1)}%`}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Rows and columns are both ordered by centre of gravity, not by the order they were supplied · each type peaks
        once and tapers — a type that peaks twice is either two types or a residual
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ArtefactDensity — finds per cubic metre by context, which is the
 * comparison the raw counts hide.
 * ------------------------------------------------------------------ */
export function ArtefactDensity({
  contexts,
  className = "",
}: {
  contexts: { name: string; finds: number; volumeM3: number }[]
  className?: string
}) {
  const rows = contexts
    .map((c) => ({ ...c, density: c.finds / Math.max(c.volumeM3, 1e-9) }))
    .sort((a, b) => b.density - a.density)
  const maxD = Math.max(0.01, ...rows.map((r) => r.density))
  const maxF = Math.max(1, ...rows.map((r) => r.finds))
  const byCount = [...contexts].sort((a, b) => b.finds - a.finds)
  const flipped = byCount[0]?.name !== rows[0]?.name

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.finds} finds from {r.volumeM3} m³
              </span>
            </div>
            <div className="mt-0.5 space-y-px">
              <div className="h-3 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground" style={{ width: `${(r.density / maxD) * 100}%` }} />
              </div>
              <div className="h-1.5 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground/30" style={{ width: `${(r.finds / maxF) * 100}%` }} />
              </div>
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">{r.density.toFixed(1)} finds/m³</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Thick bar is density, thin bar is raw count ·{" "}
        {flipped
          ? `${byCount[0]?.name} produced the most finds but ${rows[0]?.name} is the richest deposit — the difference is how much was dug`
          : "the richest deposit is also the one that produced the most finds"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SitePhasing — occupation phases against the dating evidence that
 * supports each, with the gaps between phases derived.
 * ------------------------------------------------------------------ */
export function SitePhasing({
  phases,
  height = 180,
  className = "",
}: {
  phases: { name: string; from: number; to: number; evidence?: string; confidence?: "secure" | "probable" | "inferred" }[]
  height?: number
  className?: string
}) {
  const sorted = [...phases].sort((a, b) => a.from - b.from)
  const lo = Math.min(...sorted.map((p) => p.from))
  const hi = Math.max(...sorted.map((p) => p.to))
  const gaps = sorted
    .map((p, i) => (i === 0 ? null : { after: sorted[i - 1].name, before: p.name, years: p.from - sorted[i - 1].to }))
    .filter((g): g is { after: string; before: string; years: number } => g !== null && g.years > 0)
  const px = (y: number) => ((y - lo) / Math.max(1e-9, hi - lo)) * 100
  const yr = (c: number) => (c < 0 ? `${Math.abs(Math.round(c))} BC` : `AD ${Math.round(c)}`)
  const fill = (c?: string) =>
    c === "inferred"
      ? "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 5px)"
      : c === "probable"
        ? "color-mix(in oklch, currentColor 32%, transparent)"
        : "currentColor"

  return (
    <div className={className}>
      <ul className="space-y-1.5" style={{ minHeight: height }}>
        {sorted.map((p) => (
          <li key={p.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span>{p.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {yr(p.from)} – {yr(p.to)}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px] border border-foreground/45"
                style={{ left: `${px(p.from)}%`, width: `${Math.max(1, px(p.to) - px(p.from))}%`, background: fill(p.confidence) }}
              />
            </div>
            {p.evidence && <span className="text-[9px] text-muted-foreground">{p.evidence}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Solid is secure dating, pale is probable, hatched is inferred from stratigraphy alone ·{" "}
        {gaps.length
          ? `${gaps.length} gap${gaps.length === 1 ? "" : "s"} in occupation, the longest ${Math.max(...gaps.map((g) => g.years))} years between ${gaps.reduce((a, g) => (g.years > a.years ? g : a)).after} and ${gaps.reduce((a, g) => (g.years > a.years ? g : a)).before}`
          : "continuous occupation with no dated gap"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * IsotopeProvenance — a sample's ratios against reference populations.
 * The verdict is COMPUTED as a standardised distance, not asserted.
 * ------------------------------------------------------------------ */
export function IsotopeProvenance({
  samples,
  references,
  axes,
  height = 210,
  className = "",
}: {
  samples: { name: string; x: number; y: number }[]
  /** each source region as a mean plus one standard deviation on each axis */
  references: { name: string; x: number; y: number; sdX: number; sdY: number }[]
  axes: { x: string; y: string }
  height?: number
  className?: string
}) {
  const all = [
    ...samples,
    ...references.flatMap((r) => [
      { x: r.x - 2 * r.sdX, y: r.y - 2 * r.sdY },
      { x: r.x + 2 * r.sdX, y: r.y + 2 * r.sdY },
    ]),
  ]
  const xLo = Math.min(...all.map((p) => p.x))
  const xHi = Math.max(...all.map((p) => p.x))
  const yLo = Math.min(...all.map((p) => p.y))
  const yHi = Math.max(...all.map((p) => p.y))
  const px = (v: number) => ((v - xLo) / Math.max(1e-9, xHi - xLo)) * 100
  const py = (v: number) => 100 - ((v - yLo) / Math.max(1e-9, yHi - yLo)) * 100

  // `source` and `z`, NOT `name` — spreading an assignment whose key is also
  // `name` overwrites the sample's own label with the region's.
  const assign = (s: { x: number; y: number }) => {
    const scored = references.map((r) => ({
      source: r.name,
      z: Math.sqrt(((s.x - r.x) / Math.max(r.sdX, 1e-9)) ** 2 + ((s.y - r.y) / Math.max(r.sdY, 1e-9)) ** 2),
    }))
    const best = scored.reduce((a, b) => (b.z < a.z ? b : a), { source: "—", z: Infinity })
    return { ...best, local: best.z <= 2 }
  }
  const verdicts = samples.map((s) => ({ ...s, ...assign(s) }))
  const nonLocal = verdicts.filter((v) => !v.local)

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        {references.map((r) => (
          <span
            key={r.name}
            className="absolute -translate-x-1/2 -translate-y-1/2 border border-dashed border-foreground/50 bg-foreground/6"
            style={{
              left: `${px(r.x)}%`,
              top: `${py(r.y)}%`,
              width: `${(2 * r.sdX * 2 * 100) / Math.max(1e-9, xHi - xLo)}%`,
              height: `${(2 * r.sdY * 2 * 100) / Math.max(1e-9, yHi - yLo)}%`,
              borderRadius: "50%",
            }}
            title={`${r.name} ±2σ`}
          />
        ))}
        {references.map((r) => (
          <span
            key={`${r.name}-label`}
            className="absolute -translate-x-1/2 -translate-y-1/2 bg-background px-1 text-[9px] text-muted-foreground"
            style={{ left: `${px(r.x)}%`, top: `${py(r.y)}%` }}
          >
            {r.name}
          </span>
        ))}
        {verdicts.map((v) => (
          <span
            key={v.name}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${px(v.x)}%`,
              top: `${py(v.y)}%`,
              background: v.local ? "currentColor" : "var(--background)",
              boxShadow: v.local ? undefined : "inset 0 0 0 1.5px currentColor",
            }}
            title={`${v.name} → ${v.name === v.name ? v.name : ""} nearest ${v.name}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{axes.x}</span>
        <span>{axes.y} ↑</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {verdicts.map((v) => (
          <li key={v.name} className="flex items-center gap-1.5">
            <span aria-hidden>{v.local ? "●" : "○"}</span>
            <span className="w-20 shrink-0 truncate">{v.name}</span>
            <span className="text-muted-foreground">
              {v.local ? "consistent with" : "nearest is"} {v.source} at {v.z.toFixed(1)}σ
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Dashed ellipses are each source's ±2σ range · hollow markers fall outside every reference —{" "}
        {nonLocal.length
          ? `${nonLocal.length} of ${samples.length} did not grow up anywhere sampled here`
          : "every individual is consistent with a local origin"}
      </p>
    </div>
  )
}
