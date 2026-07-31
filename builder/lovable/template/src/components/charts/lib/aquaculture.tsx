/**
 * Aquaculture primitives — feed conversion, biomass growth, mortality,
 * dissolved oxygen, sea lice and harvest timing.
 *
 * The feed a kilo of fish really cost, the biomass a pen actually holds,
 * what an event took out of a cohort, how long oxygen sat under the
 * threshold, whether a count breaches its limit and the week a harvest is
 * worth most are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e6 ? `£${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `£${(a / 1e3).toFixed(0)}k` : `£${Math.round(a).toLocaleString("en-GB")}`
  return v < 0 ? `−${s}` : s
}
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/* ------------------------------------------------------------------ *
 * FeedConversion — feed in against biomass gained, with the ECONOMIC
 * FCR derived. Biological FCR ignores the fish that died having eaten,
 * which is exactly the feed a farm actually bought.
 * ------------------------------------------------------------------ */
export function FeedConversion({
  pens,
  feedCostPerT,
  className = "",
}: {
  pens: { name: string; feedT: number; gainT: number; mortalityT: number }[]
  feedCostPerT: number
  className?: string
}) {
  const rows = pens
    .map((p) => {
      const biological = p.feedT / Math.max(p.gainT, 1e-9)
      // the fish that died ate too, and that biomass never left the pen
      const economic = p.feedT / Math.max(p.gainT - p.mortalityT, 1e-9)
      return {
        ...p,
        biological,
        economic,
        wastedFeed: p.feedT * (1 - p.gainT / Math.max(p.gainT + p.mortalityT, 1e-9)),
        gap: economic - biological,
      }
    })
    .sort((a, b) => a.economic - b.economic)
  const feed = rows.reduce((a, r) => a + r.feedT, 0)
  const gain = rows.reduce((a, r) => a + r.gainT, 0)
  const lost = rows.reduce((a, r) => a + r.mortalityT, 0)
  const siteBio = feed / Math.max(gain, 1e-9)
  const siteEcon = feed / Math.max(gain - lost, 1e-9)
  const max = Math.max(...rows.map((r) => r.economic)) * 1.05
  const worst = rows[rows.length - 1]

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.feedT.toFixed(0)} t feed · {r.gainT.toFixed(0)} t gained · {r.mortalityT.toFixed(1)} t lost
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/55" style={{ width: `${(r.biological / max) * 100}%` }} title={`biological FCR ${r.biological.toFixed(2)}`} />
              <div
                className="absolute inset-y-0 rounded-r-[2px]"
                style={{
                  left: `${(r.biological / max) * 100}%`,
                  width: `${(r.gap / max) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: r.gap > 0 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`the mortality penalty: ${r.gap.toFixed(2)}`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              FCR {r.biological.toFixed(2)} biological → {r.economic.toFixed(2)} economic ·{" "}
              {money(r.wastedFeed * feedCostPerT)} of feed went into fish that did not harvest
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched is the ECONOMIC penalty — the fish that died had already eaten, and that feed was bought · the site
        reads {siteBio.toFixed(2)} biological and {siteEcon.toFixed(2)} economic, a difference of{" "}
        {(siteEcon - siteBio).toFixed(2)} on {feed.toFixed(0)} tonnes of feed, which is{" "}
        {money(feed * (1 - siteBio / Math.max(siteEcon, 1e-9)) * feedCostPerT)} · {worst.name} is the weakest at{" "}
        {worst.economic.toFixed(2)}, and a biological FCR alone would have ranked it{" "}
        {rows.findIndex((r) => r.name === [...rows].sort((a, b) => a.biological - b.biological)[rows.length - 1].name) ===
        rows.length - 1
          ? "the same way"
          : "differently"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * BiomassGrowth — the standing biomass in a pen, which is fish count
 * TIMES weight and moves in opposite directions. A weight curve looks
 * healthy through a mortality event; the biomass does not.
 * ------------------------------------------------------------------ */
export function BiomassGrowth({
  weeks,
  consentT,
  height = 200,
  className = "",
}: {
  weeks: { week: number; fish: number; meanKg: number }[]
  /** the biomass the site licence permits */
  consentT?: number
  height?: number
  className?: string
}) {
  const rows = weeks.map((w) => ({ ...w, biomassT: (w.fish * w.meanKg) / 1000 }))
  const maxB = Math.max(consentT ?? 0, ...rows.map((r) => r.biomassT))
  const maxKg = Math.max(...rows.map((r) => r.meanKg))
  const maxFish = Math.max(...rows.map((r) => r.fish))
  const px = (i: number) => (rows.length < 2 ? 50 : (i / (rows.length - 1)) * 100)
  const breach = consentT === undefined ? -1 : rows.findIndex((r) => r.biomassT > consentT)
  const peak = rows.reduce((a, r) => (r.biomassT > a.biomassT ? r : a), rows[0])
  const lostFish = rows[0].fish - rows[rows.length - 1].fish

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {consentT !== undefined && (
            <line x1={0} y1={100 - (consentT / maxB) * 94 - 3} x2={100} y2={100 - (consentT / maxB) * 94 - 3} stroke="currentColor" strokeWidth={1} strokeDasharray="4 2" />
          )}
          <polygon
            points={`0,100 ${rows.map((r, i) => `${px(i)},${100 - (r.biomassT / maxB) * 94 - 3}`).join(" ")} 100,100`}
            fill="currentColor"
            opacity={0.17}
          />
          <polyline points={rows.map((r, i) => `${px(i)},${100 - (r.biomassT / maxB) * 94 - 3}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
        {consentT !== undefined && (
          <span className="absolute right-1 -translate-y-1/2 bg-background px-0.5 text-[9px] tabular-nums text-muted-foreground" style={{ top: `${100 - (consentT / maxB) * 94 - 3}%` }}>
            consent {consentT} t
          </span>
        )}
      </div>
      {/* the two factors get their OWN panel: three series on three different
          scales in one box, one of them next to the consent line, is unreadable */}
      <div className="relative mt-1 h-12 rounded-[2px] border border-foreground/15">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline points={rows.map((r, i) => `${px(i)},${100 - (r.meanKg / maxKg) * 88 - 6}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.3} strokeDasharray="5 2" vectorEffect="non-scaling-stroke" />
          <polyline points={rows.map((r, i) => `${px(i)},${100 - (r.fish / maxFish) * 88 - 6}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.3} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute left-1 top-0.5 text-[9px] text-muted-foreground">dashed weight · dotted count, each to its own scale</span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>week {rows[0].week}</span>
        <span>upper panel: biomass against consent</span>
        <span>week {rows[rows.length - 1].week}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Biomass</dt>
          <dd className="font-medium tabular-nums">{rows[rows.length - 1].biomassT.toFixed(0)} t</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mean weight</dt>
          <dd className="font-medium tabular-nums">{rows[rows.length - 1].meanKg.toFixed(2)} kg</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fish lost</dt>
          <dd className="font-medium tabular-nums">{lostFish.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Peak</dt>
          <dd className="font-medium tabular-nums">week {peak.week}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Biomass is count TIMES weight and the two move in opposite directions — the dashed weight curve rises
        throughout while {lostFish.toLocaleString()} fish were lost, so a growth chart alone reads as a healthy
        cohort ·{" "}
        {breach >= 0
          ? `the consent is exceeded from week ${rows[breach].week}, which is a regulatory event a weight curve cannot show`
          : consentT === undefined
            ? `the pen peaks at ${peak.biomassT.toFixed(0)} t in week ${peak.week}`
            : `the pen peaks at ${peak.biomassT.toFixed(0)} t against a ${consentT} t consent, ${(consentT - peak.biomassT).toFixed(0)} t under`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * MortalityEvents — daily mortality against the background rate, with
 * the EXCESS attributed to events. A cumulative mortality figure is
 * one number and a farm needs to know which week produced it.
 * ------------------------------------------------------------------ */
export function MortalityEvents({
  days,
  events,
  height = 190,
  className = "",
}: {
  /** deaths each day and the stock alive at the start of it */
  days: { day: number; deaths: number; alive: number }[]
  /** anything worth naming on the timeline */
  events?: { day: number; label: string }[]
  height?: number
  className?: string
}) {
  const rates = days.map((d) => d.deaths / Math.max(d.alive, 1))
  const sorted = [...rates].sort((a, b) => a - b)
  // the background is the MEDIAN, not the mean, so a single bad week does
  // not raise the line it is supposed to be measured against
  const background = sorted[Math.floor(sorted.length / 2)]
  const rows = days.map((d, i) => ({
    ...d,
    rate: rates[i],
    expected: d.alive * background,
    excess: Math.max(0, d.deaths - d.alive * background),
  }))
  const totalDeaths = rows.reduce((a, r) => a + r.deaths, 0)
  const totalExcess = rows.reduce((a, r) => a + r.excess, 0)
  const cumulative = totalDeaths / Math.max(days[0].alive, 1)
  const max = Math.max(...rows.map((r) => r.deaths))
  const worst = rows.reduce((a, r) => (r.excess > a.excess ? r : a), rows[0])
  const spikes = rows.filter((r) => r.rate > background * 3)

  return (
    <div className={className}>
      <div className="relative flex items-stretch gap-px rounded-[2px] border border-foreground/15" style={{ height }}>
        {rows.map((r) => (
          <div key={r.day} className="relative min-w-0 flex-1" title={`day ${r.day}: ${r.deaths} deaths of ${r.alive.toLocaleString()}`}>
            <div
              className="absolute inset-x-0 bottom-0"
              style={{ height: `${(Math.min(r.deaths, r.expected) / max) * 100}%`, background: "color-mix(in oklch, currentColor 32%, transparent)" }}
            />
            {r.excess > 0 && (
              <div
                className="absolute inset-x-0"
                style={{
                  bottom: `${(r.expected / max) * 100}%`,
                  height: `${(r.excess / max) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: "1px solid currentColor",
                  outlineOffset: -1,
                }}
              />
            )}
          </div>
        ))}
        {events?.map((e) => (
          <span
            key={e.label}
            className="pointer-events-none absolute inset-y-0 w-px bg-foreground/60"
            style={{ left: `${((rows.findIndex((r) => r.day >= e.day) + 0.5) / rows.length) * 100}%` }}
            title={e.label}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>day {rows[0].day}</span>
        <span>{events?.map((e) => e.label).join(" · ")}</span>
        <span>day {rows[rows.length - 1].day}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Cumulative</dt>
          <dd className="font-medium tabular-nums">{(cumulative * 100).toFixed(2)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Background</dt>
          <dd className="font-medium tabular-nums">{(background * 100).toFixed(3)}%/d</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Excess</dt>
          <dd className="font-medium tabular-nums">{Math.round(totalExcess).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Worst day</dt>
          <dd className="font-medium tabular-nums">{worst.day}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched is EXCESS over the background rate, which is taken as the MEDIAN daily rate so that a bad week cannot
        raise the line it is being measured against · {Math.round(totalExcess).toLocaleString()} of{" "}
        {totalDeaths.toLocaleString()} deaths, {((totalExcess / Math.max(totalDeaths, 1)) * 100).toFixed(0)}%, sit
        above it and {spikes.length} {plural(spikes.length, "day is", "days are")} more than three times background ·
        day {worst.day} alone accounts for {Math.round(worst.excess).toLocaleString()}, which a cumulative mortality
        percentage buries completely
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * OxygenDip — dissolved oxygen against the threshold, with the time
 * BELOW it derived. Fish stop feeding below a level for a duration,
 * and a daily minimum reading captures neither.
 * ------------------------------------------------------------------ */
export function OxygenDip({
  readings,
  thresholdMgL,
  criticalMgL,
  intervalMin = 15,
  height = 190,
  className = "",
}: {
  readings: { minute: number; mgL: number }[]
  /** the level below which fish stop feeding */
  thresholdMgL: number
  /** the level below which they are at risk */
  criticalMgL: number
  intervalMin?: number
  height?: number
  className?: string
}) {
  const pts = [...readings].sort((a, b) => a.minute - b.minute)
  let belowT = 0
  let belowC = 0
  for (let i = 1; i < pts.length; i++) {
    const dt = pts[i].minute - pts[i - 1].minute
    const mid = (pts[i].mgL + pts[i - 1].mgL) / 2
    if (mid < criticalMgL) belowC += dt
    if (mid < thresholdMgL) belowT += dt
  }
  const span = pts[pts.length - 1].minute - pts[0].minute
  const min = pts.reduce((a, p) => (p.mgL < a.mgL ? p : a), pts[0])
  const lo = Math.min(criticalMgL - 0.5, ...pts.map((p) => p.mgL))
  const hi = Math.max(...pts.map((p) => p.mgL)) + 0.5
  const px = (m: number) => ((m - pts[0].minute) / Math.max(span, 1e-9)) * 100
  const py = (v: number) => 100 - ((v - lo) / Math.max(hi - lo, 1e-9)) * 100
  const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`
  // a daily minimum, which is what most records keep
  const dailyMin = min.mgL

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <rect x={0} y={py(criticalMgL)} width={100} height={Math.max(0, 100 - py(criticalMgL))} fill="currentColor" opacity={0.16} />
          <rect x={0} y={py(thresholdMgL)} width={100} height={Math.max(0, py(criticalMgL) - py(thresholdMgL))} fill="currentColor" opacity={0.07} />
          <polyline points={pts.map((p) => `${px(p.minute)},${py(p.mgL)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute right-1 -translate-y-1/2 bg-background px-0.5 text-[9px] tabular-nums text-muted-foreground" style={{ top: `${py(thresholdMgL)}%` }}>
          {thresholdMgL} mg/L
        </span>
        <span className="absolute right-1 -translate-y-1/2 bg-background px-0.5 text-[9px] tabular-nums text-muted-foreground" style={{ top: `${py(criticalMgL)}%` }}>
          {criticalMgL} mg/L
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{clock(pts[0].minute)}</span>
        <span>every {intervalMin} min</span>
        <span>{clock(pts[pts.length - 1].minute)}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Minimum</dt>
          <dd className="font-medium tabular-nums">{dailyMin.toFixed(2)} mg/L</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Trough at</dt>
          <dd className="font-medium tabular-nums">{clock(min.minute)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Under {thresholdMgL}</dt>
          <dd className="font-medium tabular-nums">{Math.round(belowT)} min</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Under {criticalMgL}</dt>
          <dd className="font-medium tabular-nums">{Math.round(belowC)} min</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The exposure is a DURATION, integrated between readings — a record that keeps only a daily minimum of{" "}
        {dailyMin.toFixed(2)} mg/L cannot distinguish a brief dip from{" "}
        {Math.round(belowT)} minutes of not feeding ·{" "}
        {belowC > 0
          ? `${Math.round(belowC)} of those minutes are below the ${criticalMgL} mg/L critical line, which is where the loss happens rather than the loss of appetite`
          : `nothing fell below the ${criticalMgL} mg/L critical line`}{" "}
        · the dip bottoms at {clock(min.minute)}, before dawn, which is when it always is
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SeaLice — counts against the treatment trigger, by pen and week,
 * with the SITE AVERAGE derived. The limit is a site number and the
 * decision is made pen by pen.
 * ------------------------------------------------------------------ */
export function SeaLice({
  pens,
  weeks,
  counts,
  trigger,
  className = "",
}: {
  pens: string[]
  weeks: string[]
  /** adult female lice per fish, counts[pen][week] */
  counts: number[][]
  trigger: number
  className?: string
}) {
  const siteAvg = weeks.map((_, wi) => counts.reduce((a, row) => a + row[wi], 0) / Math.max(counts.length, 1))
  const max = Math.max(trigger, ...counts.flat())
  const breachWeeks = siteAvg.filter((v) => v >= trigger).length
  const firstBreach = siteAvg.findIndex((v) => v >= trigger)
  const penBreaches = pens.map((_, pi) => counts[pi].filter((v) => v >= trigger).length)
  const worstPen = penBreaches.indexOf(Math.max(...penBreaches))
  const earlyPen = pens
    .map((_, pi) => counts[pi].findIndex((v) => v >= trigger))
    .map((i, pi) => ({ i: i < 0 ? Infinity : i, pi }))
    .sort((a, b) => a.i - b.i)[0]

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background pr-2 text-left font-normal text-muted-foreground">pen</th>
              {weeks.map((w) => (
                <th key={w} className="px-1 pb-1 font-normal text-muted-foreground">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pens.map((p, pi) => (
              <tr key={p}>
                <td className="sticky left-0 bg-background pr-2 whitespace-nowrap">{p}</td>
                {weeks.map((w, wi) => {
                  const v = counts[pi][wi]
                  const over = v >= trigger
                  return (
                    <td key={w} className="p-px">
                      <div
                        className="flex h-6 items-center justify-center rounded-[2px]"
                        style={{
                          background: `color-mix(in oklch, currentColor ${clamp((v / max) * 80, 3, 80).toFixed(0)}%, transparent)`,
                          outline: over ? "1.5px solid currentColor" : undefined,
                          outlineOffset: -1.5,
                        }}
                        title={`${p} · ${w}: ${v.toFixed(2)} adult females${over ? " — over the trigger" : ""}`}
                      >
                        <span className={v / max > 0.6 ? "text-background" : undefined}>{v.toFixed(2)}</span>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <td className="sticky left-0 bg-background pr-2 whitespace-nowrap font-medium">Site</td>
              {siteAvg.map((v, wi) => (
                <td key={wi} className="p-px">
                  <div
                    className="flex h-6 items-center justify-center rounded-[2px] font-medium"
                    style={{
                      background: `color-mix(in oklch, currentColor ${clamp((v / max) * 80, 3, 80).toFixed(0)}%, transparent)`,
                      outline: v >= trigger ? "2px solid currentColor" : undefined,
                      outlineOffset: -2,
                    }}
                    title={`site average ${v.toFixed(2)}`}
                  >
                    <span className={v / max > 0.6 ? "text-background" : undefined}>{v.toFixed(2)}</span>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bottom row is the SITE average, which is what the trigger of {trigger.toFixed(2)} adult females applies
        to — the decision is regulated at the site and the infestation happens in one pen ·{" "}
        {firstBreach < 0
          ? "the site average never reaches the trigger"
          : `the site crosses it in ${weeks[firstBreach]} and stays over for ${breachWeeks} ${plural(breachWeeks, "week", "weeks")}`}{" "}
        · {pens[earlyPen.pi]} breaches first and {pens[worstPen]} most often ({penBreaches[worstPen]}{" "}
        {plural(penBreaches[worstPen], "week", "weeks")}), so treating the site averages a problem that belongs to
        one net
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * HarvestWindow — the value of harvesting in each week, with the
 * OPTIMUM derived from growth, price and the mortality risk of
 * waiting. Fish keep growing and the price does not stand still.
 * ------------------------------------------------------------------ */
export function HarvestWindow({
  weeks,
  feedCostPerT,
  weeklyMortality,
  className = "",
}: {
  /** the biomass, the size-graded price and the feed each week would cost */
  weeks: { week: number; biomassT: number; pricePerT: number; feedT: number }[]
  feedCostPerT: number
  /** the share of stock lost each week of waiting */
  weeklyMortality: number
  className?: string
}) {
  let cumulativeFeed = 0
  const rows = weeks.map((w, i) => {
    if (i > 0) cumulativeFeed += weeks[i].feedT * feedCostPerT
    const survival = Math.pow(1 - weeklyMortality, i)
    const gross = w.biomassT * w.pricePerT * survival
    return { ...w, gross, net: gross - cumulativeFeed, survival, feedSoFar: cumulativeFeed }
  })
  const best = rows.reduce((a, r) => (r.net > a.net ? r : a), rows[0])
  const bestGross = rows.reduce((a, r) => (r.gross > a.gross ? r : a), rows[0])
  const lo = Math.min(...rows.map((r) => r.net))
  const hi = Math.max(...rows.map((r) => r.net))
  const pad = (hi - lo) * 0.15
  const max = Math.max(...rows.map((r) => r.gross))

  return (
    <div className={className}>
      <div className="relative flex items-stretch gap-1 rounded-[2px] border border-foreground/15" style={{ height: 150 }}>
        {rows.map((r) => (
          <div key={r.week} className="relative min-w-0 flex-1" title={`week ${r.week}: ${money(r.net)} net`}>
            <div className="absolute inset-x-0 bottom-0 rounded-t-[1px]" style={{ height: `${(r.gross / max) * 100}%`, background: "color-mix(in oklch, currentColor 20%, transparent)" }} />
            <div
              className="absolute inset-x-1 bottom-0 rounded-t-[1px]"
              style={{
                height: `${clamp(((r.net - (lo - pad)) / Math.max(hi - lo + pad * 2, 1e-9)) * 100, 2, 100)}%`,
                background: r.week === best.week ? "currentColor" : "color-mix(in oklch, currentColor 55%, transparent)",
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex gap-1 text-[9px] text-muted-foreground tabular-nums">
        {rows.map((r) => (
          <span key={r.week} className="min-w-0 flex-1 truncate text-center">
            {r.week}
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Best week</dt>
          <dd className="font-medium tabular-nums">{best.week}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Net there</dt>
          <dd className="font-medium tabular-nums">{money(best.net)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Survival</dt>
          <dd className="font-medium tabular-nums">{(best.survival * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Feed by then</dt>
          <dd className="font-medium tabular-nums">{money(best.feedSoFar)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is the gross value of harvesting that week and solid is NET of the feed spent getting there and the
        stock lost waiting — the net bars sit on a truncated axis, because the decision is a difference of a few per
        cent · the gross peaks in week {bestGross.week} and the net in week {best.week},{" "}
        {bestGross.week === best.week
          ? "which is the same week and makes the call easy"
          : `${Math.abs(bestGross.week - best.week)} ${plural(Math.abs(bestGross.week - best.week), "week", "weeks")} apart — every week of waiting buys growth and pays for it twice`}
      </p>
    </div>
  )
}
