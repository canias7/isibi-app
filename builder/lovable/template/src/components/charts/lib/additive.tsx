/**
 * Additive manufacturing primitives — build time, nesting, layer adhesion,
 * powder reuse, support ratio and cost per part.
 *
 * Where a build's hours actually go, how much of a platform a nest really
 * uses, the strength a print orientation gives up, how many cycles a powder
 * lot has left, what supports cost in material and finishing, and the true
 * cost of one part are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) =>
  "£" + (Math.abs(v) < 10 ? Math.abs(v).toFixed(2) : Math.round(Math.abs(v)).toLocaleString("en-GB"))
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/* ------------------------------------------------------------------ *
 * PrintTimeStack — where a build's hours go, with the RECOATING share
 * derived. Slicer estimates report laser time; the machine spends most
 * of a build not melting anything.
 * ------------------------------------------------------------------ */
export function PrintTimeStack({
  builds,
  className = "",
}: {
  builds: { name: string; layers: number; exposureMin: number; recoatSecPerLayer: number; warmUpMin: number; coolMin: number }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!builds.length) return null

  const rows = builds.map((b) => {
    const recoat = (b.layers * b.recoatSecPerLayer) / 60
    const total = b.exposureMin + recoat + b.warmUpMin + b.coolMin
    return { ...b, recoat, total, dutyCycle: b.exposureMin / Math.max(total, 1) }
  })
  const parts: [keyof (typeof rows)[number], string, string][] = [
    ["exposureMin", "Exposure", "currentColor"],
    ["recoat", "Recoating", "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"],
    ["warmUpMin", "Warm up", "color-mix(in oklch, currentColor 45%, transparent)"],
    ["coolMin", "Cool down", "color-mix(in oklch, currentColor 18%, transparent)"],
  ]
  const max = Math.max(...rows.map((r) => r.total))
  const meanDuty = rows.reduce((a, r) => a + r.exposureMin, 0) / Math.max(rows.reduce((a, r) => a + r.total, 0), 1)
  const worst = rows.reduce((a, r) => (r.dutyCycle < a.dutyCycle ? r : a), rows[0])
  const hm = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}`

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.layers.toLocaleString()} layers · {hm(r.total)} · {(r.dutyCycle * 100).toFixed(0)}% exposing
              </span>
            </div>
            <div className="mt-0.5 flex h-4 rounded-[2px] border border-foreground/20" style={{ width: `${(r.total / max) * 100}%` }}>
              {parts.map(([k, label, bg]) => (
                <div
                  key={label}
                  className="min-w-0 first:rounded-l-[2px] last:rounded-r-[2px]"
                  style={{ width: `${((r[k] as number) / Math.max(r.total, 1)) * 100}%`, background: bg }}
                  title={`${label}: ${hm(r[k] as number)}`}
                />
              ))}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {hm(r.recoat)} recoating at {r.recoatSecPerLayer}s a layer — the number that scales with HEIGHT rather
              than with the parts
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {parts.map(([, label, bg]) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25" style={{ background: bg }} />
            {label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Only the solid block is the laser actually melting powder — {(meanDuty * 100).toFixed(0)}% of machine time
        across these builds · recoating is per LAYER, so it is set by how tall the tallest part is and not by how
        many parts are on the plate, which is the whole argument for nesting flat · {worst.name} is the worst at{" "}
        {(worst.dutyCycle * 100).toFixed(0)}%, and a slicer estimate quoting exposure alone understates it by{" "}
        {hm(worst.total - worst.exposureMin)}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * NestingEfficiency — parts on a platform, with the packed VOLUME
 * derived against the height they force. A nest is judged on area and
 * billed on the build's height.
 * ------------------------------------------------------------------ */
export function NestingEfficiency({
  nests,
  platform,
  className = "",
}: {
  nests: {
    name: string
    parts: { name: string; footprintMm2: number; heightMm: number; count: number }[]
  }[]
  platform: { areaMm2: number; maxHeightMm: number }
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!nests.length) return null

  const rows = nests
    .map((n) => {
      const area = n.parts.reduce((a, p) => a + p.footprintMm2 * p.count, 0)
      const tallest = Math.max(0, ...n.parts.map((p) => p.heightMm))
      const count = n.parts.reduce((a, p) => a + p.count, 0)
      const volumeUsed = n.parts.reduce((a, p) => a + p.footprintMm2 * p.heightMm * p.count, 0)
      const buildVolume = platform.areaMm2 * tallest
      return {
        ...n,
        area,
        tallest,
        count,
        areaFill: area / Math.max(platform.areaMm2, 1),
        volumeFill: volumeUsed / Math.max(buildVolume, 1e-9),
        heightUse: tallest / Math.max(platform.maxHeightMm, 1),
      }
    })
    .sort((a, b) => b.volumeFill - a.volumeFill)
  const max = Math.max(...rows.map((r) => Math.max(r.areaFill, r.volumeFill)))
  const byArea = [...rows].sort((a, b) => b.areaFill - a.areaFill)
  const flipped = byArea[0].name !== rows[0].name

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.count} {plural(r.count, "part", "parts")} · tallest {r.tallest} mm
              </span>
            </div>
            <div className="mt-0.5 space-y-px">
              <div className="h-2.5 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground/30" style={{ width: `${(r.areaFill / max) * 100}%` }} title={`area ${(r.areaFill * 100).toFixed(0)}%`} />
              </div>
              <div className="h-2.5 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground" style={{ width: `${(r.volumeFill / max) * 100}%` }} title={`volume ${(r.volumeFill * 100).toFixed(0)}%`} />
              </div>
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.areaFill * 100).toFixed(0)}% of the plate, {(r.volumeFill * 100).toFixed(0)}% of the build volume ·
              one part {r.tallest} mm tall makes every layer that tall
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is the share of the PLATE covered and solid is the share of the BUILD VOLUME filled, and they are
        different questions — the machine recoats to the height of the tallest part whether anything else is up
        there or not ·{" "}
        {flipped
          ? `${byArea[0].name} packs the plate best and ${rows[0].name} uses the build best, which is the nest to run`
          : `${rows[0].name} leads on both, which is the nest to run`}{" "}
        · a nest judged on area alone rewards putting one tall bracket on an otherwise flat plate
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * LayerAdhesion — strength by build orientation, with the ANISOTROPY
 * derived. A printed part is not one material, and the datasheet
 * number is the strong direction.
 * ------------------------------------------------------------------ */
export function LayerAdhesion({
  materials,
  requiredMpa,
  className = "",
}: {
  materials: { name: string; xyMpa: number; zMpa: number; datasheetMpa?: number }[]
  requiredMpa?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!materials.length) return null

  const rows = materials
    .map((m) => ({
      ...m,
      ratio: m.zMpa / Math.max(m.xyMpa, 1e-9),
      passesXy: requiredMpa === undefined ? null : m.xyMpa >= requiredMpa,
      passesZ: requiredMpa === undefined ? null : m.zMpa >= requiredMpa,
      // how far the datasheet overstates the weak direction
      overstate: m.datasheetMpa === undefined ? null : m.datasheetMpa / Math.max(m.zMpa, 1e-9),
    }))
    .sort((a, b) => a.ratio - b.ratio)
  // LOG widths, stated below: a polymer at 22 MPa and titanium at 1050 cannot
  // share a linear axis without the polymers becoming invisible
  const max = Math.max(...rows.map((r) => Math.max(r.xyMpa, r.datasheetMpa ?? 0)))
  const floor = Math.min(...rows.map((r) => r.zMpa)) * 0.6
  const w = (v: number) => clamp((Math.log(Math.max(v, floor)) - Math.log(floor)) / Math.max(Math.log(max) - Math.log(floor), 1e-9) * 100, 2, 100)
  const trap = rows.filter((r) => r.passesXy === true && r.passesZ === false)
  const worst = rows[0]

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                XY {r.xyMpa} MPa · Z {r.zMpa} MPa · Z is {(r.ratio * 100).toFixed(0)}% of XY
              </span>
            </div>
            <div className="relative mt-0.5 space-y-px">
              <div className="h-2.5 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground/45" style={{ width: `${w(r.xyMpa)}%` }} title={`in plane: ${r.xyMpa} MPa`} />
              </div>
              <div className="h-2.5 rounded-[1px] bg-muted">
                <div
                  className="h-full rounded-[1px]"
                  style={{
                    width: `${w(r.zMpa)}%`,
                    background:
                      r.passesZ === false
                        ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                        : "currentColor",
                    outline: r.passesZ === false ? "1px solid currentColor" : undefined,
                    outlineOffset: -1,
                  }}
                  title={`through layers: ${r.zMpa} MPa`}
                />
              </div>
              {requiredMpa !== undefined && (
                <span className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground/75" style={{ left: `${w(requiredMpa)}%` }} title={`required ${requiredMpa} MPa`} />
              )}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.overstate !== null
                ? `datasheet quotes ${r.datasheetMpa} MPa, ${r.overstate.toFixed(1)}× the through-layer strength`
                : "pale in plane, solid through the layers"}
              {r.passesZ === false ? " — fails the requirement in Z" : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is strength IN the layer plane and solid is THROUGH it, which is the direction a part fails in · the
        widths are LOGARITHMIC, because a polymer at 22 MPa and a titanium alloy at 1050 cannot share a linear axis ·
        the ratio is derived rather than quoted, and {worst.name} is the most anisotropic at{" "}
        {(worst.ratio * 100).toFixed(0)}% ·{" "}
        {requiredMpa === undefined
          ? "the orientation on the build plate decides which number applies to a given load"
          : trap.length === 0
            ? `every material here clears ${requiredMpa} MPa in both directions`
            : `${trap.length} ${plural(trap.length, "material passes", "materials pass")} the ${requiredMpa} MPa requirement in plane and ${trap.length === 1 ? "fails" : "fail"} through the layers, which is a part that passes its coupon test and breaks in service`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PowderReuse — a lot's oxygen pickup and particle shape over reuse
 * cycles, with the CYCLES REMAINING derived. Powder is the largest
 * consumable and it is discarded on a rule of thumb.
 * ------------------------------------------------------------------ */
export function PowderReuse({
  lots,
  maxOxygenPpm,
  minSphericity,
  height = 190,
  className = "",
}: {
  lots: { name: string; cycles: { cycle: number; oxygenPpm: number; sphericity: number }[] }[]
  maxOxygenPpm: number
  minSphericity: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!lots.length) return null

  const rows = lots.map((l) => {
    const pts = [...l.cycles].sort((a, b) => a.cycle - b.cycle)
    const last = pts[pts.length - 1]
    const first = pts[0]
    const oxRate = (last.oxygenPpm - first.oxygenPpm) / Math.max(last.cycle - first.cycle, 1)
    const spRate = (first.sphericity - last.sphericity) / Math.max(last.cycle - first.cycle, 1)
    const byOxygen = oxRate > 0 ? (maxOxygenPpm - last.oxygenPpm) / oxRate : Infinity
    const bySphere = spRate > 0 ? (last.sphericity - minSphericity) / spRate : Infinity
    const left = Math.min(byOxygen, bySphere)
    return {
      ...l,
      pts,
      last,
      oxRate,
      left: Number.isFinite(left) ? Math.max(0, left) : null,
      limitedBy: byOxygen <= bySphere ? "oxygen" : "particle shape",
    }
  })
  const maxCycle = Math.max(...rows.flatMap((r) => r.pts.map((p) => p.cycle)))
  const maxOx = Math.max(maxOxygenPpm * 1.1, ...rows.flatMap((r) => r.pts.map((p) => p.oxygenPpm)))
  const px = (c: number) => (c / Math.max(maxCycle, 1)) * 100
  const py = (v: number) => 100 - (v / maxOx) * 94 - 3
  const dashes = ["none", "5 2", "2 2", "6 2 2 2"]
  const spent = rows.filter((r) => r.last.oxygenPpm >= maxOxygenPpm || r.last.sphericity <= minSphericity)
  const shortest = rows.filter((r) => r.left !== null).reduce((a, r) => (r.left! < a.left! ? r : a), rows.find((r) => r.left !== null) ?? rows[0])

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(maxOxygenPpm)} x2={100} y2={py(maxOxygenPpm)} stroke="currentColor" strokeWidth={1} strokeDasharray="4 2" />
          {rows.map((r, i) => (
            <polyline
              key={r.name}
              points={r.pts.map((p) => `${px(p.cycle)},${py(p.oxygenPpm)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray={dashes[i % dashes.length]}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <span className="absolute right-1 -translate-y-1/2 bg-background px-0.5 text-[9px] tabular-nums text-muted-foreground" style={{ top: `${py(maxOxygenPpm)}%` }}>
          {maxOxygenPpm} ppm
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>cycle 0</span>
        <span>oxygen pickup</span>
        <span>cycle {maxCycle}</span>
      </div>
      <ul className="mt-2 space-y-1 text-[10px] tabular-nums">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-2">
            <svg width="22" height="6" className="shrink-0" aria-hidden>
              <line x1={0} y1={3} x2={22} y2={3} stroke="currentColor" strokeWidth={1.5} strokeDasharray={dashes[i % dashes.length]} />
            </svg>
            <span className="w-28 shrink-0 truncate">{r.name}</span>
            <span className="text-muted-foreground">
              cycle {r.last.cycle} · {r.last.oxygenPpm} ppm · sphericity {r.last.sphericity.toFixed(3)} ·{" "}
              {r.left === null
                ? "not degrading"
                : r.left <= 0
                  ? "spent"
                  : `about ${r.left.toFixed(1)} ${plural(Math.round(r.left), "cycle", "cycles")} left, limited by ${r.limitedBy}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The cycles remaining are EXTRAPOLATED from each lot's own rate against BOTH limits, and the binding one
        differs by lot — powder is the largest consumable on the machine and it is usually discarded on a fixed
        number of reuses ·{" "}
        {spent.length > 0
          ? `${spent.length} ${plural(spent.length, "lot is", "lots are")} already past a limit`
          : `${shortest.name} is closest, with about ${shortest.left?.toFixed(1)} cycles and ${shortest.limitedBy} the constraint`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SupportRatio — the material and the finishing time supports cost,
 * by orientation. Supports are chosen to make a build succeed and
 * paid for twice, in powder and in a person with a grinder.
 * ------------------------------------------------------------------ */
export function SupportRatio({
  orientations,
  materialCostPerCm3,
  finishingCostPerHour,
  className = "",
}: {
  orientations: {
    name: string
    partCm3: number
    supportCm3: number
    removalHours: number
    heightMm: number
    risk: "low" | "medium" | "high"
  }[]
  materialCostPerCm3: number
  finishingCostPerHour: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!orientations.length) return null

  const rows = orientations
    .map((o) => {
      const material = (o.partCm3 + o.supportCm3) * materialCostPerCm3
      const supportMaterial = o.supportCm3 * materialCostPerCm3
      const finishing = o.removalHours * finishingCostPerHour
      return {
        ...o,
        material,
        supportMaterial,
        finishing,
        supportCost: supportMaterial + finishing,
        total: material + finishing,
        ratio: o.supportCm3 / Math.max(o.partCm3, 1e-9),
      }
    })
    .sort((a, b) => a.total - b.total)
  const max = Math.max(...rows.map((r) => r.total))
  const cheapest = rows[0]
  const leastSupport = rows.reduce((a, r) => (r.ratio < a.ratio ? r : a), rows[0])
  const shortest = rows.reduce((a, r) => (r.heightMm < a.heightMm ? r : a), rows[0])
  // three measures can land on one, two or three orientations and each reads
  // differently — "three different orientations" beside two identical names is
  // the same defect as a sentence contradicting its own subject
  const distinct = new Set([cheapest.name, leastSupport.name, shortest.name]).size
  const glyph = (risk: string) => (risk === "high" ? "!!" : risk === "medium" ? "!" : "·")

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">
                <span aria-hidden className="mr-1 inline-block w-3 text-muted-foreground">
                  {glyph(r.risk)}
                </span>
                {r.name}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {r.heightMm} mm tall · {(r.ratio * 100).toFixed(0)}% support · {r.risk} risk
              </span>
            </div>
            <div className="mt-0.5 flex h-4 rounded-[2px] bg-muted" style={{ width: `${(r.total / max) * 100}%` }}>
              <div
                className="rounded-l-[2px] bg-foreground/35"
                style={{ width: `${(r.partCm3 * materialCostPerCm3 / Math.max(r.total, 1e-9)) * 100}%` }}
                title={`part material ${money(r.partCm3 * materialCostPerCm3)}`}
              />
              <div
                style={{
                  width: `${(r.supportMaterial / Math.max(r.total, 1e-9)) * 100}%`,
                  background: "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)",
                }}
                title={`support material ${money(r.supportMaterial)}`}
              />
              <div
                className="rounded-r-[2px]"
                style={{
                  width: `${(r.finishing / Math.max(r.total, 1e-9)) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: "1px solid currentColor",
                  outlineOffset: -1,
                }}
                title={`removal ${money(r.finishing)}`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.total)} · {money(r.supportCost)} of it is supports —{" "}
              {money(r.supportMaterial)} in powder and {money(r.finishing)} at the bench
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Supports are paid for TWICE: once in powder (fine hatch) and again in a person with a grinder (coarse
        hatch), and the second is usually the larger · {cheapest.name} is cheapest overall,{" "}
        {leastSupport.name} uses the least support material and {shortest.name} builds shortest —{" "}
        {distinct === 1
          ? "the same orientation on all three, which almost never happens"
          : distinct === 2
            ? "two orientations across three measures, so the third is already costing something"
            : "three different orientations, which is why this is a decision rather than a default"}{" "}
        · the risk glyph is the fourth axis and no cost model contains it
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CostPerPart — the machine-hour rate applied to a nest, with the
 * cost of ONE part derived. A build is quoted as a job and sold as
 * parts, and a half-empty plate is the difference.
 * ------------------------------------------------------------------ */
