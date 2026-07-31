/**
 * Building services primitives — psychrometrics, fan and system curves,
 * coil loads, duct static, plant sequencing and setback schedules.
 *
 * The comfort verdict from dry bulb and humidity together, the operating
 * point where two curves cross, the sensible/latent split, where the static
 * pressure actually goes, which plant is running when, and what a setback
 * really saves are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) =>
  "£" + (Math.abs(v) < 10 ? Math.abs(v).toFixed(2) : Math.round(Math.abs(v)).toLocaleString("en-GB"))

/** saturation vapour pressure, kPa — Magnus, good to a tenth of a degree */
const svp = (tC: number) => 0.61094 * Math.exp((17.625 * tC) / (tC + 243.04))
/** humidity ratio in g/kg from dry bulb and relative humidity */
const humidityRatio = (tC: number, rh: number, pKpa = 101.325) => {
  const pv = (rh / 100) * svp(tC)
  return (622 * pv) / Math.max(pKpa - pv, 1e-6)
}

/* ------------------------------------------------------------------ *
 * PsychrometricChart — readings plotted against the comfort envelope.
 * Temperature alone cannot answer a comfort complaint, and humidity
 * ratio has to be COMPUTED before two rooms can be compared.
 * ------------------------------------------------------------------ */
export function PsychrometricChart({
  readings,
  comfort,
  height = 210,
  className = "",
}: {
  readings: { name: string; dryBulbC: number; rhPercent: number }[]
  /** the envelope as dry bulb range and humidity-ratio range in g/kg */
  comfort: { tC: [number, number]; wGkg: [number, number] }
  height?: number
  className?: string
}) {
  const rows = readings.map((r) => {
    const w = humidityRatio(r.dryBulbC, r.rhPercent)
    const tooWarm = r.dryBulbC > comfort.tC[1]
    const tooCool = r.dryBulbC < comfort.tC[0]
    const tooDamp = w > comfort.wGkg[1]
    const tooDry = w < comfort.wGkg[0]
    return {
      ...r,
      w,
      inside: !tooWarm && !tooCool && !tooDamp && !tooDry,
      why: [tooWarm && "too warm", tooCool && "too cool", tooDamp && "too damp", tooDry && "too dry"].filter(Boolean).join(" and "),
    }
  })
  const tLo = Math.min(comfort.tC[0] - 4, ...rows.map((r) => r.dryBulbC)) - 1
  const tHi = Math.max(comfort.tC[1] + 4, ...rows.map((r) => r.dryBulbC)) + 1
  const wHi = Math.max(comfort.wGkg[1] + 4, ...rows.map((r) => r.w)) + 1
  const px = (t: number) => ((t - tLo) / Math.max(tHi - tLo, 1e-9)) * 100
  const py = (w: number) => 100 - (w / Math.max(wHi, 1e-9)) * 100
  const outside = rows.filter((r) => !r.inside)
  const warmOnly = rows.filter((r) => !r.inside && r.dryBulbC <= comfort.tC[1] && r.dryBulbC >= comfort.tC[0])

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {[20, 40, 60, 80, 100].map((rh) => (
            <polyline
              key={rh}
              points={Array.from({ length: 24 }, (_, i) => {
                const t = tLo + ((tHi - tLo) * i) / 23
                return `${px(t)},${py(humidityRatio(t, rh))}`
              }).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={rh === 100 ? 1 : 0.4}
              opacity={rh === 100 ? 0.55 : 0.22}
            />
          ))}
          <rect
            x={px(comfort.tC[0])}
            y={py(comfort.wGkg[1])}
            width={px(comfort.tC[1]) - px(comfort.tC[0])}
            height={py(comfort.wGkg[0]) - py(comfort.wGkg[1])}
            fill="currentColor"
            opacity={0.13}
            stroke="currentColor"
            strokeWidth={0.6}
          />
        </svg>
        {rows.map((r) => (
          <span
            key={r.name}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground"
            style={{
              left: `${clamp(px(r.dryBulbC), 2, 98)}%`,
              top: `${clamp(py(r.w), 3, 97)}%`,
              background: r.inside ? "currentColor" : "var(--background)",
            }}
            title={`${r.name}: ${r.dryBulbC}°C, ${r.rhPercent}% RH → ${r.w.toFixed(1)} g/kg${r.inside ? "" : ` — ${r.why}`}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{tLo.toFixed(0)}°C</span>
        <span>filled: inside the envelope</span>
        <span>{tHi.toFixed(0)}°C</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span aria-hidden className="w-3">
              {r.inside ? "●" : "○"}
            </span>
            <span className="w-28 shrink-0 truncate">{r.name}</span>
            <span className="text-muted-foreground">
              {r.dryBulbC.toFixed(1)}°C · {r.rhPercent}% RH · {r.w.toFixed(1)} g/kg
              {r.inside ? "" : ` — ${r.why}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Humidity ratio is COMPUTED from dry bulb and relative humidity, because two rooms at 60% RH and different
        temperatures hold quite different amounts of water and cannot be compared on the percentage ·{" "}
        {outside.length} of {rows.length} readings sit outside the envelope
        {warmOnly.length > 0
          ? `, and ${warmOnly.length} of those ${warmOnly.length === 1 ? "is" : "are"} at an acceptable TEMPERATURE — which is the complaint a thermostat cannot answer`
          : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * FanCurve — the fan against the system, with the OPERATING POINT
 * derived from where they cross. A fan is selected from its own
 * curve and it runs where the ductwork puts it.
 * ------------------------------------------------------------------ */
export function FanCurve({
  fan,
  systems,
  dutyLs,
  height = 200,
  className = "",
}: {
  /** the fan's pressure at each flow */
  fan: { ls: number; pa: number }[]
  /** each system curve, as a resistance coefficient: pa = k × ls² */
  systems: { name: string; k: number }[]
  /** the flow the design asked for */
  dutyLs?: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!fan.length || !systems.length) return null

  const pts = [...fan].sort((a, b) => a.ls - b.ls)
  const fanAt = (ls: number) => {
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].ls >= ls) {
        const a = pts[i - 1]
        const b = pts[i]
        return a.pa + ((ls - a.ls) * (b.pa - a.pa)) / Math.max(b.ls - a.ls, 1e-9)
      }
    }
    return pts[pts.length - 1].pa
  }
  const rows = systems.map((s) => {
    // bisect for the crossing rather than scanning, so the answer does not
    // depend on how finely the fan curve happens to be sampled
    let lo = pts[0].ls
    let hi = pts[pts.length - 1].ls
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (s.k * mid * mid < fanAt(mid)) lo = mid
      else hi = mid
    }
    const ls = (lo + hi) / 2
    return { ...s, ls, pa: s.k * ls * ls, shortfall: dutyLs === undefined ? null : ls - dutyLs }
  })
  const maxLs = pts[pts.length - 1].ls
  const maxPa = Math.max(...pts.map((p) => p.pa), ...rows.map((r) => r.pa))
  const px = (ls: number) => (ls / Math.max(maxLs, 1e-9)) * 100
  const py = (pa: number) => 100 - (pa / Math.max(maxPa, 1e-9)) * 94 - 3
  const dashes = ["5 2", "2 2", "6 2 2 2"]
  const missing = rows.filter((r) => r.shortfall !== null && r.shortfall < 0)

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline points={pts.map((p) => `${px(p.ls)},${py(p.pa)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          {rows.map((s, i) => (
            <polyline
              key={s.name}
              points={Array.from({ length: 30 }, (_, j) => {
                const ls = (maxLs * j) / 29
                return `${px(ls)},${py(s.k * ls * ls)}`
              }).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.2}
              strokeDasharray={dashes[i % dashes.length]}
              opacity={0.75}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {dutyLs !== undefined && <line x1={px(dutyLs)} y1={0} x2={px(dutyLs)} y2={100} stroke="currentColor" strokeWidth={0.8} opacity={0.45} />}
        </svg>
        {rows.map((s) => (
          <span
            key={s.name}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-background"
            style={{ left: `${clamp(px(s.ls), 1, 99)}%`, top: `${clamp(py(s.pa), 2, 98)}%` }}
            title={`${s.name}: ${Math.round(s.ls)} l/s at ${Math.round(s.pa)} Pa`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 l/s</span>
        <span>solid: fan · dashed: system</span>
        <span>{maxLs} l/s</span>
      </div>
      <ul className="mt-2 space-y-1 text-[10px] tabular-nums">
        {rows.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2">
            <svg width="22" height="6" className="shrink-0" aria-hidden>
              <line x1={0} y1={3} x2={22} y2={3} stroke="currentColor" strokeWidth={1.2} strokeDasharray={dashes[i % dashes.length]} />
            </svg>
            <span className="w-32 shrink-0 truncate">{s.name}</span>
            <span className="text-muted-foreground">
              runs at {Math.round(s.ls)} l/s and {Math.round(s.pa)} Pa
              {s.shortfall !== null ? ` · ${s.shortfall >= 0 ? "+" : ""}${Math.round(s.shortfall)} l/s against duty` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The rings are OPERATING POINTS, found where the fan curve crosses each system curve — a fan is selected from
        its own curve and it runs where the ductwork puts it ·{" "}
        {missing.length === 0
          ? "every system here reaches its duty"
          : `${missing.length === 1 ? missing[0].name : `${missing.slice(0, -1).map((r) => r.name).join(", ")} and ${missing[missing.length - 1].name}`} fall${missing.length === 1 ? "s" : ""} short by up to ${Math.abs(Math.round(Math.min(...missing.map((r) => r.shortfall!))))} l/s, and no amount of commissioning moves an operating point that is on the wrong curve`}{" "}
        · resistance goes with the SQUARE of flow, so a filter loading up costs far more than it looks
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CoilLoadSplit — sensible against latent load. A coil sized on the
 * total does not dehumidify, and the split is derived from the air
 * conditions rather than assumed at a fixed ratio.
 * ------------------------------------------------------------------ */
export function CoilLoadSplit({
  cases,
  supplyC,
  supplyRh,
  className = "",
}: {
  /** each case's air flow and entering condition */
  cases: { name: string; ls: number; onCoilC: number; onCoilRh: number }[]
  /** the off-coil condition the plant is set to deliver */
  supplyC: number
  supplyRh: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!cases.length) return null

  const CP = 1.006 // kJ/kg·K
  const HFG = 2501 // kJ/kg
  const RHO = 1.2 // kg/m³
  const wOut = humidityRatio(supplyC, supplyRh)
  const rows = cases.map((c) => {
    const kgs = (c.ls / 1000) * RHO
    const wIn = humidityRatio(c.onCoilC, c.onCoilRh)
    const sensible = kgs * CP * (c.onCoilC - supplyC)
    const latent = (kgs * HFG * Math.max(0, wIn - wOut)) / 1000
    const total = sensible + latent
    return { ...c, wIn, sensible, latent, total, shr: total > 0 ? sensible / total : 1 }
  })
  const totals = rows.reduce((a, r) => ({ s: a.s + r.sensible, l: a.l + r.latent }), { s: 0, l: 0 })
  const overall = totals.s / Math.max(totals.s + totals.l, 1e-9)
  const max = Math.max(...rows.map((r) => r.total))
  const wettest = rows.reduce((a, r) => (r.shr < a.shr ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.ls} l/s · {r.onCoilC}°C, {r.onCoilRh}% on ({r.wIn.toFixed(1)} g/kg)
              </span>
            </div>
            <div className="mt-0.5 flex h-4 rounded-[2px] bg-muted" style={{ width: `${(r.total / max) * 100}%` }}>
              <div
                className="rounded-l-[2px] bg-foreground"
                style={{ width: `${(r.sensible / Math.max(r.total, 1e-9)) * 100}%` }}
                title={`sensible ${r.sensible.toFixed(1)} kW`}
              />
              <div
                className="rounded-r-[2px]"
                style={{
                  width: `${(r.latent / Math.max(r.total, 1e-9)) * 100}%`,
                  background: "repeating-linear-gradient(45deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: r.latent > 0 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`latent ${r.latent.toFixed(1)} kW`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.total.toFixed(1)} kW total · {r.sensible.toFixed(1)} sensible + {r.latent.toFixed(1)} latent · SHR{" "}
              {r.shr.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched is LATENT load — the energy spent condensing water rather than dropping temperature — and it is derived
        from the humidity ratio either side of the coil, never assumed · the plant carries{" "}
        {(totals.s + totals.l).toFixed(1)} kW at an overall sensible heat ratio of {overall.toFixed(2)} ·{" "}
        {wettest.name.toLowerCase()} is the wettest case at {wettest.shr.toFixed(2)}, and a coil selected on the
        TOTAL will hold its temperature there and leave the room clammy, which is the complaint that follows every
        summer
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DuctStatic — where the fan's pressure goes. A pressure budget is
 * quoted as one number and spent in a dozen places, and the ones
 * that grow over the life of the building are not the ductwork.
 * ------------------------------------------------------------------ */
export function DuctStatic({
  items,
  fanPa,
  className = "",
}: {
  /** each component's clean pressure drop and its dirty one, where it changes */
  items: { name: string; cleanPa: number; dirtyPa?: number; fixed?: boolean }[]
  fanPa: number
  className?: string
}) {
  const rows = [...items].sort((a, b) => (b.dirtyPa ?? b.cleanPa) - (a.dirtyPa ?? a.cleanPa))
  const clean = rows.reduce((a, r) => a + r.cleanPa, 0)
  const dirty = rows.reduce((a, r) => a + (r.dirtyPa ?? r.cleanPa), 0)
  const growth = rows.filter((r) => (r.dirtyPa ?? r.cleanPa) > r.cleanPa)
  const max = Math.max(fanPa, ...rows.map((r) => r.dirtyPa ?? r.cleanPa))
  const headroomClean = fanPa - clean
  const headroomDirty = fanPa - dirty

  return (
    <div className={className}>
      {/* the budget as one bar, then its parts */}
      <div className="relative mb-3 h-6 rounded-[2px] border border-foreground/25 bg-muted">
        <div className="absolute inset-y-0 left-0 bg-foreground/30" style={{ width: `${clamp((clean / Math.max(fanPa, 1)) * 100, 0, 100)}%` }} title={`clean ${clean} Pa`} />
        <div
          className="absolute inset-y-0"
          style={{
            left: `${clamp((clean / Math.max(fanPa, 1)) * 100, 0, 100)}%`,
            width: `${clamp(((dirty - clean) / Math.max(fanPa, 1)) * 100, 0, 100)}%`,
            background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
            outline: "1px solid currentColor",
            outlineOffset: -1,
          }}
          title={`growth to dirty: ${dirty - clean} Pa`}
        />
      </div>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span aria-hidden className="w-3">
              {r.dirtyPa !== undefined && r.dirtyPa > r.cleanPa ? "↑" : "·"}
            </span>
            <span className="w-32 shrink-0 truncate">{r.name}</span>
            <div className="relative h-2.5 flex-1 rounded-[1px] bg-muted">
              <div className="absolute inset-y-0 left-0 rounded-[1px] bg-foreground/60" style={{ width: `${(r.cleanPa / max) * 100}%` }} />
              {r.dirtyPa !== undefined && r.dirtyPa > r.cleanPa && (
                <div
                  className="absolute inset-y-0 rounded-r-[1px]"
                  style={{
                    left: `${(r.cleanPa / max) * 100}%`,
                    width: `${((r.dirtyPa - r.cleanPa) / max) * 100}%`,
                    background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  }}
                />
              )}
            </div>
            <span className="w-24 shrink-0 text-right text-muted-foreground">
              {r.cleanPa}
              {r.dirtyPa !== undefined && r.dirtyPa > r.cleanPa ? `→${r.dirtyPa}` : ""} Pa
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar at the top is the fan's {fanPa} Pa, with the clean system solid and the growth to a dirty one hatched ·
        the system starts at {clean} Pa with {headroomClean} Pa spare and ends at {dirty} Pa with{" "}
        {headroomDirty >= 0 ? `${headroomDirty} Pa spare` : `${Math.abs(headroomDirty)} Pa MORE than the fan has`} ·{" "}
        {growth.length === 0
          ? "nothing here is stated as growing with use"
          : `all of the growth is in ${growth.map((r) => r.name.toLowerCase()).join(" and ")} — the ductwork never changes and the filters always do, which is why a design that fits clean stops delivering in year two`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PlantSequence — which plant ran when, against the outside
 * temperature, with SIMULTANEOUS heating and cooling derived. It is
 * the most expensive fault in a building and it looks like normal
 * operation on every individual trend.
 * ------------------------------------------------------------------ */
export function PlantSequence({
  hours,
  outsideC,
  plant,
  className = "",
}: {
  hours: string[]
  outsideC: number[]
  /** each plant item's on/off state per hour, and whether it heats or cools */
  plant: { name: string; mode: "heat" | "cool" | "other"; on: boolean[] }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!hours.length || !outsideC.length || !plant.length) return null

  const clash = hours.map((_, i) => {
    const heating = plant.some((p) => p.mode === "heat" && p.on[i])
    const cooling = plant.some((p) => p.mode === "cool" && p.on[i])
    return heating && cooling
  })
  const clashHours = clash.filter(Boolean).length
  const runtime = plant.map((p) => p.on.filter(Boolean).length)
  const tLo = Math.min(...outsideC)
  const tHi = Math.max(...outsideC)
  const py = (t: number) => 100 - ((t - tLo) / Math.max(tHi - tLo, 1e-9)) * 88 - 6
  const busiest = runtime.indexOf(Math.max(...runtime))

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height: 72 }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline
            points={outsideC.map((t, i) => `${(i / Math.max(hours.length - 1, 1)) * 100},${py(t)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="absolute left-1 top-0.5 text-[9px] tabular-nums text-muted-foreground">{tHi.toFixed(0)}°C outside</span>
        <span className="absolute bottom-0.5 left-1 text-[9px] tabular-nums text-muted-foreground">{tLo.toFixed(0)}°C</span>
      </div>
      <ul className="mt-2 space-y-1">
        {plant.map((p, pi) => (
          <li key={p.name} className="flex items-center gap-2 text-[10px]">
            <span className="w-28 shrink-0 truncate">{p.name}</span>
            <div className="flex flex-1 gap-px">
              {p.on.map((on, i) => (
                <span
                  key={i}
                  className="h-3 min-w-0 flex-1 rounded-[1px]"
                  style={{
                    background: !on
                      ? "color-mix(in oklch, currentColor 8%, transparent)"
                      : p.mode === "heat"
                        ? "currentColor"
                        : p.mode === "cool"
                          ? "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 4px)"
                          : "color-mix(in oklch, currentColor 42%, transparent)",
                    outline: on && p.mode === "cool" ? "1px solid currentColor" : undefined,
                    outlineOffset: -1,
                  }}
                  title={`${p.name} at ${hours[i]}: ${on ? "on" : "off"}`}
                />
              ))}
            </div>
            <span className="w-20 shrink-0 text-right tabular-nums text-muted-foreground">
              {runtime[pi]} h · {p.mode}
            </span>
          </li>
        ))}
        {/* the derived row: both at once */}
        <li className="flex items-center gap-2 text-[10px]">
          <span className="w-28 shrink-0 truncate font-medium">Both at once</span>
          <div className="flex flex-1 gap-px">
            {clash.map((c, i) => (
              <span
                key={i}
                className="h-3 min-w-0 flex-1 rounded-[1px]"
                style={{ background: c ? "currentColor" : "color-mix(in oklch, currentColor 8%, transparent)" }}
                title={`${hours[i]}: ${c ? "heating AND cooling" : "no clash"}`}
              />
            ))}
          </div>
          <span className="w-20 shrink-0 text-right tabular-nums font-medium">{clashHours} h</span>
        </li>
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bottom row is DERIVED: hours where something was heating while something else was cooling · that is the
        most expensive fault a building has and it is invisible on every individual trend, because each plant item
        looks like it is doing its job ·{" "}
        {clashHours === 0
          ? "there is no clash in this day, which is what a correct sequence looks like"
          : `${clashHours} of ${hours.length} hours are spent paying twice, and they cluster where the outside temperature crosses the changeover`}{" "}
        · {plant[busiest].name.toLowerCase()} runs longest at {runtime[busiest]} hours
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SetbackSchedule — the setpoint through a week against occupancy,
 * with the DEGREE-HOURS saved derived. A setback saves nothing where
 * the building is empty anyway and everything where it is not.
 * ------------------------------------------------------------------ */
export function SetbackSchedule({
  days,
  hoursPerDay = 24,
  occupiedSetpoint,
  setbackSetpoint,
  outsideMeanC,
  kwhPerDegreeHour,
  pencePerKwh,
  className = "",
}: {
  /** each day's occupied hours and the hours the plant is actually enabled */
  days: { name: string; occupied: [number, number]; enabled: [number, number] }[]
  hoursPerDay?: number
  occupiedSetpoint: number
  setbackSetpoint: number
  outsideMeanC: number
  kwhPerDegreeHour: number
  pencePerKwh?: number
  className?: string
}) {
  const rows = days.map((d) => {
    const occHours = Math.max(0, d.occupied[1] - d.occupied[0])
    const enHours = Math.max(0, d.enabled[1] - d.enabled[0])
    const preheat = Math.max(0, d.occupied[0] - d.enabled[0])
    const overrun = Math.max(0, d.enabled[1] - d.occupied[1])
    // degree-hours above the setback, which is what the setback actually buys
    const held = enHours * (occupiedSetpoint - outsideMeanC)
    const ifAlwaysOn = hoursPerDay * (occupiedSetpoint - outsideMeanC)
    const setbackHours = (hoursPerDay - enHours) * (setbackSetpoint - outsideMeanC)
    return { ...d, occHours, enHours, preheat, overrun, degHours: held + setbackHours, saved: ifAlwaysOn - (held + setbackHours) }
  })
  const saved = rows.reduce((a, r) => a + r.saved, 0)
  const kwh = saved * kwhPerDegreeHour
  const unoccupiedEnabled = rows.reduce((a, r) => a + r.preheat + r.overrun, 0)
  const px = (h: number) => (h / hoursPerDay) * 100

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span className="w-10 shrink-0">{r.name}</span>
            <div className="relative h-4 flex-1 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px]"
                style={{
                  left: `${px(r.enabled[0])}%`,
                  width: `${px(r.enHours)}%`,
                  background: "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)",
                }}
                title={`plant enabled ${r.enabled[0]}:00–${r.enabled[1]}:00`}
              />
              <div
                className="absolute inset-y-0 rounded-[2px] bg-foreground"
                style={{ left: `${px(r.occupied[0])}%`, width: `${px(r.occHours)}%` }}
                title={`occupied ${r.occupied[0]}:00–${r.occupied[1]}:00`}
              />
            </div>
            <span className="w-32 shrink-0 text-right text-muted-foreground">
              {r.preheat > 0 ? `${r.preheat}h preheat` : "no preheat"} ·{" "}
              {r.overrun > 0 ? `${r.overrun}h overrun` : "no overrun"}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>00:00</span>
        <span>solid: occupied · hatched: plant enabled</span>
        <span>{hoursPerDay}:00</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Degree-hours saved</dt>
          <dd className="font-medium tabular-nums">{Math.round(saved).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Energy</dt>
          <dd className="font-medium tabular-nums">{Math.round(kwh).toLocaleString()} kWh</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{pencePerKwh ? "Weekly" : "Enabled hours"}</dt>
          <dd className="font-medium tabular-nums">
            {pencePerKwh ? money((kwh * pencePerKwh) / 100) : rows.reduce((a, r) => a + r.enHours, 0)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The saving is DEGREE-HOURS, not hours — holding {occupiedSetpoint}°C against a {outsideMeanC}°C week costs in
        proportion to the difference, so a setback to {setbackSetpoint}°C buys{" "}
        {(((occupiedSetpoint - setbackSetpoint) / Math.max(occupiedSetpoint - outsideMeanC, 1e-9)) * 100).toFixed(0)}%
        of the load for every hour it holds · {Math.round(saved).toLocaleString()} degree-hours,{" "}
        {Math.round(kwh).toLocaleString()} kWh a week
        {pencePerKwh ? `, ${money((kwh * pencePerKwh) / 100)}` : ""} · the plant runs {unoccupiedEnabled} hours a week
        with nobody in the building, which is preheat and overrun and is where the next saving is
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * VentilationRate — air per person against the standard, with the
 * CO₂ that follows derived. A ventilation rate is an input and CO₂
 * is what an occupant complains about, and one predicts the other.
 * ------------------------------------------------------------------ */
export function VentilationRate({
  rooms,
  standardLsPerson = 10,
  outdoorPpm = 420,
  className = "",
}: {
  rooms: { name: string; people: number; supplyLs: number; volumeM3?: number }[]
  standardLsPerson?: number
  outdoorPpm?: number
  className?: string
}) {
  // one adult at rest generates roughly 0.005 l/s of CO2
  const GEN = 0.005
  const rows = rooms
    .map((r) => {
      const perPerson = r.supplyLs / Math.max(r.people, 1)
      // steady state: ppm = outdoor + generation/supply, in parts per million
      const steady = outdoorPpm + (r.people * GEN * 1e6) / Math.max(r.supplyLs, 1e-9)
      return { ...r, perPerson, steady, meets: perPerson >= standardLsPerson }
    })
    .sort((a, b) => b.steady - a.steady)
  const maxPpm = Math.max(1500, ...rows.map((r) => r.steady))
  const failing = rows.filter((r) => !r.meets)
  const over1500 = rows.filter((r) => r.steady > 1500)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.people} people · {r.supplyLs} l/s · {r.perPerson.toFixed(1)} l/s each
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${clamp((r.steady / maxPpm) * 100, 2, 100)}%`,
                  background: r.steady > 1500 ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 52%, transparent)",
                  outline: r.steady > 1500 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`${Math.round(r.steady)} ppm at steady state`}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(1000 / maxPpm) * 100}%` }} title="1000 ppm" />
              <span className="absolute inset-y-0 w-px bg-foreground/45" style={{ left: `${(1500 / maxPpm) * 100}%` }} title="1500 ppm" />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {Math.round(r.steady)} ppm at steady state ·{" "}
              {r.meets ? `meets the ${standardLsPerson} l/s standard` : `${(standardLsPerson - r.perPerson).toFixed(1)} l/s a person short`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is the CO₂ this supply rate PRODUCES at steady state, derived from occupancy rather than measured —
        ventilation is what a designer specifies and CO₂ is what an occupant notices, and one predicts the other
        exactly · marks at 1000 and 1500 ppm · {failing.length} of {rows.length} rooms are below the{" "}
        {standardLsPerson} l/s standard and {over1500.length} will pass 1500 ppm when full, which is where people
        report the room as stuffy without knowing why
      </p>
    </div>
  )
}
