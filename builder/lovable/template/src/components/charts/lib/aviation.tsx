/**
 * Airline-operations primitives — load factor against yield, delay propagation
 * through an aircraft's day, tankering economics, weight and balance, crew duty
 * and the turnaround critical path.
 *
 * RASK, the propagated delay, the tankering break-even, the centre of gravity
 * against the envelope, the duty limit after every extension and the turnaround
 * critical path are all DERIVED. A turnaround chart that takes its own critical
 * path as a prop is a picture of somebody's opinion.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) => "$" + Math.round(Math.abs(v)).toLocaleString("en-US")

/* ------------------------------------------------------------------ *
 * LoadFactor — seats sold against the fare achieved, with RASK derived
 * so a full aeroplane losing money is visible.
 * ------------------------------------------------------------------ */
export function LoadFactor({
  routes,
  caskCents,
  height = 200,
  className = "",
}: {
  routes: { name: string; seats: number; sold: number; averageFare: number; stageKm: number }[]
  /** cost per available seat kilometre, in cents */
  caskCents: number
  height?: number
  className?: string
}) {
  const rows = routes.map((r) => {
    const lf = r.sold / Math.max(r.seats, 1)
    const rask = (r.sold * r.averageFare * 100) / Math.max(r.seats * r.stageKm, 1e-9)
    const breakEvenLf = (caskCents * r.stageKm) / Math.max(r.averageFare * 100, 1e-9)
    return { ...r, lf, rask, breakEvenLf, margin: rask - caskCents }
  })
  const losing = rows.filter((r) => r.margin < 0)
  const maxLf = Math.max(1, ...rows.map((r) => Math.max(r.lf, r.breakEvenLf)))

  return (
    <div className={className}>
      <ul className="space-y-2" style={{ minHeight: height }}>
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.sold}/{r.seats} · {money(r.averageFare)} avg
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px]"
                style={{
                  width: `${(r.lf / maxLf) * 100}%`,
                  background: r.margin < 0 ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 52%, transparent)",
                  outline: r.margin < 0 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
              />
              <span
                className="absolute inset-y-0 w-0.5 bg-foreground"
                style={{ left: `${(clamp(r.breakEvenLf, 0, maxLf) / maxLf) * 100}%` }}
                title={`break-even load factor ${(r.breakEvenLf * 100).toFixed(0)}%`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.lf * 100).toFixed(0)}% load, break-even {(r.breakEvenLf * 100).toFixed(0)}% · RASK{" "}
              {r.rask.toFixed(2)}¢ against CASK {caskCents.toFixed(2)}¢
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The tick on each bar is that route's OWN break-even load factor, which moves with stage length and fare — a
        single network figure hides exactly this ·{" "}
        {losing.length
          ? `${losing.map((r) => r.name).join(", ")} ${losing.length === 1 ? "loses" : "lose"} money at today's load`
          : "every route clears its cost"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * OtpCascade — one aircraft's day, with delay PROPAGATED down the
 * rotation rather than reported per leg. The recovery is the point.
 * ------------------------------------------------------------------ */
export function OtpCascade({
  legs,
  className = "",
}: {
  /** scheduled block and the minimum ground time the station needs */
  legs: { flight: string; departMin: number; blockMin: number; groundMin: number; ownDelayMin?: number }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!legs.length) return null

  let inherited = 0
  const rows = legs.map((l, i) => {
    const own = l.ownDelayMin ?? 0
    const actualDepart = l.departMin + inherited + own
    const actualArrive = actualDepart + l.blockMin
    const nextScheduled = legs[i + 1]?.departMin ?? actualArrive
    // ground time can absorb delay only down to the station minimum
    const availableGround = nextScheduled - actualArrive
    const carried = Math.max(0, l.groundMin - availableGround)
    const before = inherited
    inherited = carried
    return { ...l, own, inherited: before, actualDepart, actualArrive, carried, total: before + own }
  })
  const span = Math.max(...rows.map((r) => r.actualArrive), ...legs.map((l) => l.departMin + l.blockMin))
  const px = (m: number) => (m / Math.max(span, 1)) * 100
  const worst = rows.reduce((a, r) => (r.total > a.total ? r : a), rows[0])
  const absorbed = rows.reduce((a, r) => a + Math.max(0, r.inherited + r.own - r.carried), 0)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.flight}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span>{r.flight}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.total > 0 ? `${r.total} min late` : "on time"}
                {r.own > 0 ? ` (${r.own} its own)` : ""}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px] border border-dashed border-foreground/45"
                style={{ left: `${px(r.departMin)}%`, width: `${px(r.blockMin)}%` }}
                title={`scheduled ${r.departMin}–${r.departMin + r.blockMin}`}
              />
              <div
                className="absolute inset-y-0.5 rounded-[1px] bg-foreground/60"
                style={{ left: `${px(r.actualDepart)}%`, width: `${px(r.blockMin)}%` }}
                title={`actual ${r.actualDepart.toFixed(0)}–${r.actualArrive.toFixed(0)}`}
              />
              {r.inherited > 0 && (
                <div
                  className="absolute inset-y-1 border border-foreground/60"
                  style={{
                    left: `${px(r.departMin)}%`,
                    width: `${px(r.inherited)}%`,
                    background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  }}
                  title={`${r.inherited} min inherited`}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Dashed is schedule, solid is actual, hatched is delay inherited from the leg before · the worst arrival is{" "}
        {worst.flight} at {worst.total} min, of which only {worst.own} started there · {absorbed} min was absorbed by
        ground time, which is the only place a rotation ever recovers
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * FuelTankering — carrying cheap fuel costs fuel to carry. The
 * break-even price ratio is SOLVED from the burn penalty.
 * ------------------------------------------------------------------ */
export function FuelTankering({
  sectors,
  height = 190,
  className = "",
}: {
  sectors: {
    name: string
    /** price per tonne at each end */
    originPrice: number
    destinationPrice: number
    /** extra fuel burned per extra tonne carried, over this sector */
    burnPenalty: number
    /** how much could be tankered, in tonnes */
    capacityT: number
  }[]
  height?: number
  className?: string
}) {
  const rows = sectors.map((s) => {
    // carrying 1 t saves destinationPrice but costs originPrice × (1 + penalty)
    const saving = s.destinationPrice - s.originPrice * (1 + s.burnPenalty)
    const breakEvenRatio = 1 + s.burnPenalty
    const actualRatio = s.destinationPrice / Math.max(s.originPrice, 1e-9)
    return { ...s, saving, breakEvenRatio, actualRatio, total: saving * s.capacityT }
  })
  const worth = rows.filter((r) => r.saving > 0)
  const maxRatio = Math.max(...rows.map((r) => Math.max(r.actualRatio, r.breakEvenRatio))) * 1.05
  const totalSaving = worth.reduce((a, r) => a + r.total, 0)

  return (
    <div className={className}>
      <ul className="space-y-2" style={{ minHeight: height }}>
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {money(r.originPrice)} → {money(r.destinationPrice)}/t
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px]"
                style={{
                  width: `${(r.actualRatio / maxRatio) * 100}%`,
                  background: r.saving > 0 ? "color-mix(in oklch, currentColor 52%, transparent)" : "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                }}
              />
              <span
                className="absolute inset-y-0 w-0.5 bg-foreground"
                style={{ left: `${(r.breakEvenRatio / maxRatio) * 100}%` }}
                title={`break-even price ratio ${r.breakEvenRatio.toFixed(3)}`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              <span aria-hidden>{r.saving > 0 ? "✓" : "✗"}</span> ratio {r.actualRatio.toFixed(2)} against break-even{" "}
              {r.breakEvenRatio.toFixed(2)} ·{" "}
              {r.saving > 0 ? `${money(r.total)} on ${r.capacityT} t` : `${money(-r.saving)}/t lost if tankered`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The tick is the price ratio at which carrying fuel pays for itself, and it is set by the burn penalty on THIS
        sector — a longer leg needs a bigger price gap ·{" "}
        {worth.length ? `${money(totalSaving)} across ${worth.length} worth tankering` : "no sector is worth tankering"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * WeightBalance — the loaded centre of gravity against the certified
 * envelope. The CG is COMPUTED from the moments.
 * ------------------------------------------------------------------ */
export function WeightBalance({
  items,
  envelope,
  height = 230,
  className = "",
}: {
  /** each mass and its arm from the datum */
  items: { name: string; kg: number; armM: number }[]
  /** the certified envelope as a closed polygon of (cg, weight) */
  envelope: { cgM: number; kg: number }[]
  height?: number
  className?: string
}) {
  const totalKg = items.reduce((a, i) => a + i.kg, 0)
  const totalMoment = items.reduce((a, i) => a + i.kg * i.armM, 0)
  const cg = totalMoment / Math.max(totalKg, 1e-9)

  const xs = [...envelope.map((e) => e.cgM), cg]
  const ys = [...envelope.map((e) => e.kg), totalKg]
  const xLo = Math.min(...xs) - 0.1
  const xHi = Math.max(...xs) + 0.1
  const yLo = Math.min(...ys) * 0.96
  const yHi = Math.max(...ys) * 1.04
  const px = (v: number) => ((v - xLo) / (xHi - xLo)) * 100
  const py = (v: number) => 100 - ((v - yLo) / (yHi - yLo)) * 100

  // point-in-polygon, so the verdict is computed rather than asserted
  const inside = (() => {
    let hit = false
    for (let i = 0, j = envelope.length - 1; i < envelope.length; j = i++) {
      const a = envelope[i]
      const b = envelope[j]
      if (a.kg > totalKg !== b.kg > totalKg && cg < ((b.cgM - a.cgM) * (totalKg - a.kg)) / (b.kg - a.kg) + a.cgM) hit = !hit
    }
    return hit
  })()

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon
            points={envelope.map((e) => `${px(e.cgM)},${py(e.kg)}`).join(" ")}
            fill="currentColor"
            fillOpacity={0.1}
            stroke="currentColor"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45"
          style={{
            left: `${clamp(px(cg), 1, 99)}%`,
            top: `${clamp(py(totalKg), 1, 99)}%`,
            background: inside ? "currentColor" : "var(--background)",
            boxShadow: inside ? undefined : "inset 0 0 0 1.5px currentColor",
          }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{xLo.toFixed(2)} m from datum</span>
        <span>{xHi.toFixed(2)} m</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {items.map((i) => (
          <li key={i.name} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate">{i.name}</span>
            <span className="text-muted-foreground">
              {i.kg.toLocaleString()} kg at {i.armM.toFixed(2)} m = {(i.kg * i.armM).toLocaleString()} kg·m
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Weight</dt>
          <dd className="font-medium tabular-nums">{Math.round(totalKg).toLocaleString()} kg</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">CG</dt>
          <dd className="font-medium tabular-nums">{cg.toFixed(3)} m</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Envelope</dt>
          <dd className="font-medium tabular-nums">{inside ? "inside" : "OUTSIDE"}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        The CG is the moment sum over the weight sum, computed here rather than taken on trust ·{" "}
        {inside ? "the loaded point falls inside the certified envelope" : "the loaded point is OUTSIDE the envelope — this load must be moved, not accepted"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CrewDuty — a duty period against the limit that applies to it, with
 * the limit itself derived from sectors and report time.
 * ------------------------------------------------------------------ */
export function CrewDuty({
  duties,
  className = "",
}: {
  duties: {
    name: string
    reportHour: number
    sectors: number
    dutyHours: number
    /** in-flight rest facility, which extends the limit */
    augmented?: boolean
    commanderDiscretionHours?: number
  }[]
  className?: string
}) {
  // a simplified table: the basic limit falls with sectors and with an early or
  // late report, which is the whole reason a single number never works
  const limitFor = (d: (typeof duties)[number]) => {
    const base = 13 - Math.max(0, d.sectors - 2) * 0.5
    const early = d.reportHour < 6 ? 1.5 : d.reportHour < 7 ? 1 : 0
    const late = d.reportHour >= 22 ? 1.5 : 0
    return clamp(base - early - late, 9, 13) + (d.augmented ? 3 : 0)
  }
  const rows = duties.map((d) => {
    const limit = limitFor(d)
    const extended = limit + (d.commanderDiscretionHours ?? 0)
    return { ...d, limit, extended, over: d.dutyHours - limit, overExtended: d.dutyHours - extended }
  })
  const axis = Math.max(...rows.map((r) => Math.max(r.dutyHours, r.extended))) * 1.06
  const breaches = rows.filter((r) => r.overExtended > 0)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                report {String(Math.floor(r.reportHour)).padStart(2, "0")}:
                {String(Math.round((r.reportHour % 1) * 60)).padStart(2, "0")} · {r.sectors} sectors
                {r.augmented ? " · augmented" : ""}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px]"
                style={{
                  width: `${(Math.min(r.dutyHours, r.limit) / axis) * 100}%`,
                  background: "color-mix(in oklch, currentColor 48%, transparent)",
                }}
              />
              {r.over > 0 && (
                <div
                  className="absolute inset-y-0 border-y border-r border-foreground"
                  style={{
                    left: `${(r.limit / axis) * 100}%`,
                    width: `${(Math.min(r.over, Math.max(0, r.extended - r.limit)) / axis) * 100}%`,
                    background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  }}
                />
              )}
              {r.overExtended > 0 && (
                <div className="absolute inset-y-0 bg-foreground" style={{ left: `${(r.extended / axis) * 100}%`, width: `${(r.overExtended / axis) * 100}%` }} />
              )}
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(r.limit / axis) * 100}%` }} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              <span aria-hidden>{r.overExtended > 0 ? "✗" : r.over > 0 ? "△" : "✓"}</span> {r.dutyHours.toFixed(1)} h
              against a {r.limit.toFixed(1)} h limit
              {(r.commanderDiscretionHours ?? 0) > 0 ? ` (+${r.commanderDiscretionHours} discretion)` : ""}
              {r.overExtended > 0 ? " — BREACH" : r.over > 0 ? " — into discretion" : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">
        The limit is derived per duty, from sector count and report time — an early start costs an hour and a half
        before anybody has flown anywhere ·{" "}
        {breaches.length ? `${breaches.length} duty exceeds even the extended limit` : "no duty exceeds its extended limit"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * TurnaroundGantt — the ground tasks, with the CRITICAL PATH solved by
 * longest path through the dependencies.
 * ------------------------------------------------------------------ */
export function TurnaroundGantt({
  tasks,
  scheduledMinutes,
  className = "",
}: {
  tasks: { name: string; minutes: number; after?: string[] }[]
  scheduledMinutes: number
  className?: string
}) {
  const byName = new Map(tasks.map((t) => [t.name, t]))
  const memo = new Map<string, number>()
  const earliestStart = (name: string, seen: Set<string> = new Set()): number => {
    if (memo.has(name)) return memo.get(name) as number
    if (seen.has(name)) return 0
    seen.add(name)
    const deps = byName.get(name)?.after ?? []
    const s = deps.length === 0 ? 0 : Math.max(...deps.map((d) => earliestStart(d, new Set(seen)) + (byName.get(d)?.minutes ?? 0)))
    memo.set(name, s)
    return s
  }
  const laid = tasks.map((t) => {
    const start = earliestStart(t.name)
    return { ...t, start, end: start + t.minutes }
  })
  const finish = Math.max(...laid.map((l) => l.end))

  // walk back from the finishing task through the dependency that determines it
  const critical = new Set<string>()
  let cursor = laid.reduce((a, l) => (l.end > a.end ? l : a), laid[0])
  while (cursor) {
    critical.add(cursor.name)
    const deps = (cursor.after ?? []).map((d) => laid.find((l) => l.name === d)).filter(Boolean) as typeof laid
    if (!deps.length) break
    const next = deps.reduce((a, d) => (d.end > a.end ? d : a), deps[0])
    if (next.end !== cursor.start) break
    cursor = next
  }

  const axis = Math.max(finish, scheduledMinutes) * 1.03
  const ordered = [...laid].sort((a, b) => a.start - b.start || b.minutes - a.minutes)

  return (
    <div className={className}>
      <ul className="space-y-1">
        {ordered.map((t) => (
          <li key={t.name} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-[10px]">{t.name}</span>
            <div className="relative h-4 flex-1 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px]"
                style={{
                  left: `${(t.start / axis) * 100}%`,
                  width: `${Math.max(0.8, (t.minutes / axis) * 100)}%`,
                  background: critical.has(t.name) ? "currentColor" : "color-mix(in oklch, currentColor 30%, transparent)",
                }}
                title={`${t.name}: ${t.start}–${t.end} min`}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(scheduledMinutes / axis) * 100}%` }} />
            </div>
            <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{t.minutes}′</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Solid bars are the critical path, solved from the dependencies — {[...critical].reverse().join(" → ")} · the
        turnaround finishes at {finish} min against {scheduledMinutes} scheduled
        {finish > scheduledMinutes
          ? `, so it is ${finish - scheduledMinutes} min long before anything goes wrong`
          : `, with ${scheduledMinutes - finish} min of slack`}
      </p>
    </div>
  )
}