export function CostPerPart({
  scenarios,
  machineRatePerHour,
  className = "",
}: {
  scenarios: { name: string; parts: number; buildHours: number; powderCost: number; postCostPerPart: number; scrapRate: number }[]
  machineRatePerHour: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!scenarios.length) return null

  const rows = scenarios
    .map((s) => {
      const machine = s.buildHours * machineRatePerHour
      const good = s.parts * (1 - s.scrapRate)
      const perGood = (machine + s.powderCost + s.parts * s.postCostPerPart) / Math.max(good, 1e-9)
      const perPrinted = (machine + s.powderCost + s.parts * s.postCostPerPart) / Math.max(s.parts, 1)
      return { ...s, machine, good, perGood, perPrinted, machineShare: machine / Math.max(machine + s.powderCost + s.parts * s.postCostPerPart, 1e-9) }
    })
    .sort((a, b) => a.perGood - b.perGood)
  // LOG widths, stated below: these costs span ~20x and a linear scale draws
  // four of five nests as an identical stub
  const max = Math.max(...rows.map((r) => r.perGood))
  const floor = Math.min(...rows.map((r) => r.perPrinted)) * 0.7
  const w = (v: number) => clamp((Math.log(Math.max(v, floor)) - Math.log(floor)) / Math.max(Math.log(max) - Math.log(floor), 1e-9) * 100, 2, 100)
  const best = rows[0]
  const worst = rows[rows.length - 1]
  const meanMachineShare = rows.reduce((a, r) => a + r.machineShare, 0) / Math.max(rows.length, 1)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.parts} on the plate · {r.buildHours.toFixed(1)} h · {(r.scrapRate * 100).toFixed(0)}% scrap
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/22" style={{ width: `${w(r.perGood)}%` }} title={`per good part ${money(r.perGood)}`} />
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground" style={{ width: `${w(r.perPrinted)}%` }} title={`per printed part ${money(r.perPrinted)}`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.perPrinted)} printed → {money(r.perGood)} good · {(r.machineShare * 100).toFixed(0)}% of it is
              machine time
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Solid is cost per part PRINTED and pale is per part that passes, and the gap is the scrap rate paid for at
        full price · the widths are LOGARITHMIC, because these costs span twenty-fold and a linear scale draws four
        of five nests as the same stub · {(meanMachineShare * 100).toFixed(0)}% of the cost is machine time, which is fixed for the
        build and divided by however many parts were on the plate — that is why{" "}
        {best.name.toLowerCase()} at {money(best.perGood)} beats {worst.name.toLowerCase()} at{" "}
        {money(worst.perGood)}, {(worst.perGood / Math.max(best.perGood, 1e-9)).toFixed(1)}× as much for the same
        machine · quoting a build by the hour and selling it by the part is where an additive shop loses money
      </p>
    </div>
  )
}
