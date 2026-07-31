/**
 * Ceramics primitives — firing schedules, glaze chemistry, clay body
 * testing, cone equivalence, kiln packing and craze risk.
 *
 * The ramp rates between segments, the unity formula from a recipe, the
 * total and firing shrinkage from measured bars, the heatwork a schedule
 * actually delivers, the shelf utilisation and the expansion mismatch are
 * all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * FiringSchedule — the segments a controller is programmed with, with
 * the RAMP RATE derived. A potter enters target and duration; what
 * cracks the ware is degrees per hour, which is never the field typed.
 * ------------------------------------------------------------------ */
export function FiringSchedule({
  segments,
  startC = 20,
  maxRampC = 150,
  height = 190,
  className = "",
}: {
  /** each segment's target temperature and how long it is given */
  segments: { name: string; toC: number; hours: number; holdHours?: number }[]
  startC?: number
  /** the ramp above which this clay body is at risk */
  maxRampC?: number
  height?: number
  className?: string
}) {
  let t = 0
  let from = startC
  const laid = segments.map((s) => {
    const rate = (s.toC - from) / Math.max(s.hours, 1e-9)
    const seg = { ...s, from, startHour: t, rampEnd: t + s.hours, endHour: t + s.hours + (s.holdHours ?? 0), rate }
    t = seg.endHour
    from = s.toC
    return seg
  })
  const totalHours = t
  const peak = Math.max(startC, ...laid.map((s) => s.toC))
  const tooFast = laid.filter((s) => Math.abs(s.rate) > maxRampC)
  const px = (h: number) => (h / Math.max(totalHours, 1e-9)) * 100
  const py = (c: number) => 100 - ((c - startC) / Math.max(peak - startC, 1e-9)) * 94 - 3
  const points = [`0,${py(startC)}`]
  laid.forEach((s) => {
    points.push(`${px(s.rampEnd)},${py(s.toC)}`)
    if (s.endHour > s.rampEnd) points.push(`${px(s.endHour)},${py(s.toC)}`)
  })

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {laid
            .filter((s) => Math.abs(s.rate) > maxRampC)
            .map((s) => (
              <rect key={s.name} x={px(s.startHour)} y={0} width={px(s.rampEnd) - px(s.startHour)} height={100} fill="currentColor" opacity={0.12} />
            ))}
          <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 h</span>
        <span>peak {peak}°C</span>
        <span>{totalHours.toFixed(1)} h</span>
      </div>
      <ul className="mt-2 space-y-1 text-[10px] tabular-nums">
        {laid.map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <span aria-hidden className="w-3">
              {Math.abs(s.rate) > maxRampC ? "!" : "·"}
            </span>
            <span className="w-28 shrink-0 truncate">{s.name}</span>
            <span className="w-24 shrink-0 text-muted-foreground">
              {s.from}→{s.toC}°C
            </span>
            <div className="h-2 flex-1 rounded-[1px] bg-muted">
              <div
                className="h-full rounded-[1px]"
                style={{
                  width: `${clamp((Math.abs(s.rate) / Math.max(maxRampC * 1.6, 1)) * 100, 2, 100)}%`,
                  background:
                    Math.abs(s.rate) > maxRampC
                      ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)"
                      : "color-mix(in oklch, currentColor 55%, transparent)",
                }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-muted-foreground">{s.rate.toFixed(0)}°C/h</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The rate column is DERIVED from the target and the time, which is what the controller is actually asked to do —
        a schedule is entered as temperatures and hours, and ware cracks on degrees per hour ·{" "}
        {tooFast.length === 0
          ? `nothing exceeds ${maxRampC}°C/h`
          : `${tooFast.map((s) => s.name).join(" and ")} exceed${tooFast.length === 1 ? "s" : ""} ${maxRampC}°C/h, shaded above`}{" "}
        · {totalHours.toFixed(1)} hours to {peak}°C
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * GlazeUmf — the Seger unity formula from a batch recipe. Two glazes
 * with completely different materials can be the same glaze, and the
 * only way to see it is to normalise to unity.
 * ------------------------------------------------------------------ */
export function GlazeUmf({
  glazes,
  className = "",
}: {
  /** the molar contribution of each oxide group, before normalising */
  glazes: { name: string; fluxes: Record<string, number>; alumina: number; silica: number; boron?: number }[]
  className?: string
}) {
  const rows = glazes.map((g) => {
    const fluxTotal = Object.values(g.fluxes).reduce((a, v) => a + v, 0) || 1
    const unity = Object.fromEntries(Object.entries(g.fluxes).map(([k, v]) => [k, v / fluxTotal]))
    const al = g.alumina / fluxTotal
    const si = g.silica / fluxTotal
    const b = (g.boron ?? 0) / fluxTotal
    return { ...g, unity, al, si, b, ratio: si / Math.max(al, 1e-9) }
  })
  const fluxNames = Array.from(new Set(rows.flatMap((r) => Object.keys(r.unity))))
  const maxSi = Math.max(...rows.map((r) => r.si))
  // a stable gloss glaze sits roughly here; the ratio is what decides it
  const glossy = rows.filter((r) => r.ratio >= 5 && r.ratio <= 9)

  return (
    <div className={className}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                Si:Al {r.ratio.toFixed(1)}
                {r.b > 0.01 ? ` · B₂O₃ ${r.b.toFixed(2)}` : ""}
              </span>
            </div>
            {/* fluxes normalised to one, which is the whole point */}
            <div className="mt-0.5 flex h-3.5 overflow-hidden rounded-[2px] border border-foreground/25">
              {fluxNames.map((f, i) => (
                <div
                  key={f}
                  className="border-r border-background last:border-r-0"
                  style={{
                    width: `${(r.unity[f] ?? 0) * 100}%`,
                    background: `color-mix(in oklch, currentColor ${(88 - i * 16).toFixed(0)}%, transparent)`,
                  }}
                  title={`${f}: ${(r.unity[f] ?? 0).toFixed(3)}`}
                />
              ))}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[9px] tabular-nums text-muted-foreground">
              <span className="w-12 shrink-0">Al₂O₃</span>
              <div className="h-1.5 w-16 shrink-0 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground/60" style={{ width: `${clamp((r.al / 0.7) * 100, 2, 100)}%` }} />
              </div>
              <span className="w-10 shrink-0">{r.al.toFixed(2)}</span>
              <span className="w-8 shrink-0">SiO₂</span>
              <div className="h-1.5 flex-1 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground/60" style={{ width: `${(r.si / maxSi) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right">{r.si.toFixed(2)}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {fluxNames.map((f, i) => (
          <span key={f} className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25"
              style={{ background: `color-mix(in oklch, currentColor ${(88 - i * 16).toFixed(0)}%, transparent)` }}
            />
            {f}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Fluxes are normalised to ONE, which is what makes two recipes with different materials comparable — the bar is
        always full width and only the proportions differ · the silica-to-alumina ratio is what decides the surface, and{" "}
        {glossy.length} of {rows.length} sit in the 5–9 band a stable gloss wants · a recipe in grams cannot be compared
        with another recipe in grams
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ClayShrinkage — measured test bars. Total shrinkage is what sizes
 * a mould; firing shrinkage alone is what a potter usually quotes,
 * and the difference is the reason a lid does not fit.
 * ------------------------------------------------------------------ */
export function ClayShrinkage({
  bodies,
  markMm = 100,
  className = "",
}: {
  /** the 100 mm mark measured wet, dry and fired */
  bodies: { name: string; dryMm: number; firedMm: number; absorptionPercent?: number }[]
  markMm?: number
  className?: string
}) {
  const rows = bodies.map((b) => {
    const dry = (markMm - b.dryMm) / markMm
    const total = (markMm - b.firedMm) / markMm
    const firing = (b.dryMm - b.firedMm) / Math.max(b.dryMm, 1e-9)
    return { ...b, dry, firing, total, vitrified: (b.absorptionPercent ?? 99) < 3 }
  })
  const max = Math.max(...rows.map((r) => r.total))
  const widest = rows.reduce((a, r) => (r.total > a.total ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {markMm} → {r.dryMm.toFixed(1)} → {r.firedMm.toFixed(1)} mm
              </span>
            </div>
            {/* percentage widths, NOT flex-grow: a grow factor below 1 leaves the
                container partly unfilled, and these fractions are all ~0.06 */}
            <div className="mt-0.5 flex h-4 gap-px" style={{ width: `${(r.total / max) * 100}%` }}>
              <div
                className="rounded-l-[2px] bg-foreground/45"
                style={{ width: `${(r.dry / Math.max(r.total, 1e-9)) * 100}%` }}
                title={`dry ${(r.dry * 100).toFixed(1)}%`}
              />
              <div
                className="flex-1 rounded-r-[2px] bg-foreground"
                title={`firing ${(r.firing * 100).toFixed(1)}%`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              total {(r.total * 100).toFixed(1)}% · dry {(r.dry * 100).toFixed(1)} + firing {(r.firing * 100).toFixed(1)}
              {r.absorptionPercent !== undefined
                ? ` · absorption ${r.absorptionPercent.toFixed(1)}%${r.vitrified ? ", vitrified" : ", still porous"}`
                : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is drying, solid is firing, and the bar is the TOTAL — which is the number a mould has to be cut to · firing
        shrinkage alone is what gets quoted, and it is only{" "}
        {((widest.firing / Math.max(widest.total, 1e-9)) * 100).toFixed(0)}% of the total in{" "}
        {widest.name.toLowerCase()}, so a mould cut from that number is short by the whole drying half ·{" "}
        {rows.filter((r) => r.vitrified).length} of {rows.length} bodies vitrified at this temperature
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ConeChart — pyrometric cones bend to HEATWORK, not temperature, so
 * the same cone falls at different temperatures depending on the ramp.
 * The equivalent temperature is derived from the rate.
 * ------------------------------------------------------------------ */
export function ConeChart({
  cones,
  rampC,
  scheduleName = "this firing",
  className = "",
}: {
  /** each cone's bending temperature at 15 and at 150 °C/h */
  cones: { name: string; slowC: number; fastC: number }[]
  /** the ramp over the last hundred degrees of the firing */
  rampC: number
  scheduleName?: string
  className?: string
}) {
  const rows = cones.map((c) => {
    // log-linear between the two published rates, which is how the tables behave
    const t = clamp(
      (Math.log(clamp(rampC, 15, 150)) - Math.log(15)) / (Math.log(150) - Math.log(15)),
      0,
      1,
    )
    return { ...c, atRamp: c.slowC + (c.fastC - c.slowC) * t, spread: c.fastC - c.slowC }
  })
  const lo = Math.min(...rows.map((r) => r.slowC)) - 10
  const hi = Math.max(...rows.map((r) => r.fastC)) + 10
  const px = (c: number) => ((c - lo) / (hi - lo)) * 100
  const meanSpread = rows.reduce((a, r) => a + r.spread, 0) / Math.max(rows.length, 1)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span>Cone {r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.slowC}–{r.fastC}°C across the published rates
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px] bg-foreground/25"
                style={{ left: `${px(r.slowC)}%`, width: `${px(r.fastC) - px(r.slowC)}%` }}
                title={`${r.slowC}–${r.fastC}°C`}
              />
              <span className="absolute inset-y-0 w-1 rounded-[1px] bg-foreground" style={{ left: `${px(r.atRamp)}%` }} title={`${r.atRamp.toFixed(0)}°C at ${rampC}°C/h`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              bends at {r.atRamp.toFixed(0)}°C on {scheduleName} · a {r.spread}°C spread between the rates
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{lo.toFixed(0)}°C</span>
        <span>solid mark: {rampC}°C/h</span>
        <span>{hi.toFixed(0)}°C</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A cone measures HEATWORK, not temperature — the pale band is the range each cone bends across between 15 and
        150°C/h, and the mark is where it bends at the {rampC}°C/h this schedule climbs · the spread averages{" "}
        {meanSpread.toFixed(0)}°C, which is why a pyrometer reading agreeing with a cone chart proves nothing about the
        firing that produced it
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * KilnLoad — what is on each shelf, with the wasted height derived.
 * A kiln is billed by the firing, so the cost per pot is set by the
 * packing, and the space above a short pot is the whole loss.
 * ------------------------------------------------------------------ */
export function KilnLoad({
  shelves,
  shelfHeightMm,
  firingCost,
  className = "",
}: {
  /** each shelf's pots, by height in mm */
  shelves: { name: string; pots: { name: string; heightMm: number; count: number }[] }[]
  /** the post spacing this shelf was set at */
  shelfHeightMm: number
  firingCost?: number
  className?: string
}) {
  const rows = shelves.map((s) => {
    const tallest = Math.max(0, ...s.pots.map((p) => p.heightMm))
    const count = s.pots.reduce((a, p) => a + p.count, 0)
    // the shelf is set to the tallest pot; everything shorter wastes the rest
    const usedVolume = s.pots.reduce((a, p) => a + p.heightMm * p.count, 0)
    const availableVolume = shelfHeightMm * Math.max(count, 1)
    return { ...s, tallest, count, fill: usedVolume / Math.max(availableVolume, 1), headroom: shelfHeightMm - tallest }
  })
  const totalPots = rows.reduce((a, r) => a + r.count, 0)
  const meanFill = rows.reduce((a, r) => a + r.fill * r.count, 0) / Math.max(totalPots, 1)
  const worst = rows.reduce((a, r) => (r.fill < a.fill ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.count} pots · tallest {r.tallest} mm · {r.headroom} mm spare
              </span>
            </div>
            <div className="relative mt-0.5 flex items-end gap-px rounded-[2px] border border-foreground/20 bg-muted p-px" style={{ height: 40 }}>
              {r.pots.flatMap((p) =>
                Array.from({ length: p.count }, (_, i) => (
                  <div
                    key={`${p.name}-${i}`}
                    className="min-w-0 flex-1 rounded-t-[1px] bg-foreground/70"
                    style={{ height: `${clamp((p.heightMm / shelfHeightMm) * 100, 4, 100)}%` }}
                    title={`${p.name}: ${p.heightMm} mm`}
                  />
                )),
              )}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.fill * 100).toFixed(0)}% of the {shelfHeightMm} mm setting used · {r.count} pot
              {r.count === 1 ? "" : "s"} of the {totalPots} in the load
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A shelf is set to its TALLEST pot, so every shorter pot on it wastes the difference — the fill is derived from
        that, not from how full the shelf looks · {totalPots} pots at {(meanFill * 100).toFixed(0)}% average use, and{" "}
        {worst.name.toLowerCase()} at {(worst.fill * 100).toFixed(0)}% is where sorting by height would pay
        {firingCost
          ? ` · a firing costs the same whatever is in it, so this pack puts £${(firingCost / Math.max(totalPots, 1)).toFixed(2)} of kiln on every pot`
          : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CrazeRisk — glaze against body expansion. Crazing and shivering are
 * the two directions of one mismatch, and which one a pot gets is the
 * SIGN of the difference, which a table of coefficients hides.
 * ------------------------------------------------------------------ */
export function CrazeRisk({
  pairs,
  toleranceppm = 0.5,
  className = "",
}: {
  /** thermal expansion coefficients, ×10⁻⁶ per °C */
  pairs: { name: string; glaze: number; body: number }[]
  /** the mismatch either side of zero that fires without fault */
  toleranceppm?: number
  className?: string
}) {
  const rows = pairs.map((p) => {
    const diff = p.glaze - p.body
    return {
      ...p,
      diff,
      fault: diff > toleranceppm ? "craze" : diff < -toleranceppm ? "shiver" : "fits",
    }
  })
  const span = Math.max(toleranceppm * 3, ...rows.map((r) => Math.abs(r.diff))) * 1.15
  const crazing = rows.filter((r) => r.fault === "craze")
  const shivering = rows.filter((r) => r.fault === "shiver")

  return (
    <div className={className}>
      <div className="relative">
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.name}>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="truncate">{r.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  glaze {r.glaze.toFixed(1)} · body {r.body.toFixed(1)}
                </span>
              </div>
              <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
                <span
                  className="absolute inset-y-0 bg-foreground/12"
                  style={{ left: `${50 - (toleranceppm / span) * 50}%`, width: `${(toleranceppm / span) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0"
                  style={{
                    left: r.diff >= 0 ? "50%" : `${50 - (Math.abs(r.diff) / span) * 50}%`,
                    width: `${(Math.abs(r.diff) / span) * 50}%`,
                    background:
                      r.fault === "fits"
                        ? "color-mix(in oklch, currentColor 40%, transparent)"
                        : r.fault === "craze"
                          ? "currentColor"
                          : "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                    outline: r.fault === "shiver" ? "1px solid currentColor" : undefined,
                    outlineOffset: -1,
                  }}
                  title={`${r.diff > 0 ? "+" : ""}${r.diff.toFixed(2)}`}
                />
                <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/60" />
              </div>
              <span className="text-[9px] tabular-nums text-muted-foreground">
                {r.diff > 0 ? "+" : ""}
                {r.diff.toFixed(2)} ×10⁻⁶/°C → {r.fault}
                {r.fault === "craze" ? " — glaze in tension" : r.fault === "shiver" ? " — glaze in compression" : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>shivering ←</span>
        <span>0</span>
        <span>→ crazing</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is glaze MINUS body, so the side it falls on is the fault it makes — a table of two coefficients does not
        show that they are the same problem with a sign · {crazing.length} craze, {shivering.length} shiver,{" "}
        {rows.length - crazing.length - shivering.length} sit inside the ±{toleranceppm} band · shivering is the
        dangerous one, because the glaze comes off in flakes rather than crackling
      </p>
    </div>
  )
}
