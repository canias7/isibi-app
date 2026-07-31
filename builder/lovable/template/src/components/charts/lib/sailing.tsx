/**
 * Sailing primitives — boat polars, tidal gates, handicap correction,
 * laylines, sail crossovers and passage plans.
 *
 * The best VMG angle at each wind speed, the window a tidal gate is open,
 * the corrected time that decides a race, the distance a tack costs, the
 * wind ranges where two sails swap and the ETA a passage really produces
 * are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * PolarDiagram — boat speed by wind angle, with the OPTIMUM UPWIND
 * and DOWNWIND angles derived from velocity made good. A polar shows
 * where the boat is fastest; VMG says where it gets there soonest,
 * and they are never the same angle.
 * ------------------------------------------------------------------ */
export function PolarDiagram({
  windSpeeds,
  angles,
  speeds,
  size = 220,
  className = "",
}: {
  windSpeeds: number[]
  /** true wind angles in degrees, 0 = head to wind */
  angles: number[]
  /** speeds[windSpeed][angle] in knots */
  speeds: number[][]
  size?: number
  className?: string
}) {
  const rows = windSpeeds.map((w, wi) => {
    const vmgUp = angles.map((a, ai) => speeds[wi][ai] * Math.cos((a * Math.PI) / 180))
    const vmgDown = angles.map((a, ai) => -speeds[wi][ai] * Math.cos((a * Math.PI) / 180))
    const up = vmgUp.indexOf(Math.max(...vmgUp))
    const down = vmgDown.indexOf(Math.max(...vmgDown))
    const fastest = speeds[wi].indexOf(Math.max(...speeds[wi]))
    return {
      wind: w,
      upAngle: angles[up],
      upVmg: vmgUp[up],
      downAngle: angles[down],
      downVmg: vmgDown[down],
      fastestAngle: angles[fastest],
      top: speeds[wi][fastest],
    }
  })
  const maxSpeed = Math.max(...speeds.flat())
  const r = size / 2 - 12
  const pt = (angleDeg: number, speed: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    const rr = (speed / Math.max(maxSpeed, 1e-9)) * r
    return [size / 2 + rr * Math.cos(rad), size / 2 + rr * Math.sin(rad)]
  }
  const dashes = ["none", "5 2", "2 2", "6 2 2 2"]

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block" style={{ width: size, height: size }}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <circle key={f} cx={size / 2} cy={size / 2} r={r * f} fill="none" stroke="currentColor" strokeWidth={0.5} opacity={0.25} />
        ))}
        {[0, 45, 90, 135, 180].map((a) => {
          const rad = ((a - 90) * Math.PI) / 180
          return (
            <line
              key={a}
              x1={size / 2}
              y1={size / 2}
              x2={size / 2 + r * Math.cos(rad)}
              y2={size / 2 + r * Math.sin(rad)}
              stroke="currentColor"
              strokeWidth={0.5}
              opacity={0.25}
            />
          )
        })}
        {windSpeeds.map((w, wi) => (
          <polyline
            key={w}
            points={angles.map((a, ai) => pt(a, speeds[wi][ai]).join(",")).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeDasharray={dashes[wi % dashes.length]}
          />
        ))}
        {rows.map((row, wi) => (
          <g key={row.wind}>
            <circle cx={pt(row.upAngle, speeds[wi][angles.indexOf(row.upAngle)])[0]} cy={pt(row.upAngle, speeds[wi][angles.indexOf(row.upAngle)])[1]} r={2.6} fill="currentColor" />
            <circle
              cx={pt(row.downAngle, speeds[wi][angles.indexOf(row.downAngle)])[0]}
              cy={pt(row.downAngle, speeds[wi][angles.indexOf(row.downAngle)])[1]}
              r={2.6}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
            />
          </g>
        ))}
      </svg>
      <ul className="mt-2 space-y-1 text-[10px] tabular-nums">
        {rows.map((row, wi) => (
          <li key={row.wind} className="flex items-center gap-2">
            <svg width="22" height="6" className="shrink-0" aria-hidden>
              <line x1={0} y1={3} x2={22} y2={3} stroke="currentColor" strokeWidth={1.4} strokeDasharray={dashes[wi % dashes.length]} />
            </svg>
            <span className="w-14 shrink-0">{row.wind} kn</span>
            <span className="text-muted-foreground">
              upwind {row.upAngle}° · downwind {row.downAngle}° · fastest through the water at {row.fastestAngle}° and{" "}
              {row.top.toFixed(1)} kn
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Filled marks are best UPWIND VMG and hollow ones best downwind, both DERIVED by projecting boat speed onto the
        wind axis — the polar shows where the boat is fastest and VMG shows where it arrives soonest, and they are
        never the same angle · at {rows[0].wind} kn the fastest point of sail is {rows[0].fastestAngle}° and the right
        one to steer upwind is {rows[0].upAngle}° · the optimum angles move with wind speed, which is the whole reason
        a target-speed sticker exists
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * TideGate — a passage that can only be taken while there is enough
 * water and the stream is fair. The WINDOW is the intersection, and
 * a tide table shows neither constraint.
 * ------------------------------------------------------------------ */
export function TideGate({
  hours,
  heights,
  streamKn,
  draughtM,
  chartDatumM,
  clearanceM = 0.5,
  className = "",
}: {
  /** hour labels across the tide */
  hours: string[]
  /** height of tide above chart datum at each hour */
  heights: number[]
  /** stream rate, positive with the passage */
  streamKn: number[]
  draughtM: number
  /** charted depth at the shallowest point */
  chartDatumM: number
  clearanceM?: number
  className?: string
}) {
  const rows = hours.map((h, i) => {
    const depth = chartDatumM + heights[i]
    const water = depth >= draughtM + clearanceM
    const fair = streamKn[i] > 0
    return { hour: h, height: heights[i], depth, stream: streamKn[i], water, fair, open: water && fair }
  })
  const open = rows.filter((r) => r.open)
  const firstOpen = rows.findIndex((r) => r.open)
  const lastOpen = rows.map((r) => r.open).lastIndexOf(true)
  const maxH = Math.max(...heights)
  const maxS = Math.max(...streamKn.map(Math.abs))

  return (
    <div className={className}>
      <div className="relative flex items-stretch gap-px rounded-[2px] border border-foreground/15" style={{ height: 110 }}>
        {rows.map((r) => (
          <div key={r.hour} className="relative min-w-0 flex-1" title={`${r.hour}: ${r.height.toFixed(1)} m of tide, ${r.depth.toFixed(1)} m under the keel line`}>
            <div className="absolute inset-x-0 bottom-0" style={{ height: `${(r.height / Math.max(maxH, 1e-9)) * 100}%`, background: "color-mix(in oklch, currentColor 24%, transparent)" }} />
          </div>
        ))}
        <span
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/70"
          style={{ bottom: `${clamp(((draughtM + clearanceM - chartDatumM) / Math.max(maxH, 1e-9)) * 100, 0, 100)}%` }}
        />
        {firstOpen >= 0 && (
          <span
            className="pointer-events-none absolute inset-y-0 bg-foreground/12"
            style={{ left: `${(firstOpen / rows.length) * 100}%`, width: `${((lastOpen - firstOpen + 1) / rows.length) * 100}%` }}
          />
        )}
      </div>
      {/* the two constraints, drawn separately so it is clear which closes the gate */}
      <div className="mt-1 space-y-1">
        {(["water", "fair"] as const).map((k) => (
          <div key={k} className="flex items-center gap-1">
            <span className="w-16 shrink-0 text-[9px] text-muted-foreground">{k === "water" ? "depth" : "stream"}</span>
            <div className="flex flex-1 gap-px">
              {rows.map((r) => (
                <span
                  key={r.hour}
                  className="h-2.5 min-w-0 flex-1 rounded-[1px]"
                  style={{
                    background: r[k]
                      ? "currentColor"
                      : k === "fair"
                        ? "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 4px)"
                        : "color-mix(in oklch, currentColor 12%, transparent)",
                  }}
                  title={`${r.hour}: ${k === "water" ? `${r.depth.toFixed(1)} m` : `${r.stream.toFixed(1)} kn`}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{hours[0]}</span>
        <span>dashed: {(draughtM + clearanceM).toFixed(1)} m needed</span>
        <span>{hours[hours.length - 1]}</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The gate is open only where BOTH strips are filled — a tide table gives the height and a stream atlas gives the
        rate, and neither shows the intersection ·{" "}
        {open.length === 0
          ? `there is no window in this tide: ${rows.filter((r) => !r.water).length} hours have too little water and ${rows.filter((r) => !r.fair).length} have a foul stream`
          : `${open.length} hour${open.length === 1 ? "" : "s"} from ${rows[firstOpen].hour} to ${rows[lastOpen].hour}, and it closes on ${rows[lastOpen + 1]?.water === false ? "depth" : "the turn of the stream"}`}{" "}
        · maximum stream {maxS.toFixed(1)} kn, which is {(maxS / 5).toFixed(1)} knots of a five-knot boat
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * HandicapCorrection — elapsed against corrected time. A handicap
 * race is won on a number nobody can compute in their head, so the
 * placings are derived and the elapsed order is shown for contrast.
 * ------------------------------------------------------------------ */
export function HandicapCorrection({
  boats,
  courseNm,
  className = "",
}: {
  /** elapsed time in minutes and the boat's time-correction factor */
  boats: { name: string; elapsedMin: number; tcf: number }[]
  courseNm: number
  className?: string
}) {
  const rows = boats
    .map((b) => ({ ...b, corrected: b.elapsedMin * b.tcf, speed: courseNm / (b.elapsedMin / 60) }))
    .sort((a, b) => a.corrected - b.corrected)
  const byElapsed = [...rows].sort((a, b) => a.elapsedMin - b.elapsedMin)
  const withPlaces = rows.map((r, i) => ({
    ...r,
    place: i + 1,
    elapsedPlace: byElapsed.findIndex((x) => x.name === r.name) + 1,
  }))
  const moved = withPlaces.filter((r) => r.place !== r.elapsedPlace)
  const winner = withPlaces[0]
  const lineHonours = byElapsed[0]
  const minC = Math.min(...rows.map((r) => r.corrected))
  const maxC = Math.max(...rows.map((r) => r.corrected))
  const maxE = Math.max(...rows.map((r) => r.elapsedMin))
  const hm = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`
  // 1st, 2nd, 3rd — a hard-coded "th" prints 3th, which is the first thing
  // anybody reading a results sheet notices
  const ord = (n: number) => {
    const t = n % 100
    if (t >= 11 && t <= 13) return `${n}th`
    return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`
  }

  return (
    <div className={className}>
      <ul className="space-y-2">
        {withPlaces.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">
                <span className="tabular-nums text-muted-foreground">{r.place}. </span>
                {r.name}
              </span>
              <span className="tabular-nums text-muted-foreground">
                TCF {r.tcf.toFixed(3)} · {r.speed.toFixed(2)} kn
                {r.place !== r.elapsedPlace ? ` · ${ord(r.elapsedPlace)} on the water` : ""}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/22" style={{ width: `${(r.elapsedMin / maxE) * 100}%` }} title={`elapsed ${hm(r.elapsedMin)}`} />
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground" style={{ width: `${(r.corrected / maxE) * 100}%` }} title={`corrected ${hm(r.corrected)}`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {hm(r.elapsedMin)} elapsed → {hm(r.corrected)} corrected
              {r.place > 1 ? ` · ${(r.corrected - minC).toFixed(1)} min behind` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is elapsed and solid is CORRECTED, which is the one that counts · {winner.name} wins on{" "}
        {hm(winner.corrected)} and {lineHonours.name} took line honours,{" "}
        {winner.name === lineHonours.name ? "which is the same boat and unusual" : "which is a different boat"} ·{" "}
        {moved.length} of {rows.length} boats finish in a different place than they crossed the line, and the whole
        fleet is separated by {(maxC - minC).toFixed(1)} corrected minutes over {courseNm} miles — which is why the
        protest room is busier than the bar
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * LaylineChart — the cost of tacking early or late. Overstanding is
 * invisible on the water and expensive, and the extra distance is
 * pure trigonometry that nobody does while steering.
 * ------------------------------------------------------------------ */
export function LaylineChart({
  distanceNm,
  tackAngle,
  offsets,
  boatSpeedKn,
  size = 200,
  className = "",
}: {
  /** rhumb line distance to the mark */
  distanceNm: number
  /** the angle between tacks, so half of it either side of the wind */
  tackAngle: number
  /** how far past the layline each option tacks, in degrees of bearing */
  offsets: { name: string; overstandDeg: number }[]
  boatSpeedKn: number
  size?: number
  className?: string
}) {
  const half = (tackAngle / 2) * (Math.PI / 180)
  const ideal = distanceNm / Math.cos(half)
  const rows = offsets
    .map((o) => {
      // overstanding adds a leg sailed away from the mark and a longer return
      const over = (o.overstandDeg * Math.PI) / 180
      const sailed = distanceNm * (Math.cos(over) / Math.cos(half) + Math.sin(Math.abs(over)) * Math.tan(half) * 1.6)
      const extra = sailed - ideal
      return { ...o, sailed, extra, minutes: (extra / Math.max(boatSpeedKn, 1e-9)) * 60 }
    })
    .sort((a, b) => a.extra - b.extra)
  const maxS = Math.max(...rows.map((r) => r.sailed))
  const worst = rows[rows.length - 1]
  const bestRow = rows[0]

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block" style={{ width: size, height: size }}>
        {/* the mark at the top, the laylines from it, and the rhumb line */}
        <line x1={size / 2} y1={size - 8} x2={size / 2} y2={12} stroke="currentColor" strokeWidth={0.7} strokeDasharray="3 3" opacity={0.5} />
        {[-1, 1].map((s) => (
          <line
            key={s}
            x1={size / 2}
            y1={12}
            x2={size / 2 + s * (size - 24) * Math.tan(half)}
            y2={size - 8}
            stroke="currentColor"
            strokeWidth={1}
            opacity={0.55}
          />
        ))}
        <circle cx={size / 2} cy={12} r={3.5} fill="currentColor" />
        <circle cx={size / 2} cy={size - 8} r={3} fill="none" stroke="currentColor" strokeWidth={1.2} />
      </svg>
      <div className="mt-1 text-center text-[10px] text-muted-foreground tabular-nums">
        {tackAngle}° tacking angle · {distanceNm} nm to the mark
      </div>
      <ul className="mt-2 space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.overstandDeg === 0 ? "on the layline" : `${r.overstandDeg}° past it`}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/22" style={{ width: `${(ideal / maxS) * 100}%` }} title={`ideal ${ideal.toFixed(2)} nm`} />
              <div
                className="absolute inset-y-0 rounded-r-[2px]"
                style={{
                  left: `${(ideal / maxS) * 100}%`,
                  width: `${(r.extra / maxS) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: r.extra > 0 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`extra ${r.extra.toFixed(2)} nm`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.sailed.toFixed(2)} nm sailed · {r.extra >= 0.005 ? `+${r.extra.toFixed(2)} nm, ${r.minutes.toFixed(1)} min` : "no extra distance"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched is the distance OVERSTANDING adds, which is trigonometry nobody does while steering and is invisible
        from the helm — the mark simply arrives later · {bestRow.name.toLowerCase()} sails{" "}
        {bestRow.sailed.toFixed(2)} nm against {worst.name.toLowerCase()} at {worst.sailed.toFixed(2)},{" "}
        {worst.minutes.toFixed(1)} minutes at {boatSpeedKn} knots · a fleet is usually separated by less than that,
        which is why the boat that tacks last on the layline wins the beat
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SailCrossover — which sail is fastest in which wind, with the
 * CROSSOVER points derived. A sail chart is drawn as neat bands; the
 * bands come from where two speed curves cross, and they overlap.
 * ------------------------------------------------------------------ */
export function SailCrossover({
  winds,
  sails,
  className = "",
}: {
  winds: number[]
  /** each sail's boat speed at each wind speed; null where it cannot be carried */
  sails: { name: string; speeds: (number | null)[] }[]
  className?: string
}) {
  const best = winds.map((_, wi) => {
    const candidates = sails
      .map((s, si) => ({ si, v: s.speeds[wi] }))
      .filter((c): c is { si: number; v: number } => c.v !== null)
    if (!candidates.length) return null
    return candidates.reduce((a, c) => (c.v > a.v ? c : a)).si
  })
  const crossovers: { at: number; from: string; to: string; margin: number }[] = []
  best.forEach((b, i) => {
    if (i === 0 || b === null || best[i - 1] === null || b === best[i - 1]) return
    const prev = best[i - 1] as number
    const cur = b as number
    crossovers.push({
      at: winds[i],
      from: sails[prev].name,
      to: sails[cur].name,
      margin: Math.abs((sails[cur].speeds[i] as number) - (sails[prev].speeds[i] as number)),
    })
  })
  const maxV = Math.max(...sails.flatMap((s) => s.speeds.filter((v): v is number => v !== null)))
  const tight = crossovers.filter((c) => c.margin < 0.15)

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background pr-2 text-left font-normal text-muted-foreground">sail</th>
              {winds.map((w) => (
                <th key={w} className="px-1 pb-1 font-normal text-muted-foreground">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sails.map((s, si) => (
              <tr key={s.name}>
                <td className="sticky left-0 bg-background pr-2 whitespace-nowrap">{s.name}</td>
                {winds.map((w, wi) => {
                  const v = s.speeds[wi]
                  const isBest = best[wi] === si
                  return (
                    <td key={w} className="p-px">
                      <div
                        className="flex h-6 items-center justify-center rounded-[2px]"
                        style={{
                          background:
                            v === null
                              ? "transparent"
                              : `color-mix(in oklch, currentColor ${clamp((v / maxV) * 66, 3, 66).toFixed(0)}%, transparent)`,
                          outline: isBest ? "1.5px solid currentColor" : undefined,
                          outlineOffset: -1.5,
                        }}
                        title={v === null ? `${s.name} cannot be carried in ${w} kn` : `${s.name} at ${w} kn: ${v.toFixed(2)} kn${isBest ? " — fastest" : ""}`}
                      >
                        {v === null ? "·" : v.toFixed(1)}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-1 text-center text-[10px] text-muted-foreground">true wind speed, knots</div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The outlined cell in each column is the fastest sail at that wind, so the CROSSOVERS are derived rather than
        drawn as tidy bands ·{" "}
        {crossovers.length === 0
          ? "one sail is fastest across this whole range"
          : crossovers.map((c) => `${c.from} → ${c.to} at ${c.at} kn`).join(", ")}{" "}
        ·{" "}
        {tight.length > 0
          ? `${tight.length} of those crossings ${tight.length === 1 ? "is" : "are"} worth less than 0.15 kn, which is inside the noise of a hand-steered boat — the change is not worth the foredeck`
          : "every crossing is worth more than 0.15 kn, so each change earns its trip forward"}{" "}
        · a blank cell is a sail that cannot be carried at all, which is a different thing from a slow one
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PassagePlan — legs with the tidal stream added, so the ETA is
 * DERIVED from ground speed rather than from boat speed. A passage
 * planned on log speed arrives at the wrong time in both directions.
 * ------------------------------------------------------------------ */
export function PassagePlan({
  legs,
  boatSpeedKn,
  startHour,
  className = "",
}: {
  /** each leg's distance and the stream along it, positive with the boat */
  legs: { name: string; distanceNm: number; streamKn: number }[]
  boatSpeedKn: number
  /** departure, in hours past midnight */
  startHour: number
  className?: string
}) {
  let t = startHour
  const rows = legs.map((l) => {
    const ground = boatSpeedKn + l.streamKn
    const hours = l.distanceNm / Math.max(ground, 0.1)
    const naive = l.distanceNm / Math.max(boatSpeedKn, 0.1)
    const start = t
    t += hours
    return { ...l, ground, hours, naive, start, end: t, delta: hours - naive, foul: l.streamKn < 0 }
  })
  const total = t - startHour
  const naiveTotal = rows.reduce((a, r) => a + r.naive, 0)
  const distance = rows.reduce((a, r) => a + r.distanceNm, 0)
  const clock = (h: number) => `${String(Math.floor(h) % 24).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`
  const maxH = Math.max(...rows.map((r) => Math.max(r.hours, r.naive)))
  const worst = rows.reduce((a, r) => (r.delta > a.delta ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.distanceNm} nm · {r.streamKn >= 0 ? "+" : ""}
                {r.streamKn.toFixed(1)} kn stream · {r.ground.toFixed(1)} kn over the ground
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/25" style={{ width: `${(r.naive / maxH) * 100}%` }} title={`on log speed ${(r.naive * 60).toFixed(0)} min`} />
              <div
                className="absolute inset-y-0 rounded-[2px]"
                style={{
                  width: `${(r.hours / maxH) * 100}%`,
                  background: r.foul ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "currentColor",
                  outline: r.foul ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`actual ${(r.hours * 60).toFixed(0)} min`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {clock(r.start)} → {clock(r.end)} · {(r.hours * 60).toFixed(0)} min,{" "}
              {r.delta >= 0 ? "+" : ""}
              {(r.delta * 60).toFixed(0)} against log speed
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The ETA is DERIVED from speed over the GROUND, leg by leg — a passage planned on log speed is wrong on every
        leg and the errors do not cancel, because a foul stream costs more time than a fair one saves ·{" "}
        {distance} nm at {boatSpeedKn} kn is {(naiveTotal * 60 / 60).toFixed(1)} hours on paper and{" "}
        {total.toFixed(1)} in the water, arriving {clock(startHour + total)} rather than{" "}
        {clock(startHour + naiveTotal)} · {worst.name.toLowerCase()} is the worst leg at{" "}
        {(worst.delta * 60).toFixed(0)} minutes over
      </p>
    </div>
  )
}
