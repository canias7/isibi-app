/**
 * Distilling primitives — spirit cuts, cask evaporation, mash bills, proof
 * accounting, warehouse inventory and sensory profiles.
 *
 * The yield each cut point produces, the volume and strength a cask loses,
 * the fermentable contribution of a grain bill, the proof litres duty is
 * charged on, the value maturing at each age and the profile a panel
 * actually agreed on are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e6 ? `£${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `£${(a / 1e3).toFixed(0)}k` : a < 10 ? `£${a.toFixed(2)}` : `£${Math.round(a).toLocaleString("en-GB")}`
  return v < 0 ? `−${s}` : s
}

/* ------------------------------------------------------------------ *
 * CutPoints — the run, with the YIELD at each candidate cut derived.
 * Heads and tails are decided by nose and the consequence is a
 * number nobody computes until the still is empty.
 * ------------------------------------------------------------------ */
export function CutPoints({
  run,
  cuts,
  height = 200,
  className = "",
}: {
  /** each collected fraction: litres, strength and a congener index */
  run: { litres: number; abv: number; congeners: number }[]
  /** candidate cut points, as the fraction index where hearts start and end */
  cuts: { name: string; from: number; to: number }[]
  height?: number
  className?: string
}) {
  const totalLpa = run.reduce((a, f) => a + (f.litres * f.abv) / 100, 0)
  const rows = cuts.map((c) => {
    const hearts = run.slice(c.from, c.to + 1)
    const litres = hearts.reduce((a, f) => a + f.litres, 0)
    const lpa = hearts.reduce((a, f) => a + (f.litres * f.abv) / 100, 0)
    const congeners = litres > 0 ? hearts.reduce((a, f) => a + f.congeners * f.litres, 0) / litres : 0
    const abv = litres > 0 ? (lpa / litres) * 100 : 0
    return { ...c, litres, lpa, abv, congeners, yield: lpa / Math.max(totalLpa, 1e-9) }
  })
  const maxAbv = Math.max(...run.map((f) => f.abv))
  const maxCong = Math.max(...run.map((f) => f.congeners))
  const px = (i: number) => ((i + 0.5) / run.length) * 100
  const widest = rows.reduce((a, r) => (r.yield > a.yield ? r : a), rows[0])
  const cleanest = rows.reduce((a, r) => (r.congeners < a.congeners ? r : a), rows[0])

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline points={run.map((f, i) => `${px(i)},${100 - (f.abv / maxAbv) * 94 - 3}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <polyline points={run.map((f, i) => `${px(i)},${100 - (f.congeners / maxCong) * 94 - 3}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.3} strokeDasharray="4 2" vectorEffect="non-scaling-stroke" />
        </svg>
        {rows.map((c, i) => (
          <span
            key={c.name}
            className="pointer-events-none absolute border-x border-foreground/60"
            style={{
              left: `${(c.from / run.length) * 100}%`,
              width: `${((c.to - c.from + 1) / run.length) * 100}%`,
              top: `${6 + i * 9}%`,
              height: "7%",
              background: "color-mix(in oklch, currentColor 18%, transparent)",
            }}
            title={`${c.name}: fractions ${c.from + 1}–${c.to + 1}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>fraction 1</span>
        <span>solid ABV · dashed congeners</span>
        <span>{run.length}</span>
      </div>
      <ul className="mt-2 space-y-1 text-[10px] tabular-nums">
        {rows.map((c) => (
          <li key={c.name} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate">{c.name}</span>
            <div className="h-2 flex-1 rounded-[1px] bg-muted">
              <div className="h-full rounded-[1px] bg-foreground/65" style={{ width: `${c.yield * 100}%` }} />
            </div>
            <span className="w-52 shrink-0 text-right text-muted-foreground">
              {c.litres.toFixed(0)} L at {c.abv.toFixed(1)}% · {c.lpa.toFixed(1)} LPA ·{" "}
              {(c.yield * 100).toFixed(0)}% of the run · congeners {c.congeners.toFixed(0)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The cut is made by nose and the CONSEQUENCE is arithmetic — every figure here is summed from the fractions each
        cut would keep · {widest.name.toLowerCase()} takes {(widest.yield * 100).toFixed(0)}% of the run's alcohol and{" "}
        {cleanest.name.toLowerCase()} is the cleanest at {cleanest.congeners.toFixed(0)} congeners,{" "}
        {widest.name === cleanest.name
          ? "which is the same cut and does not usually happen"
          : `which costs ${((widest.yield - cleanest.yield) * 100).toFixed(0)} points of yield`}{" "}
        · a wider cut is more spirit and a different spirit, and the still cannot tell you which you wanted
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AngelShare — what a cask loses, in volume and in strength. Losing
 * 2% a year sounds small and the loss over a maturation is not, and
 * the strength moves the opposite way in a damp warehouse.
 * ------------------------------------------------------------------ */
export function AngelShare({
  warehouses,
  years,
  fillLitres,
  fillAbv,
  height = 190,
  className = "",
}: {
  /** annual volume loss and the annual change in strength, by warehouse */
  warehouses: { name: string; volumeLossPerYear: number; abvChangePerYear: number }[]
  years: number
  fillLitres: number
  fillAbv: number
  height?: number
  className?: string
}) {
  const rows = warehouses.map((w) => {
    const series = Array.from({ length: years + 1 }, (_, y) => {
      const litres = fillLitres * Math.pow(1 - w.volumeLossPerYear, y)
      const abv = fillAbv + w.abvChangePerYear * y
      return { y, litres, abv, lpa: (litres * abv) / 100 }
    })
    const end = series[series.length - 1]
    return { ...w, series, end, lpaLoss: 1 - end.lpa / ((fillLitres * fillAbv) / 100) }
  })
  const maxLpa = (fillLitres * fillAbv) / 100
  // TRUNCATED axis, stated below: from a zero baseline these four curves sit in
  // the top third of the plot and the difference between them is invisible
  const lowest = Math.min(...rows.map((r) => r.end.lpa))
  const floorLpa = Math.max(0, lowest - (maxLpa - lowest) * 0.3)
  const px = (y: number) => (y / Math.max(years, 1)) * 100
  const py = (lpa: number) => 100 - ((lpa - floorLpa) / Math.max(maxLpa - floorLpa, 1e-9)) * 94 - 3
  const dashes = ["none", "5 2", "2 2", "6 2 2 2"]
  const worst = rows.reduce((a, r) => (r.lpaLoss > a.lpaLoss ? r : a), rows[0])
  const strengthening = rows.filter((r) => r.abvChangePerYear > 0)

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {rows.map((r, i) => (
            <polyline
              key={r.name}
              points={r.series.map((s) => `${px(s.y)},${py(s.lpa)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray={dashes[i % dashes.length]}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>fill</span>
        <span>litres of pure alcohol · axis starts at {floorLpa.toFixed(0)}</span>
        <span>{years} years</span>
      </div>
      <ul className="mt-2 space-y-1 text-[10px] tabular-nums">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-2">
            <svg width="22" height="6" className="shrink-0" aria-hidden>
              <line x1={0} y1={3} x2={22} y2={3} stroke="currentColor" strokeWidth={1.5} strokeDasharray={dashes[i % dashes.length]} />
            </svg>
            <span className="w-28 shrink-0 truncate">{r.name}</span>
            <span className="text-muted-foreground">
              {r.end.litres.toFixed(0)} L at {r.end.abv.toFixed(1)}% · {r.end.lpa.toFixed(1)} LPA ·{" "}
              {(r.lpaLoss * 100).toFixed(0)}% of the alcohol gone
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The line is litres of PURE ALCOHOL, which is what is actually lost — volume and strength move independently and
        neither alone says what is left ·{" "}
        {(rows[0].volumeLossPerYear * 100).toFixed(1)}% a year compounds to{" "}
        {(rows[0].lpaLoss * 100).toFixed(0)}% over {years} years in {rows[0].name.toLowerCase()}, and{" "}
        {worst.name.toLowerCase()} loses {(worst.lpaLoss * 100).toFixed(0)}% ·{" "}
        {strengthening.length > 0
          ? `${strengthening.map((r) => r.name.toLowerCase()).join(" and ")} gain${strengthening.length === 1 ? "s" : ""} strength as ${strengthening.length === 1 ? "it loses" : "they lose"} more water than alcohol, which is a dry warehouse and offsets part of the volume loss`
          : "every warehouse here loses strength as well as volume, which is the damp case and the worse one"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * MashBill — the grain bill by weight against its FERMENTABLE
 * contribution. A recipe is quoted in percentages by weight and the
 * spirit comes from extract, which is a different set of numbers.
 * ------------------------------------------------------------------ */
export function MashBill({
  bills,
  className = "",
}: {
  bills: {
    name: string
    grains: { name: string; kg: number; extractPercent: number }[]
  }[]
  className?: string
}) {
  const rows = bills.map((b) => {
    const weight = b.grains.reduce((a, g) => a + g.kg, 0)
    const extract = b.grains.reduce((a, g) => a + (g.kg * g.extractPercent) / 100, 0)
    const grains = b.grains.map((g) => ({
      ...g,
      byWeight: g.kg / Math.max(weight, 1),
      byExtract: (g.kg * g.extractPercent) / 100 / Math.max(extract, 1e-9),
    }))
    const biggestShift = grains.reduce((a, g) => (Math.abs(g.byExtract - g.byWeight) > Math.abs(a.byExtract - a.byWeight) ? g : a), grains[0])
    return { ...b, weight, extract, grains, biggestShift, efficiency: extract / Math.max(weight, 1) }
  })
  const names = Array.from(new Set(rows.flatMap((r) => r.grains.map((g) => g.name))))
  const shade = (i: number) => `color-mix(in oklch, currentColor ${(88 - i * 15).toFixed(0)}%, transparent)`

  return (
    <div className={className}>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate font-medium">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.weight.toFixed(0)} kg → {r.extract.toFixed(0)} kg extract · {(r.efficiency * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-1 space-y-0.5">
              {(["byWeight", "byExtract"] as const).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[9px] text-muted-foreground">{k === "byWeight" ? "by weight" : "by extract"}</span>
                  <div className="flex h-3.5 flex-1 overflow-hidden rounded-[2px] border border-foreground/20">
                    {r.grains.map((g) => (
                      <div
                        key={g.name}
                        className="border-r border-background last:border-r-0"
                        style={{ width: `${g[k] * 100}%`, background: shade(names.indexOf(g.name)) }}
                        title={`${g.name}: ${(g[k] * 100).toFixed(1)}% ${k === "byWeight" ? "of the bill" : "of the extract"}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.biggestShift.name} moves from {(r.biggestShift.byWeight * 100).toFixed(0)}% by weight to{" "}
              {(r.biggestShift.byExtract * 100).toFixed(0)}% by extract
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {names.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25" style={{ background: shade(i) }} />
            {n}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The two bars are the SAME bill by weight and by fermentable extract, and they are not the same recipe — a
        low-extract grain takes more of the bill than it gives to the spirit · a "20% rye" mash bill is a weight, and
        rye's contribution to the alcohol is a different number that nobody prints on the bottle · efficiency runs{" "}
        {(Math.min(...rows.map((r) => r.efficiency)) * 100).toFixed(0)}–
        {(Math.max(...rows.map((r) => r.efficiency)) * 100).toFixed(0)}% across these bills, which is the mash
        rather than the grain
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ProofAccounting — the litres of pure alcohol duty is charged on
 * at each step. Duty is levied on LPA and every operation moves it,
 * so the number on the return is the end of a chain of subtractions.
 * ------------------------------------------------------------------ */
export function ProofAccounting({
  steps,
  dutyPerLpa,
  className = "",
}: {
  /** each step's effect on volume and strength, in order */
  steps: { name: string; litres: number; abv: number; note?: string }[]
  dutyPerLpa: number
  className?: string
}) {
  const rows = steps.map((s, i) => {
    const lpa = (s.litres * s.abv) / 100
    const prev = i === 0 ? null : (steps[i - 1].litres * steps[i - 1].abv) / 100
    return { ...s, lpa, delta: prev === null ? 0 : lpa - prev, loss: prev === null ? 0 : Math.max(0, prev - lpa) }
  })
  const start = rows[0].lpa
  const end = rows[rows.length - 1].lpa
  const losses = rows.reduce((a, r) => a + r.loss, 0)
  const max = Math.max(...rows.map((r) => r.lpa))
  const worst = rows.slice(1).reduce((a, r) => (r.loss > a.loss ? r : a), rows[1] ?? rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.litres.toFixed(0)} L at {r.abv.toFixed(1)}%{r.note ? ` · ${r.note}` : ""}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/60" style={{ width: `${(r.lpa / max) * 100}%` }} title={`${r.lpa.toFixed(1)} LPA`} />
              {r.loss > 0 && (
                <div
                  className="absolute inset-y-0 rounded-r-[2px]"
                  style={{
                    left: `${(r.lpa / max) * 100}%`,
                    width: `${(r.loss / max) * 100}%`,
                    background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                    outline: "1px solid currentColor",
                    outlineOffset: -1,
                  }}
                  title={`lost here: ${r.loss.toFixed(1)} LPA`}
                />
              )}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.lpa.toFixed(1)} LPA · {money(r.lpa * dutyPerLpa)} of duty
              {i > 0 ? ` · ${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(1)} on the step before` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Duty is charged on LITRES OF PURE ALCOHOL, so every step is a subtraction from the number on the return and
        hatched is what left the chain at each one · {start.toFixed(1)} LPA distilled becomes {end.toFixed(1)} in the
        bottle, {losses.toFixed(1)} lost along the way,{" "}
        {((losses / Math.max(start, 1e-9)) * 100).toFixed(0)}% · the biggest single loss is{" "}
        {worst.name.toLowerCase()} at {worst.loss.toFixed(1)} LPA, {money(worst.loss * dutyPerLpa)} of duty that is
        either reclaimable or is not, which is the whole reason the record is kept
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CaskInventory — what is maturing, by age, with the VALUE derived
 * from age rather than from cost. A warehouse is an asset that
 * appreciates and a cost that recurs, and stock reports show one.
 * ------------------------------------------------------------------ */
export function CaskInventory({
  ages,
  valuePerLpaByAge,
  storagePerCaskPerYear,
  className = "",
}: {
  /** casks and their contents at each age in years */
  ages: { year: number; casks: number; lpaEach: number }[]
  /** the market value of a litre of pure alcohol at each age */
  valuePerLpaByAge: { year: number; value: number }[]
  storagePerCaskPerYear: number
  className?: string
}) {
  const valueAt = (y: number) => {
    const sorted = [...valuePerLpaByAge].sort((a, b) => a.year - b.year)
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].year >= y) {
        const a = sorted[i - 1]
        const b = sorted[i]
        return a.value + ((y - a.year) * (b.value - a.value)) / Math.max(b.year - a.year, 1e-9)
      }
    }
    return sorted[sorted.length - 1].value
  }
  const rows = [...ages]
    .sort((a, b) => a.year - b.year)
    .map((a) => {
      const lpa = a.casks * a.lpaEach
      const value = lpa * valueAt(a.year)
      const nextValue = lpa * valueAt(a.year + 1) * 0.98 // a year's evaporation
      const carry = a.casks * storagePerCaskPerYear
      return { ...a, lpa, value, carry, gain: nextValue - value - carry }
    })
  const totalCasks = rows.reduce((a, r) => a + r.casks, 0)
  const totalValue = rows.reduce((a, r) => a + r.value, 0)
  const totalCarry = rows.reduce((a, r) => a + r.carry, 0)
  const max = Math.max(...rows.map((r) => r.value))
  const losing = rows.filter((r) => r.gain < 0)

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.year} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span className="w-12 shrink-0">{r.year} y</span>
            <span className="w-16 shrink-0 text-right text-muted-foreground">{r.casks} casks</span>
            <div className="relative h-4 flex-1 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 left-0 rounded-[2px] bg-foreground/60" style={{ width: `${(r.value / max) * 100}%` }} title={`${money(r.value)} of stock`} />
              <div
                className="absolute inset-y-0"
                style={{
                  left: `${(r.value / max) * 100}%`,
                  width: `${clamp((Math.abs(r.gain) / max) * 100, 0.4, 100)}%`,
                  background:
                    r.gain >= 0
                      ? "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)"
                      : "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)",
                  outline: r.gain < 0 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`${r.gain >= 0 ? "gains" : "loses"} ${money(Math.abs(r.gain))} next year`}
              />
            </div>
            <span className="w-48 shrink-0 text-right text-muted-foreground">
              {money(r.value)} · another year {r.gain >= 0 ? "+" : "−"}
              {money(Math.abs(r.gain))}
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Casks</dt>
          <dd className="font-medium tabular-nums">{totalCasks.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Stock value</dt>
          <dd className="font-medium tabular-nums">{money(totalValue)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Carry a year</dt>
          <dd className="font-medium tabular-nums">{money(totalCarry)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Solid is the stock's value and the mark past it is what ANOTHER YEAR does — appreciation minus evaporation
        minus storage, derived rather than assumed to be positive ·{" "}
        {losing.length === 0
          ? "every age band here still gains by waiting"
          : `${losing.map((r) => `${r.year} y`).join(", ")} now ${losing.length === 1 ? "loses" : "lose"} money by waiting, because the value curve flattens while the carry and the angels do not`}{" "}
        · {money(totalValue)} maturing against {money(totalCarry)} a year to hold it, which is a stock report and a
        cash-flow problem written on the same line
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * NosingProfile — a tasting panel's scores, with AGREEMENT derived.
 * A spider chart of averages presents a panel that disagreed
 * violently as a confident consensus.
 * ------------------------------------------------------------------ */
export function NosingProfile({
  attributes,
  panels,
  size = 220,
  className = "",
}: {
  attributes: string[]
  /** each taster's score for each attribute, 0-10 */
  panels: { name: string; scores: number[] }[]
  size?: number
  className?: string
}) {
  const stats = attributes.map((_, ai) => {
    const vals = panels.map((p) => p.scores[ai])
    const mean = vals.reduce((a, v) => a + v, 0) / Math.max(vals.length, 1)
    const sd = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(vals.length, 1))
    return { mean, sd, lo: Math.max(0, mean - sd), hi: Math.min(10, mean + sd), range: Math.max(...vals) - Math.min(...vals) }
  })
  // the wheel is square and the LABELS are not — a label ring inside a square
  // box either overlaps the plot or is clipped, so the viewBox is widened
  // sideways instead and the plot keeps its radius
  const pad = 38
  const r = size / 2 - 14
  const pt = (ai: number, v: number) => {
    const a = (ai / attributes.length) * Math.PI * 2 - Math.PI / 2
    const rr = (v / 10) * r
    return [size / 2 + rr * Math.cos(a), size / 2 + rr * Math.sin(a)]
  }
  const contested = stats.reduce((a, s, i) => (s.sd > stats[a].sd ? i : a), 0)
  const agreed = stats.reduce((a, s, i) => (s.sd < stats[a].sd ? i : a), 0)
  const meanSd = stats.reduce((a, s) => a + s.sd, 0) / Math.max(stats.length, 1)

  return (
    <div className={className}>
      <svg
        viewBox={`${-pad} 0 ${size + pad * 2} ${size}`}
        className="mx-auto block h-auto w-full"
        style={{ maxWidth: size + pad * 2 }}
      >
        {[2.5, 5, 7.5, 10].map((v) => (
          <polygon
            key={v}
            points={attributes.map((_, i) => pt(i, v).join(",")).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.4}
            opacity={0.25}
          />
        ))}
        {/* the SPREAD as a band, so a contested attribute cannot masquerade
            as a confident one — a mean alone always looks certain */}
        <polygon
          points={[
            ...attributes.map((_, i) => pt(i, stats[i].hi).join(",")),
            ...attributes.map((_, i) => pt(attributes.length - 1 - i, stats[attributes.length - 1 - i].lo).join(",")),
          ].join(" ")}
          fill="currentColor"
          opacity={0.16}
        />
        <polygon
          points={attributes.map((_, i) => pt(i, stats[i].mean).join(",")).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
        />
        {attributes.map((a, i) => {
          const [x, y] = pt(i, 11.2)
          // a centred label at the extreme left or right of the wheel extends past
          // the viewBox and is silently clipped — which is how "Sweetness" rendered
          // as "weetness". Clamping the anchor keeps the whole word on canvas.
          const lx = Math.min(Math.max(x, 24), size - 24)
          return (
            <text key={a} x={lx} y={y} fontSize={7} textAnchor="middle" dominantBaseline="middle" fill="currentColor" opacity={0.7}>
              {a}
            </text>
          )
        })}
      </svg>
      <ul className="mt-1 space-y-0.5 text-[10px] tabular-nums">
        {attributes.map((a, i) => (
          <li key={a} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate">{a}</span>
            <div className="relative h-2 flex-1 rounded-[1px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[1px] bg-foreground/30"
                style={{ left: `${(stats[i].lo / 10) * 100}%`, width: `${((stats[i].hi - stats[i].lo) / 10) * 100}%` }}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${(stats[i].mean / 10) * 100}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right text-muted-foreground">
              {stats[i].mean.toFixed(1)} ± {stats[i].sd.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The shaded band is one standard deviation across {panels.length} tasters, and it is the point — a spider chart
        of MEANS presents a panel that disagreed violently as a confident consensus ·{" "}
        {attributes[agreed].toLowerCase()} is the one everybody agreed on (± {stats[agreed].sd.toFixed(1)}) and{" "}
        {attributes[contested].toLowerCase()} is contested (± {stats[contested].sd.toFixed(1)}, a spread of{" "}
        {stats[contested].range.toFixed(0)} points) · average disagreement is ± {meanSd.toFixed(1)}, which is what a
        panel of this size is worth
      </p>
    </div>
  )
}
