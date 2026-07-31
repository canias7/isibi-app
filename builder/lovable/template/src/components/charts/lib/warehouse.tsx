/**
 * Warehouse primitives — slotting, pick paths, count accuracy, receiving,
 * putaway congestion and pallet cube.
 *
 * The travel a slotting plan costs, the distance a pick sequence walks, the
 * accuracy that survives an offsetting pair of errors, the hours between a
 * lorry and a sellable pallet, where the aisles jam and the space a pallet
 * really wastes are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) =>
  "£" + (Math.abs(v) < 10 ? Math.abs(v).toFixed(2) : Math.round(Math.abs(v)).toLocaleString("en-GB"))

/* ------------------------------------------------------------------ *
 * SlottingAbc — pick frequency against how far a line is from the
 * dispatch door, with the TRAVEL derived. An ABC classification is a
 * label; travel per week is what it was supposed to buy.
 * ------------------------------------------------------------------ */
export function SlottingAbc({
  lines,
  walkSecondsPerMetre = 1.1,
  labourCostPerHour,
  className = "",
}: {
  lines: { sku: string; picksPerWeek: number; distanceM: number; abc?: "A" | "B" | "C" }[]
  walkSecondsPerMetre?: number
  labourCostPerHour?: number
  className?: string
}) {
  // classify by cumulative pick share rather than trusting the stored label —
  // an ABC field is set once and the demand moves every quarter
  const sorted = [...lines].sort((a, b) => b.picksPerWeek - a.picksPerWeek)
  const total = sorted.reduce((a, l) => a + l.picksPerWeek, 0)
  let run = 0
  const rows = sorted.map((l) => {
    run += l.picksPerWeek
    const share = run / Math.max(total, 1)
    const derived: "A" | "B" | "C" = share <= 0.8 ? "A" : share <= 0.95 ? "B" : "C"
    return { ...l, cumShare: share, derived, travelM: l.picksPerWeek * l.distanceM * 2, misfiled: l.abc !== undefined && l.abc !== derived }
  })
  const travelM = rows.reduce((a, r) => a + r.travelM, 0)
  const hours = (travelM * walkSecondsPerMetre) / 3600
  // the same picks against the best possible slotting: busiest lines nearest
  const distances = [...lines.map((l) => l.distanceM)].sort((a, b) => a - b)
  const idealM = rows.reduce((a, r, i) => a + r.picksPerWeek * distances[i] * 2, 0)
  const idealHours = (idealM * walkSecondsPerMetre) / 3600
  const maxD = Math.max(...rows.map((r) => r.distanceM))
  const maxP = Math.max(...rows.map((r) => r.picksPerWeek))
  const misfiled = rows.filter((r) => r.misfiled)

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height: 170 }}>
        {rows.map((r) => {
          const d = 5 + (r.travelM / Math.max(...rows.map((x) => x.travelM))) * 13
          return (
            <span
              key={r.sku}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground"
              style={{
                left: `${clamp((r.distanceM / maxD) * 94 + 3, 2, 98)}%`,
                top: `${clamp(100 - (r.picksPerWeek / maxP) * 92 - 4, 3, 97)}%`,
                width: d,
                height: d,
                background: r.derived === "A" ? "currentColor" : r.derived === "B" ? "color-mix(in oklch, currentColor 42%, transparent)" : "transparent",
              }}
              title={`${r.sku}: ${r.picksPerWeek} picks, ${r.distanceM} m, ${Math.round(r.travelM).toLocaleString()} m a week`}
            />
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>at the door</span>
        <span>filled A · half B · hollow C · size is travel</span>
        <span>{maxD} m</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Travel</dt>
          <dd className="font-medium tabular-nums">{Math.round(travelM / 1000)} km/wk</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Hours</dt>
          <dd className="font-medium tabular-nums">{hours.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Best possible</dt>
          <dd className="font-medium tabular-nums">{idealHours.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{labourCostPerHour ? "Recoverable" : "Saving"}</dt>
          <dd className="font-medium tabular-nums">
            {labourCostPerHour ? money((hours - idealHours) * labourCostPerHour * 52) : `${(hours - idealHours).toFixed(1)} h`}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The class is DERIVED from the cumulative pick share, not read from the record — an ABC field is set once and
        demand moves every quarter{misfiled.length ? `, and ${misfiled.length} line${misfiled.length === 1 ? " is" : "s are"} now filed wrongly` : ""} ·
        travel is counted as a ROUND TRIP per pick, which is the standard slotting index — it overstates the distance
        a batched route would really walk and ranks the lines correctly, which is what it is for · this slotting
        indexes at {Math.round(travelM / 1000)} km a week against {Math.round(idealM / 1000)} km if the busiest lines
        sat nearest, a difference of {(hours - idealHours).toFixed(1)} hours
        {labourCostPerHour ? ` and ${money((hours - idealHours) * labourCostPerHour * 52)} a year` : ""} · the
        top-right of this plot is where the money is
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PickPath — the route a pick list actually walks against the same
 * lines in location order. The saving is DERIVED, because a pick list
 * is ordered by whatever the system emitted.
 * ------------------------------------------------------------------ */
export function PickPath({
  aisles,
  picks,
  className = "",
}: {
  /** number of aisles in the run */
  aisles: number
  /** the pick list in the order it was issued: aisle and position along it */
  picks: { sku: string; aisle: number; positionM: number }[]
  className?: string
}) {
  const aisleGapM = 3
  const dist = (a: (typeof picks)[number], b: (typeof picks)[number]) =>
    Math.abs(a.aisle - b.aisle) * aisleGapM + Math.abs(a.positionM - b.positionM)
  const walk = (list: typeof picks) => list.reduce((a, p, i) => (i === 0 ? 0 : a + dist(list[i - 1], p)), 0)
  // serpentine: up one aisle, down the next, which is the standard alternative
  const serp = [...picks].sort(
    (a, b) => a.aisle - b.aisle || (a.aisle % 2 === 0 ? a.positionM - b.positionM : b.positionM - a.positionM),
  )
  const issued = walk(picks)
  const optimal = walk(serp)
  const maxPos = Math.max(...picks.map((p) => p.positionM))
  const pxAisle = (a: number) => ((a + 0.5) / aisles) * 100
  const pyPos = (p: number) => (p / Math.max(maxPos, 1e-9)) * 92 + 4

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height: 200 }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {Array.from({ length: aisles }, (_, i) => (
            <line key={i} x1={pxAisle(i)} y1={2} x2={pxAisle(i)} y2={98} stroke="currentColor" strokeWidth={0.4} opacity={0.2} />
          ))}
          <polyline
            points={serp.map((p) => `${pxAisle(p.aisle)},${pyPos(p.positionM)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeDasharray="4 2"
            opacity={0.5}
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={picks.map((p) => `${pxAisle(p.aisle)},${pyPos(p.positionM)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {picks.map((p, i) => (
          <span
            key={p.sku}
            className="absolute flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-foreground bg-background text-[7px] tabular-nums"
            style={{ left: `${pxAisle(p.aisle)}%`, top: `${pyPos(p.positionM)}%` }}
            title={`${i + 1}. ${p.sku} — aisle ${p.aisle + 1}, ${p.positionM} m`}
          >
            {i + 1}
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>aisle 1</span>
        <span>solid: as issued · dashed: serpentine</span>
        <span>aisle {aisles}</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">As issued</dt>
          <dd className="font-medium tabular-nums">{Math.round(issued)} m</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Serpentine</dt>
          <dd className="font-medium tabular-nums">{Math.round(optimal)} m</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Saving</dt>
          <dd className="font-medium tabular-nums">
            {(((issued - optimal) / Math.max(issued, 1e-9)) * 100).toFixed(0)}%
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Both distances are WALKED from the same lines: the solid path is the order the system issued and the dashed one
        is the same picks in serpentine order · {Math.round(issued)} m against {Math.round(optimal)} m,{" "}
        {(((issued - optimal) / Math.max(issued, 1e-9)) * 100).toFixed(0)}% shorter, on {picks.length} lines · a pick
        list is usually ordered by SKU or by the order it was keyed, which has nothing to do with the building
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CycleCountAccuracy — counts against the record, scored two ways.
 * Net accuracy nets an over against an under and reports a warehouse
 * with two errors as having none.
 * ------------------------------------------------------------------ */
export function CycleCountAccuracy({
  counts,
  target,
  className = "",
}: {
  /** each zone's counted lines, with over and under discrepancies */
  counts: { zone: string; linesCounted: number; over: number; under: number; unitsOver: number; unitsUnder: number }[]
  target?: number
  className?: string
}) {
  const rows = counts
    .map((c) => {
      const wrong = c.over + c.under
      return {
        ...c,
        net: 1 - Math.abs(c.unitsOver - c.unitsUnder) / Math.max(c.unitsOver + c.unitsUnder + c.linesCounted, 1),
        absolute: 1 - wrong / Math.max(c.linesCounted, 1),
        wrong,
      }
    })
    .sort((a, b) => a.absolute - b.absolute)
  const totalLines = rows.reduce((a, r) => a + r.linesCounted, 0)
  const totalWrong = rows.reduce((a, r) => a + r.wrong, 0)
  const overall = 1 - totalWrong / Math.max(totalLines, 1)
  const failing = target === undefined ? [] : rows.filter((r) => r.absolute < target)
  const offsetting = rows.filter((r) => r.net - r.absolute > 0.02)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.zone}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.zone}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.linesCounted} lines · {r.over} over, {r.under} under
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/22" style={{ width: `${r.net * 100}%` }} title={`net ${(r.net * 100).toFixed(1)}%`} />
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground" style={{ width: `${r.absolute * 100}%` }} title={`absolute ${(r.absolute * 100).toFixed(1)}%`} />
              {target !== undefined && <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${target * 100}%` }} title={`target ${(target * 100).toFixed(0)}%`} />}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.absolute * 100).toFixed(1)}% absolute · {(r.net * 100).toFixed(1)}% net
              {r.net - r.absolute > 0.02 ? " — the errors offset" : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Solid is ABSOLUTE accuracy — every wrong line counted — and pale is net, which cancels an over against an under
        · {(overall * 100).toFixed(1)}% of {totalLines.toLocaleString()} lines were right ·{" "}
        {offsetting.length === 0
          ? "no zone's errors materially offset each other"
          : `${offsetting.map((r) => r.zone).join(", ")} read better on net than on absolute, which means two mistakes cancelling: a picker who can find neither item, reported as a warehouse with no problem`}
        {target !== undefined ? ` · ${failing.length} zone${failing.length === 1 ? "" : "s"} below the ${(target * 100).toFixed(0)}% target` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DockToStock — the hours between a lorry arriving and the stock
 * being sellable, by stage. The stage that hurts is the one with the
 * biggest QUEUE, not the one that takes longest to perform.
 * ------------------------------------------------------------------ */
export function DockToStock({
  receipts,
  stages,
  targetHours,
  className = "",
}: {
  /** hours spent in each stage, per receipt */
  receipts: { reference: string; hours: number[] }[]
  /** the stage names, and how much of each is queue rather than work */
  stages: { name: string; queueShare: number }[]
  targetHours?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!receipts.length || !stages.length) return null

  const rows = receipts.map((r) => ({ ...r, total: r.hours.reduce((a, v) => a + v, 0) }))
  const max = Math.max(targetHours ?? 0, ...rows.map((r) => r.total))
  const byStage = stages.map((s, i) => {
    const hours = rows.reduce((a, r) => a + r.hours[i], 0) / Math.max(rows.length, 1)
    return { ...s, hours, queue: hours * s.queueShare, work: hours * (1 - s.queueShare) }
  })
  const worstQueue = byStage.reduce((a, s) => (s.queue > a.queue ? s : a), byStage[0])
  const longest = byStage.reduce((a, s) => (s.hours > a.hours ? s : a), byStage[0])
  const mean = rows.reduce((a, r) => a + r.total, 0) / Math.max(rows.length, 1)
  const late = targetHours === undefined ? [] : rows.filter((r) => r.total > targetHours)

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.reference} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span className="w-20 shrink-0 truncate">{r.reference}</span>
            <div className="relative h-4 flex-1 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 left-0 flex gap-px" style={{ width: `${(r.total / max) * 100}%` }}>
                {r.hours.map((h, i) => (
                  <div
                    key={i}
                    className="min-w-0 first:rounded-l-[2px] last:rounded-r-[2px]"
                    style={{
                      width: `${(h / Math.max(r.total, 1e-9)) * 100}%`,
                      background: `color-mix(in oklch, currentColor ${(88 - i * 15).toFixed(0)}%, transparent)`,
                    }}
                    title={`${stages[i].name}: ${h.toFixed(1)} h`}
                  />
                ))}
              </div>
              {targetHours !== undefined && (
                <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(targetHours / max) * 100}%` }} title={`target ${targetHours} h`} />
              )}
            </div>
            <span className="w-12 shrink-0 text-right text-muted-foreground">{r.total.toFixed(1)} h</span>
          </li>
        ))}
      </ul>
      {/* the derived half: each stage split into queue and work */}
      <ul className="mt-3 space-y-1">
        {byStage.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span
              className="inline-block h-2.5 w-4 shrink-0 rounded-[1px] border border-foreground/25"
              style={{ background: `color-mix(in oklch, currentColor ${(88 - i * 15).toFixed(0)}%, transparent)` }}
            />
            <span className="w-24 shrink-0 truncate">{s.name}</span>
            <div className="flex h-2.5 flex-1 rounded-[1px] bg-muted">
              <div
                className="rounded-l-[1px]"
                style={{
                  width: `${(s.queue / Math.max(...byStage.map((x) => x.hours))) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                }}
                title={`queue ${s.queue.toFixed(1)} h`}
              />
              <div
                className="rounded-r-[1px] bg-foreground/60"
                style={{ width: `${(s.work / Math.max(...byStage.map((x) => x.hours))) * 100}%` }}
                title={`work ${s.work.toFixed(1)} h`}
              />
            </div>
            <span className="w-28 shrink-0 text-right text-muted-foreground">
              {s.hours.toFixed(1)} h · {(s.queueShare * 100).toFixed(0)}% queue
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The lower bars split each stage into QUEUE (hatched) and work, which is what decides where to spend ·{" "}
        {longest.name === worstQueue.name
          ? `${longest.name.toLowerCase()} is both the longest stage at ${longest.hours.toFixed(1)} h and the biggest queue at ${worstQueue.queue.toFixed(1)} h of it, so almost none of that time is work`
          : `${longest.name.toLowerCase()} takes longest at ${longest.hours.toFixed(1)} h, but ${worstQueue.name.toLowerCase()} holds ${worstQueue.queue.toFixed(1)} h of pure waiting — buying speed in the first fixes nothing while a pallet sits in the second`}{" "}
        · dock to stock averages {mean.toFixed(1)} h
        {targetHours !== undefined ? `, with ${late.length} of ${rows.length} receipts past the ${targetHours} h target` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PutawayCongestion — where and when the aisles jam. Congestion is a
 * product of two things a heatmap of either alone cannot show: how
 * many moves land in an aisle and how narrow it is.
 * ------------------------------------------------------------------ */
export function PutawayCongestion({
  aisles,
  hours,
  moves,
  className = "",
}: {
  /** each aisle, with how many trucks can work in it at once */
  aisles: { name: string; capacity: number }[]
  hours: string[]
  /** moves[aisle][hour] */
  moves: number[][]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!aisles.length || !hours.length || !moves.length) return null

  // a move takes a truck for roughly a fifth of an hour, so demand in
  // truck-hours is what has to fit inside the aisle's capacity
  const TRUCK_HOURS_PER_MOVE = 0.2
  const load = moves.map((row, ai) => row.map((v) => (v * TRUCK_HOURS_PER_MOVE) / Math.max(aisles[ai].capacity, 1)))
  const over = load.flatMap((row, ai) => row.map((v, hi) => ({ v, ai, hi })).filter((x) => x.v > 1))
  const max = Math.max(1, ...load.flat())
  const byAisle = load.map((row) => row.reduce((a, v) => a + v, 0) / Math.max(row.length, 1))
  const worstAisle = byAisle.indexOf(Math.max(...byAisle))
  const byHour = hours.map((_, hi) => load.reduce((a, row) => a + row[hi], 0) / Math.max(load.length, 1))
  const worstHour = byHour.indexOf(Math.max(...byHour))

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background pr-2 text-left font-normal text-muted-foreground">aisle</th>
              {hours.map((h) => (
                <th key={h} className="px-1 pb-1 font-normal text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {aisles.map((a, ai) => (
              <tr key={a.name}>
                <td className="sticky left-0 bg-background pr-2 whitespace-nowrap">
                  {a.name}
                  <span className="ml-1 text-muted-foreground">×{a.capacity}</span>
                </td>
                {hours.map((h, hi) => {
                  const v = load[ai][hi]
                  return (
                    <td key={h} className="p-px">
                      <div
                        className="flex h-6 items-center justify-center rounded-[2px]"
                        style={{
                          background:
                            v > 1
                              ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                              : `color-mix(in oklch, currentColor ${clamp((v / max) * 72, 3, 72).toFixed(0)}%, transparent)`,
                          outline: v > 1 ? "1.5px solid currentColor" : undefined,
                          outlineOffset: -1.5,
                        }}
                        title={`${a.name} at ${h}: ${moves[ai][hi]} moves into ${a.capacity} truck slot${a.capacity === 1 ? "" : "s"} — ${(v * 100).toFixed(0)}% of capacity`}
                      >
                        <span className={v <= 1 && v / max > 0.6 ? "text-background" : undefined}>{moves[ai][hi]}</span>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Cells are move counts and the shading is what they DEMAND of that aisle's truck capacity — a narrow aisle jams
        on half the traffic a wide one absorbs, which no heatmap of moves alone can show · outlined cells are over
        capacity, {over.length} of {aisles.length * hours.length} · {aisles[worstAisle].name} is the tightest aisle
        across the day and {hours[worstHour]} is the worst hour, and moving one shift of putaway is usually cheaper
        than widening anything
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PalletCube — how much of a pallet each configuration really uses.
 * A carton that fits the footprint perfectly and stops short of the
 * height limit wastes a whole layer, invisibly.
 * ------------------------------------------------------------------ */
export function PalletCube({
  configs,
  pallet,
  className = "",
}: {
  configs: {
    name: string
    cartonMm: [number, number, number]
    perLayer: number
    layers: number
  }[]
  /** the pallet footprint and the maximum stack height including the pallet */
  pallet: { widthMm: number; depthMm: number; maxHeightMm: number; deckMm: number }
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!configs.length) return null

  const footprint = pallet.widthMm * pallet.depthMm
  const usableH = pallet.maxHeightMm - pallet.deckMm
  const rows = configs
    .map((c) => {
      const [w, d, h] = c.cartonMm
      const areaUsed = (w * d * c.perLayer) / Math.max(footprint, 1)
      const stackMm = h * c.layers
      const heightUsed = stackMm / Math.max(usableH, 1)
      // how many MORE layers would fit in the height that is left
      const spareLayers = Math.floor((usableH - stackMm) / Math.max(h, 1))
      return { ...c, areaUsed, heightUsed, stackMm, spareLayers, cube: areaUsed * heightUsed, cartons: c.perLayer * c.layers }
    })
    .sort((a, b) => b.cube - a.cube)
  const wasteful = rows.filter((r) => r.spareLayers > 0)
  const best = rows[0]

  return (
    <div className={className}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.cartonMm.join("×")} mm · {r.perLayer}/layer × {r.layers} = {r.cartons}
              </span>
            </div>
            <div className="mt-0.5 flex items-end gap-2">
              {/* footprint and stack drawn as two proportions, because cube
                  utilisation is their PRODUCT and a single bar hides which
                  of the two is the problem */}
              <div className="relative h-10 w-14 shrink-0 rounded-[2px] border border-foreground/30 bg-muted" title={`footprint ${(r.areaUsed * 100).toFixed(0)}%`}>
                <div className="absolute inset-y-0 left-0 bg-foreground/55" style={{ width: `${clamp(r.areaUsed * 100, 0, 100)}%` }} />
              </div>
              <div className="relative h-10 w-8 shrink-0 rounded-[2px] border border-foreground/30 bg-muted" title={`height ${(r.heightUsed * 100).toFixed(0)}%`}>
                <div className="absolute inset-x-0 bottom-0 bg-foreground/55" style={{ height: `${clamp(r.heightUsed * 100, 0, 100)}%` }} />
                {r.spareLayers > 0 && (
                  <div
                    className="absolute inset-x-0"
                    style={{
                      bottom: `${clamp(r.heightUsed * 100, 0, 100)}%`,
                      height: `${clamp(((r.spareLayers * r.cartonMm[2]) / Math.max(usableH, 1)) * 100, 0, 100)}%`,
                      background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                      outline: "1px solid currentColor",
                      outlineOffset: -1,
                    }}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="h-3 rounded-[2px] bg-muted">
                  <div className="h-full rounded-[2px] bg-foreground" style={{ width: `${clamp(r.cube * 100, 0, 100)}%` }} title={`cube ${(r.cube * 100).toFixed(0)}%`} />
                </div>
                <span className="text-[9px] tabular-nums text-muted-foreground">
                  {(r.cube * 100).toFixed(0)}% cube · {(r.areaUsed * 100).toFixed(0)}% footprint ×{" "}
                  {(r.heightUsed * 100).toFixed(0)}% height
                  {r.spareLayers > 0 ? ` · ${r.spareLayers} more layer${r.spareLayers === 1 ? "" : "s"} would fit` : ""}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Cube utilisation is footprint TIMES height, and splitting it is the point — a carton that tiles the deck
        perfectly and stops short of {pallet.maxHeightMm} mm wastes a whole layer that no footprint diagram shows ·{" "}
        {wasteful.length === 0
          ? "every configuration here is stacked to the limit"
          : `${wasteful.length} of ${rows.length} configurations ${wasteful.length === 1 ? "leaves" : "leave"} room for another layer, ${wasteful[0].name} for ${wasteful[0].spareLayers}`}{" "}
        · {best.name} is the best at {(best.cube * 100).toFixed(0)}%, and freight is billed on the pallet either way
      </p>
    </div>
  )
}
