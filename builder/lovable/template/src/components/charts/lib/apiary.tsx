/**
 * Beekeeping primitives — hive weight, mite load, forage, swarming, the
 * extraction and the overwinter loss.
 *
 * The nectar flow inferred from consecutive weighings, the mite treatment
 * threshold, the forage gap, the swarm risk score, the honey actually
 * saleable and the loss rate against the survey are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) =>
  "£" + (Math.abs(v) < 10 ? Math.abs(v).toFixed(2) : Math.round(Math.abs(v)).toLocaleString("en-GB"))

/* ------------------------------------------------------------------ *
 * HiveWeight — daily weight, with the FLOW derived as the difference
 * between consecutive readings. A hive gaining 2 kg a day is on a flow;
 * a hive losing it is eating stores, and the weight alone says neither.
 * ------------------------------------------------------------------ */
export function HiveWeight({
  readings,
  height = 190,
  className = "",
}: {
  /** date label and gross hive weight in kg */
  readings: { label: string; kg: number }[]
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!readings.length) return null

  const rows = readings.map((r, i) => {
    const prev = readings[i - 1]
    return { ...r, delta: prev ? r.kg - prev.kg : 0 }
  })
  const flowDays = rows.filter((r) => r.delta > 0.4)
  const drawDays = rows.filter((r) => r.delta < -0.4)
  const gained = rows.reduce((a, r) => a + Math.max(0, r.delta), 0)
  const lost = rows.reduce((a, r) => a + Math.min(0, r.delta), 0)
  const lo = Math.min(...rows.map((r) => r.kg))
  const hi = Math.max(...rows.map((r) => r.kg))
  const pad = Math.max((hi - lo) * 0.15, 0.5)
  const py = (v: number) => 100 - ((v - (lo - pad)) / (hi - lo + pad * 2)) * 100
  const px = (i: number) => (rows.length < 2 ? 50 : (i / (rows.length - 1)) * 100)
  const maxDelta = Math.max(0.1, ...rows.map((r) => Math.abs(r.delta)))

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline
            points={rows.map((r, i) => `${px(i)},${py(r.kg)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      {/* the flow, drawn as a signed strip — the reading everybody wants
          from a hive scale and the one a weight line does not show */}
      <div className="relative mt-1 flex h-10 items-stretch gap-px border-y border-foreground/15">
        {rows.slice(1).map((r) => (
          <div key={r.label} className="relative min-w-0 flex-1" title={`${r.label}: ${r.delta > 0 ? "+" : ""}${r.delta.toFixed(1)} kg`}>
            <div
              className="absolute inset-x-0"
              style={{
                top: r.delta >= 0 ? `${50 - (r.delta / maxDelta) * 50}%` : "50%",
                height: `${(Math.abs(r.delta) / maxDelta) * 50}%`,
                background:
                  r.delta >= 0
                    ? "currentColor"
                    : "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 4px)",
                outline: r.delta < 0 ? "1px solid currentColor" : undefined,
                outlineOffset: -1,
              }}
            />
          </div>
        ))}
        <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-foreground/40" />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{rows[0]?.label}</span>
        <span>gain solid, draw hatched</span>
        <span>{rows[rows.length - 1]?.label}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Net</dt>
          <dd className="font-medium tabular-nums">{(rows[rows.length - 1].kg - rows[0].kg).toFixed(1)} kg</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Gained</dt>
          <dd className="font-medium tabular-nums">{gained.toFixed(1)} kg</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Drawn down</dt>
          <dd className="font-medium tabular-nums">{Math.abs(lost).toFixed(1)} kg</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Flow days</dt>
          <dd className="font-medium tabular-nums">{flowDays.length}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The strip is the DIFFERENCE between weighings, which is the flow — {flowDays.length} days put weight on and{" "}
        {drawDays.length} took it off, and a net {(rows[rows.length - 1].kg - rows[0].kg).toFixed(1)} kg hides{" "}
        {gained.toFixed(1)} kg gained against {Math.abs(lost).toFixed(1)} kg eaten · a weight line alone cannot tell a
        good week followed by a bad one from a flat one
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * VarroaLoad — mites per hundred bees against the treatment
 * threshold, with the months a colony spent over it derived. The
 * threshold is the decision; the count is only the input.
 * ------------------------------------------------------------------ */
export function VarroaLoad({
  colonies,
  months,
  counts,
  threshold = 3,
  className = "",
}: {
  colonies: string[]
  months: string[]
  /** counts[colony][month] — mites per 100 bees from an alcohol wash */
  counts: number[][]
  /** the count at which treatment is indicated */
  threshold?: number
  className?: string
}) {
  const max = Math.max(threshold, ...counts.flat())
  const overByColony = counts.map((row) => row.filter((v) => v >= threshold).length)
  const worst = overByColony.reduce((a, v, i) => (v > overByColony[a] ? i : a), 0)
  const everOver = overByColony.filter((v) => v > 0).length

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background pr-2 text-left font-normal text-muted-foreground">colony</th>
              {months.map((m) => (
                <th key={m} className="px-1 pb-1 font-normal text-muted-foreground">
                  {m}
                </th>
              ))}
              <th className="pl-2 text-right font-normal text-muted-foreground">over</th>
            </tr>
          </thead>
          <tbody>
            {colonies.map((c, ci) => (
              <tr key={c}>
                <td className="sticky left-0 bg-background pr-2 whitespace-nowrap">{c}</td>
                {months.map((m, mi) => {
                  const v = counts[ci]?.[mi] ?? 0
                  const over = v >= threshold
                  return (
                    <td key={m} className="p-px">
                      <div
                        className="flex h-6 items-center justify-center rounded-[2px]"
                        style={{
                          background: `color-mix(in oklch, currentColor ${clamp((v / max) * 78, 4, 78).toFixed(0)}%, transparent)`,
                          outline: over ? "1.5px solid currentColor" : undefined,
                          outlineOffset: -1.5,
                        }}
                        title={`${c} · ${m}: ${v.toFixed(1)} per 100${over ? " — treat" : ""}`}
                      >
                        {/* the numeral is a CHILD, so setting its colour cannot
                            redefine currentColor for the cell's own background */}
                        <span className={v / max > 0.6 ? "text-background" : undefined}>{v.toFixed(1)}</span>
                      </div>
                    </td>
                  )
                })}
                <td className="pl-2 text-right font-medium">{overByColony[ci]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Outlined cells are at or over {threshold} mites per hundred bees, which is the treatment threshold —{" "}
        {everOver} of {colonies.length} colonies crossed it at least once and {colonies[worst]} spent{" "}
        {overByColony[worst]} months there · the count is the input and the threshold is the decision, so a chart
        without the line on it asks the beekeeper to remember the number
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ForageCalendar — what is in flower, when, and the GAPS. A gap is
 * the thing an apiary plants for, and it is invisible in a list of
 * flowering dates.
 * ------------------------------------------------------------------ */
export function ForageCalendar({
  sources,
  weeks = 34,
  startWeek = 10,
  className = "",
}: {
  /** each forage source's flowering window in ISO week numbers */
  sources: { name: string; fromWeek: number; toWeek: number; strength?: number }[]
  weeks?: number
  startWeek?: number
  className?: string
}) {
  const cover = Array.from({ length: weeks }, (_, i) => {
    const w = startWeek + i
    const active = sources.filter((s) => w >= s.fromWeek && w <= s.toWeek)
    return { week: w, active, strength: active.reduce((a, s) => a + (s.strength ?? 1), 0) }
  })
  const gaps: { from: number; to: number }[] = []
  cover.forEach((c) => {
    if (c.strength > 0) return
    const last = gaps[gaps.length - 1]
    if (last && last.to === c.week - 1) last.to = c.week
    else gaps.push({ from: c.week, to: c.week })
  })
  const maxStrength = Math.max(1, ...cover.map((c) => c.strength))
  const longest = gaps.reduce((a, g) => (g.to - g.from > a.to - a.from ? g : a), gaps[0] ?? { from: 0, to: -1 })
  const sorted = [...sources].sort((a, b) => a.fromWeek - b.fromWeek)
  const pct = (w: number) => ((w - startWeek) / weeks) * 100

  return (
    <div className={className}>
      <ul className="space-y-1">
        {sorted.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-[10px]">
            <span className="w-28 shrink-0 truncate">{s.name}</span>
            <div className="relative h-3.5 flex-1 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px]"
                style={{
                  left: `${clamp(pct(s.fromWeek), 0, 100)}%`,
                  width: `${clamp(pct(s.toWeek + 1) - pct(s.fromWeek), 0, 100)}%`,
                  background: `color-mix(in oklch, currentColor ${clamp((s.strength ?? 1) * 34, 22, 92).toFixed(0)}%, transparent)`,
                }}
                title={`${s.name}: weeks ${s.fromWeek}–${s.toWeek}`}
              />
            </div>
            <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">
              w{s.fromWeek}–{s.toWeek}
            </span>
          </li>
        ))}
      </ul>
      {/* the derived half: total forage in each week, with the dearths */}
      <div className="mt-2 flex items-stretch gap-px" style={{ height: 44 }}>
        {cover.map((c) => (
          <div key={c.week} className="relative min-w-0 flex-1" title={`week ${c.week}: ${c.active.length} in flower`}>
            <div
              className="absolute inset-x-0 bottom-0 rounded-t-[1px]"
              style={{
                height: `${(c.strength / maxStrength) * 100}%`,
                background: "currentColor",
              }}
            />
            {c.strength === 0 && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground/70" />}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>week {startWeek}</span>
        <span>week {startWeek + weeks - 1}</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bars below are total forage in each week, and the flat marks are DEARTHS — weeks with nothing in flower ·{" "}
        {gaps.length === 0
          ? "there is no gap in this calendar, which is the answer an apiary is planted to reach"
          : `${gaps.length} gap${gaps.length === 1 ? "" : "s"}, the longest weeks ${longest.from}–${longest.to}, which is where a colony eats its stores in the middle of summer — a list of flowering dates cannot show it`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SwarmRisk — the inspection signals a colony gives before it goes,
 * scored. Any one of them is normal; it is the COMBINATION and the
 * date that matter, so the score is derived rather than reported.
 * ------------------------------------------------------------------ */
export function SwarmRisk({
  inspections,
  className = "",
}: {
  inspections: {
    date: string
    queenCells: number
    framesOfBrood: number
    framesSpare: number
    /** whether drone brood is present in quantity */
    drones: boolean
  }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!inspections.length) return null

  const rows = inspections.map((i) => {
    const congestion = clamp(1 - i.framesSpare / Math.max(i.framesOfBrood, 1), 0, 1)
    const cells = clamp(i.queenCells / 6, 0, 1)
    const score = clamp(cells * 0.55 + congestion * 0.3 + (i.drones ? 0.15 : 0), 0, 1)
    return { ...i, congestion, score, action: score >= 0.6 ? "split" : score >= 0.35 ? "add space" : "watch" }
  })
  const first = rows.find((r) => r.score >= 0.6)
  const peak = rows.reduce((a, r) => (r.score > a.score ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.date}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.date}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.queenCells} cells · {r.framesOfBrood} brood · {r.framesSpare} spare{r.drones ? " · drones" : ""}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${r.score * 100}%`,
                  background:
                    r.score >= 0.6
                      ? "currentColor"
                      : `color-mix(in oklch, currentColor ${(30 + r.score * 45).toFixed(0)}%, transparent)`,
                }}
              />
              <span className="absolute inset-y-0 w-px bg-foreground/55" style={{ left: "60%" }} title="split" />
              <span className="absolute inset-y-0 w-px bg-foreground/35" style={{ left: "35%" }} title="add space" />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              score {(r.score * 100).toFixed(0)} · congestion {(r.congestion * 100).toFixed(0)}% → {r.action}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The score is DERIVED from the three signals together, weighted to queen cells — any one alone is an ordinary
        colony in May ·{" "}
        {first
          ? `it crosses the split line on ${first.date}, and every inspection after that is late`
          : `it never crosses the split line; the peak is ${(peak.score * 100).toFixed(0)} on ${peak.date}`}{" "}
        · the ticks are the two decisions, drawn on the bar so the number does not have to be remembered
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * HoneyExtraction — supers in, honey out, and the SALEABLE weight
 * after moisture rejection. A super is not a jar until it has passed
 * the refractometer.
 * ------------------------------------------------------------------ */
export function HoneyExtraction({
  batches,
  maxMoisture = 20,
  pricePerKg,
  className = "",
}: {
  batches: { name: string; supers: number; grossKg: number; moisturePercent: number }[]
  /** the moisture above which honey ferments and cannot be sold */
  maxMoisture?: number
  pricePerKg?: number
  className?: string
}) {
  const rows = batches.map((b) => {
    const ok = b.moisturePercent <= maxMoisture
    return {
      ...b,
      ok,
      perSuper: b.grossKg / Math.max(b.supers, 1),
      saleableKg: ok ? b.grossKg : 0,
      value: ok && pricePerKg ? b.grossKg * pricePerKg : 0,
    }
  })
  const gross = rows.reduce((a, r) => a + r.grossKg, 0)
  const saleable = rows.reduce((a, r) => a + r.saleableKg, 0)
  const rejected = rows.filter((r) => !r.ok)
  const supers = rows.reduce((a, r) => a + r.supers, 0)
  const max = Math.max(...rows.map((r) => r.grossKg))

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.supers} supers · {r.moisturePercent.toFixed(1)}% moisture
              </span>
            </div>
            <div className="mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(r.grossKg / max) * 100}%`,
                  background: r.ok
                    ? "currentColor"
                    : "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: r.ok ? undefined : "1px solid currentColor",
                  outlineOffset: -1,
                }}
                title={`${r.grossKg.toFixed(1)} kg`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.grossKg.toFixed(1)} kg · {r.perSuper.toFixed(1)} kg a super ·{" "}
              {r.ok ? `saleable${pricePerKg ? `, ${money(r.value)}` : ""}` : `over ${maxMoisture}% — will ferment`}
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Gross</dt>
          <dd className="font-medium tabular-nums">{gross.toFixed(0)} kg</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Saleable</dt>
          <dd className="font-medium tabular-nums">{saleable.toFixed(0)} kg</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Per super</dt>
          <dd className="font-medium tabular-nums">{(gross / Math.max(supers, 1)).toFixed(1)} kg</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{pricePerKg ? "Value" : "Rejected"}</dt>
          <dd className="font-medium tabular-nums">
            {pricePerKg ? money(rows.reduce((a, r) => a + r.value, 0)) : `${(gross - saleable).toFixed(0)} kg`}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched batches are over {maxMoisture}% moisture and cannot be sold as honey ·{" "}
        {rejected.length === 0
          ? "every batch passed, so gross and saleable are the same number"
          : `${(gross - saleable).toFixed(0)} kg of the ${gross.toFixed(0)} kg extracted is not honey yet — ${rejected.map((r) => r.name).join(", ")} came off too early, and no amount of jarring fixes it`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * WinterLoss — colonies in against colonies out, by cause, against
 * the national survey figure. A loss rate means nothing without the
 * comparison, and the causes are what an apiary can act on.
 * ------------------------------------------------------------------ */
export function WinterLoss({
  years,
  surveyRate,
  className = "",
}: {
  years: { year: string; wentIn: number; lostStarvation: number; lostQueen: number; lostVarroa: number; lostOther: number }[]
  /** the national survey loss rate as a fraction, for comparison */
  surveyRate?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!years.length) return null

  const rows = years.map((y) => {
    const lost = y.lostStarvation + y.lostQueen + y.lostVarroa + y.lostOther
    return { ...y, lost, survived: y.wentIn - lost, rate: lost / Math.max(y.wentIn, 1) }
  })
  const latest = rows[rows.length - 1]
  const mean = rows.reduce((a, r) => a + r.rate, 0) / Math.max(rows.length, 1)
  const causes: [keyof (typeof years)[number], string, string][] = [
    ["lostStarvation", "Starvation", "currentColor"],
    ["lostVarroa", "Varroa", "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)"],
    ["lostQueen", "Queen failure", "color-mix(in oklch, currentColor 52%, transparent)"],
    ["lostOther", "Other", "color-mix(in oklch, currentColor 20%, transparent)"],
  ]
  const biggest = causes.reduce(
    (a, [k]) => {
      const total = rows.reduce((s, r) => s + (r[k] as number), 0)
      return total > a.total ? { key: k, total } : a
    },
    { key: causes[0][0], total: -1 },
  )
  const biggestLabel = causes.find((c) => c[0] === biggest.key)?.[1] ?? ""
  const maxLost = Math.max(1, ...rows.map((r) => r.lost))

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.year}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span>{r.year}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.lost} of {r.wentIn} · {(r.rate * 100).toFixed(0)}%
              </span>
            </div>
            <div className="relative mt-0.5 flex h-4 gap-px rounded-[2px] bg-muted">
              {causes.map(([k, label, bg]) => (
                <div
                  key={label}
                  className="min-w-0 first:rounded-l-[2px] last:rounded-r-[2px]"
                  style={{ width: `${((r[k] as number) / maxLost) * 100}%`, background: bg }}
                  title={`${label}: ${r[k] as number}`}
                />
              ))}
              {surveyRate !== undefined && (
                <span
                  className="absolute inset-y-0 w-0.5 bg-foreground/70"
                  style={{ left: `${clamp(((surveyRate * r.wentIn) / maxLost) * 100, 0, 100)}%` }}
                  title={`survey rate ${(surveyRate * 100).toFixed(0)}%`}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {causes.map(([, label, bg]) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25" style={{ background: bg }} />
            {label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Bars are colonies LOST, split by cause, and the tick is the {surveyRate === undefined ? "survey" : `${(surveyRate * 100).toFixed(0)}% survey`}{" "}
        rate applied to that year's colony count — a loss rate on its own is a number without a comparison ·{" "}
        {latest.year} lost {(latest.rate * 100).toFixed(0)}% against a {(mean * 100).toFixed(0)}% average here
        {surveyRate !== undefined ? ` and ${(surveyRate * 100).toFixed(0)}% nationally` : ""} · {biggestLabel} is the
        largest cause across the record, which is the one worth changing
      </p>
    </div>
  )
}
