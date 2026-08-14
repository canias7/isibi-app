/**
 * Bakery primitives — formula percentages, proofing, oven scheduling,
 * wastage, dough temperature and staling.
 *
 * The baker's percentages and hydration from a weight formula, the proof
 * time at the actual dough temperature, the oven's real throughput, the
 * cost of what was baked and not sold, the water temperature needed and
 * the saleable shelf life are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) =>
  "£" + (Math.abs(v) < 10 ? Math.abs(v).toFixed(2) : Math.round(Math.abs(v)).toLocaleString("en-GB"))

/* ------------------------------------------------------------------ *
 * BakersPercent — a formula in grams, converted. Hydration and salt
 * percentage are what make two recipes comparable, and a weight list
 * cannot be compared with another weight list.
 * ------------------------------------------------------------------ */
export function BakersPercent({
  formulas,
  className = "",
}: {
  formulas: {
    name: string
    /** every ingredient in grams; flours are named in `flours` */
    ingredients: { name: string; grams: number; isFlour?: boolean; isWater?: boolean }[]
  }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!formulas.length) return null

  const rows = formulas.map((f) => {
    const flour = f.ingredients.filter((i) => i.isFlour).reduce((a, i) => a + i.grams, 0) || 1
    const items = f.ingredients.map((i) => ({ ...i, pct: i.grams / flour }))
    const water = items.filter((i) => i.isWater).reduce((a, i) => a + i.pct, 0)
    const salt = items.find((i) => /salt/i.test(i.name))?.pct ?? 0
    const total = f.ingredients.reduce((a, i) => a + i.grams, 0)
    return { ...f, items, flour, water, salt, total }
  })
  const maxPct = Math.max(...rows.flatMap((r) => r.items.filter((i) => !i.isFlour).map((i) => i.pct)))
  const stiff = rows.reduce((a, r) => (r.water < a.water ? r : a), rows[0])
  const slack = rows.reduce((a, r) => (r.water > a.water ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate font-medium">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {(r.water * 100).toFixed(0)}% hydration · {(r.salt * 100).toFixed(1)}% salt ·{" "}
                {(r.total / 1000).toFixed(2)} kg
              </span>
            </div>
            <ul className="mt-1 space-y-0.5">
              {r.items.map((i) => (
                <li key={i.name} className="flex items-center gap-2 text-[10px] tabular-nums">
                  <span className="w-28 shrink-0 truncate">{i.name}</span>
                  <span className="w-14 shrink-0 text-right text-muted-foreground">{i.grams} g</span>
                  <div className="h-2 flex-1 rounded-[1px] bg-muted">
                    <div
                      className="h-full rounded-[1px]"
                      style={{
                        width: `${i.isFlour ? (i.grams / r.flour) * 100 : clamp((i.pct / maxPct) * 100, 1, 100)}%`,
                        background: i.isFlour
                          ? "color-mix(in oklch, currentColor 30%, transparent)"
                          : i.isWater
                            ? "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 4px)"
                            : "currentColor",
                      }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-muted-foreground">{(i.pct * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Everything is a percentage of the FLOUR, which is what makes two formulas comparable and what lets one be
        scaled to any batch size · flour bars are shares of the blend and read against each other; the rest read
        against the widest ingredient · {slack.name} at {(slack.water * 100).toFixed(0)}% hydration and {stiff.name} at{" "}
        {(stiff.water * 100).toFixed(0)}% are {((slack.water - stiff.water) * 100).toFixed(0)} points apart, which is
        the whole difference in how they handle
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ProofCurve — dough rise over time, with the READY window derived
 * from the rate rather than from the clock. Proof times on a recipe
 * card are written for one temperature and one flour.
 * ------------------------------------------------------------------ */
export function ProofCurve({
  readings,
  targetRise = 1.75,
  height = 190,
  className = "",
}: {
  /** minutes elapsed and the dough's volume as a multiple of its start */
  readings: { minutes: number; rise: number }[]
  /** the multiple at which this dough is ready */
  targetRise?: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!readings.length) return null

  const pts = [...readings].sort((a, b) => a.minutes - b.minutes)
  const rates = pts.map((p, i) => {
    const prev = pts[i - 1]
    return prev ? (p.rise - prev.rise) / Math.max(p.minutes - prev.minutes, 1e-9) : 0
  })
  const peakRate = Math.max(...rates)
  const peakAt = pts[rates.indexOf(peakRate)]
  // the moment the curve crosses the target, interpolated
  let readyAt: number | null = null
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].rise >= targetRise && pts[i - 1].rise < targetRise) {
      const a = pts[i - 1]
      const b = pts[i]
      readyAt = a.minutes + ((targetRise - a.rise) * (b.minutes - a.minutes)) / Math.max(b.rise - a.rise, 1e-9)
      break
    }
  }
  // the window is where the rate has slowed but the dough has not collapsed
  const slowing = pts.findIndex((_, i) => i > rates.indexOf(peakRate) && rates[i] < peakRate * 0.3)
  const maxRise = Math.max(targetRise * 1.1, ...pts.map((p) => p.rise))
  const px = (m: number) => (m / Math.max(pts[pts.length - 1].minutes, 1e-9)) * 100
  const py = (r: number) => 100 - ((r - 1) / Math.max(maxRise - 1, 1e-9)) * 94 - 3

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {readyAt !== null && slowing > 0 && (
            <rect x={px(readyAt)} y={0} width={Math.max(0, px(pts[slowing].minutes) - px(readyAt))} height={100} fill="currentColor" opacity={0.13} />
          )}
          <line x1={0} y1={py(targetRise)} x2={100} y2={py(targetRise)} stroke="currentColor" strokeWidth={0.9} strokeDasharray="4 2" />
          <polyline points={pts.map((p) => `${px(p.minutes)},${py(p.rise)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute right-1 -translate-y-1/2 bg-background px-0.5 text-[9px] tabular-nums text-muted-foreground" style={{ top: `${py(targetRise)}%` }}>
          ready ×{targetRise}
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 min</span>
        <span>{pts[pts.length - 1].minutes} min</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Ready at</dt>
          <dd className="font-medium tabular-nums">{readyAt === null ? "not reached" : `${readyAt.toFixed(0)} min`}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fastest</dt>
          <dd className="font-medium tabular-nums">{peakAt?.minutes ?? 0} min</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Window</dt>
          <dd className="font-medium tabular-nums">
            {readyAt !== null && slowing > 0 ? `${(pts[slowing].minutes - readyAt).toFixed(0)} min` : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The shaded band is the WINDOW — from the moment the dough reaches ×{targetRise} to the moment its rate falls
        below a third of peak, which is the useful definition of ready and one a clock cannot give ·{" "}
        {readyAt === null
          ? "this dough never reached the target in the time observed"
          : `it opens at ${readyAt.toFixed(0)} minutes${slowing > 0 ? ` and lasts ${(pts[slowing].minutes - readyAt).toFixed(0)}` : ""}`}{" "}
        · a recipe's proof time is written for one temperature and one flour, and is the first thing to be wrong in
        somebody else's kitchen
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * OvenLoad — the deck schedule. The constraint is DECK SPACE against
 * time, and a bake list in trays cannot show where the oven is the
 * bottleneck.
 * ------------------------------------------------------------------ */
export function OvenLoad({
  bakes,
  decks,
  openMinute,
  closeMinute,
  className = "",
}: {
  /** each bake's start, duration and how many decks it occupies */
  bakes: { name: string; startMinute: number; minutes: number; decks: number }[]
  /** how many decks the oven has */
  decks: number
  openMinute: number
  closeMinute: number
  className?: string
}) {
  const span = Math.max(closeMinute - openMinute, 1)
  const px = (m: number) => ((m - openMinute) / span) * 100
  const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`
  // deck-minutes used per five-minute slot, which is where the clash is
  const slots = Array.from({ length: Math.ceil(span / 5) }, (_, i) => {
    const at = openMinute + i * 5
    const used = bakes.filter((b) => at >= b.startMinute && at < b.startMinute + b.minutes).reduce((a, b) => a + b.decks, 0)
    return { at, used, over: used > decks }
  })
  const clashes = slots.filter((s) => s.over)
  const utilisation = slots.reduce((a, s) => a + Math.min(s.used, decks), 0) / Math.max(slots.length * decks, 1)
  const peak = Math.max(decks, ...slots.map((s) => s.used))
  const sorted = [...bakes].sort((a, b) => a.startMinute - b.startMinute)

  return (
    <div className={className}>
      <ul className="space-y-1">
        {sorted.map((b) => (
          <li key={b.name} className="flex items-center gap-2 text-[10px]">
            <span className="w-24 shrink-0 truncate">{b.name}</span>
            <div className="relative h-3.5 flex-1 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px] bg-foreground/65"
                style={{ left: `${clamp(px(b.startMinute), 0, 100)}%`, width: `${clamp(px(b.startMinute + b.minutes) - px(b.startMinute), 0.5, 100)}%` }}
                title={`${clock(b.startMinute)}–${clock(b.startMinute + b.minutes)} · ${b.decks} deck${b.decks === 1 ? "" : "s"}`}
              />
            </div>
            <span className="w-20 shrink-0 text-right tabular-nums text-muted-foreground">
              {b.minutes}′ · {b.decks} deck{b.decks === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>
      {/* the derived half: decks in use, and where it exceeds the oven */}
      <div className="relative mt-2 flex items-stretch gap-px rounded-[2px] border border-foreground/15" style={{ height: 46 }}>
        {slots.map((s) => (
          <div key={s.at} className="relative min-w-0 flex-1" title={`${clock(s.at)}: ${s.used} of ${decks} decks`}>
            <div
              className="absolute inset-x-0 bottom-0"
              style={{
                height: `${(s.used / peak) * 100}%`,
                background: s.over
                  ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)"
                  : "color-mix(in oklch, currentColor 55%, transparent)",
                outline: s.over ? "1px solid currentColor" : undefined,
                outlineOffset: -1,
              }}
            />
          </div>
        ))}
        <span className="pointer-events-none absolute inset-x-0 border-t border-foreground/60" style={{ bottom: `${(decks / peak) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{clock(openMinute)}</span>
        <span>line: {decks} decks</span>
        <span>{clock(closeMinute)}</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The lower strip is decks IN USE, derived by overlaying the bakes — a list of trays and times cannot show where
        two things want the same oven · {(utilisation * 100).toFixed(0)}% of the oven's deck-hours are used, and{" "}
        {clashes.length === 0
          ? "nothing exceeds the deck count"
          : `${(clashes.length * 5)} minutes are over it, from ${clock(clashes[0].at)}, which is where something waits or comes out pale`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * WastageLadder — baked against sold, by line, with the cost of the
 * unsold derived. Sell-through alone treats a slow expensive line and
 * a slow cheap one as the same problem.
 * ------------------------------------------------------------------ */
export function WastageLadder({
  lines,
  className = "",
}: {
  lines: { name: string; baked: number; sold: number; costEach: number; priceEach: number }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!lines.length) return null

  const rows = lines
    .map((l) => {
      const unsold = Math.max(0, l.baked - l.sold)
      return {
        ...l,
        unsold,
        sellThrough: l.sold / Math.max(l.baked, 1),
        wasteCost: unsold * l.costEach,
        margin: l.sold * (l.priceEach - l.costEach) - unsold * l.costEach,
        // baking fewer would have earned more if the waste exceeds the margin
        shouldCut: unsold * l.costEach > l.sold * (l.priceEach - l.costEach) * 0.25,
      }
    })
    .sort((a, b) => b.wasteCost - a.wasteCost)
  const totalWaste = rows.reduce((a, r) => a + r.wasteCost, 0)
  const totalMargin = rows.reduce((a, r) => a + r.margin, 0)
  const maxSpend = Math.max(1, ...rows.map((r) => r.baked * r.costEach))
  const worstRate = rows.reduce((a, r) => (r.sellThrough < a.sellThrough ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.sold} of {r.baked} · {(r.sellThrough * 100).toFixed(0)}% sold
              </span>
            </div>
            {/* one shared scale across rows: normalising each row to its own total
                makes every bar the same length and the ranking unreadable */}
            <div className="mt-0.5 flex h-4 gap-px rounded-[2px] bg-muted">
              <div
                className="rounded-l-[2px] bg-foreground/30"
                style={{ width: `${((r.sold * r.costEach) / maxSpend) * 100}%` }}
                title={`sold: ${money(r.sold * r.costEach)} of cost recovered`}
              />
              <div
                className="rounded-r-[2px]"
                style={{
                  width: `${(r.wasteCost / maxSpend) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: "1px solid currentColor",
                  outlineOffset: -1,
                }}
                title={`wasted: ${money(r.wasteCost)}`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.unsold} unsold, {money(r.wasteCost)} of ingredients · net {money(r.margin)}
              {r.shouldCut ? " — bake fewer" : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched is what was baked and not sold, priced at COST — {money(totalWaste)} against {money(totalMargin)} of
        net margin, which is {((totalWaste / Math.max(totalMargin + totalWaste, 1e-9)) * 100).toFixed(0)}% of the
        gross · bars are ingredient spend on ONE scale, pale recovered by a sale and hatched thrown away ·
        sell-through alone ranks {worstRate.name} worst at {(worstRate.sellThrough * 100).toFixed(0)}%, and{" "}
        {rows[0].name} costs more to waste · the answer to a bad line is usually to bake fewer, not to sell harder
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DoughTemp — the water temperature needed to hit a target dough
 * temperature. Every bakery has this as a rule of thumb; the friction
 * factor is what makes it a rule for THIS mixer.
 * ------------------------------------------------------------------ */
export function DoughTemp({
  days,
  targetC,
  frictionC,
  className = "",
}: {
  /** the measured room, flour and preferment temperatures on each day */
  days: { label: string; roomC: number; flourC: number; prefermentC?: number; achievedC?: number }[]
  targetC: number
  /** the heat this mixer adds, measured rather than assumed */
  frictionC: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!days.length) return null

  const rows = days.map((d) => {
    const factors = d.prefermentC === undefined ? 3 : 4
    const known = d.roomC + d.flourC + (d.prefermentC ?? 0) + frictionC
    const waterC = targetC * factors - known
    const miss = d.achievedC === undefined ? null : d.achievedC - targetC
    return { ...d, factors, waterC, miss }
  })
  const lo = Math.min(...rows.map((r) => r.waterC))
  const hi = Math.max(...rows.map((r) => r.waterC))
  const needsIce = rows.filter((r) => r.waterC < 4)
  const measured = rows.filter((r) => r.miss !== null)
  const meanMiss = measured.length ? measured.reduce((a, r) => a + Math.abs(r.miss!), 0) / measured.length : null

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                room {r.roomC}° · flour {r.flourC}°{r.prefermentC !== undefined ? ` · levain ${r.prefermentC}°` : ""}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${clamp(((r.waterC - Math.min(lo, 0)) / Math.max(hi - Math.min(lo, 0), 1e-9)) * 100, 2, 100)}%`,
                  background: r.waterC < 4 ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 55%, transparent)",
                  outline: r.waterC < 4 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`water ${r.waterC.toFixed(1)}°C`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              water {r.waterC.toFixed(1)}°C for a {targetC}°C dough
              {r.waterC < 4 ? " — ice needed" : ""}
              {r.miss !== null ? ` · came out ${r.achievedC}°, ${r.miss >= 0 ? "+" : ""}${r.miss.toFixed(1)}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Water temperature is DERIVED — target times the number of factors, minus room, flour
        {rows[0].prefermentC !== undefined ? ", levain" : ""} and the {frictionC}°C this mixer adds ·{" "}
        {needsIce.length > 0
          ? `${needsIce.length} of ${rows.length} days call for water below 4°C, which means ice by weight rather than a colder tap`
          : "no day calls for iced water"}
        {meanMiss !== null ? ` · the finished dough missed by ${meanMiss.toFixed(1)}°C on average, which is the friction factor asking to be re-measured` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * StalingCurve — crumb firmness over days against the point it stops
 * being saleable. Best-before is a printed date; the curve is what
 * the bread does.
 * ------------------------------------------------------------------ */
export function StalingCurve({
  products,
  saleableFirmness,
  height = 190,
  className = "",
}: {
  /** crumb firmness in newtons on each day after baking */
  products: { name: string; firmness: { day: number; n: number }[]; statedDays?: number }[]
  /** the firmness above which a customer will not buy it */
  saleableFirmness: number
  height?: number
  className?: string
}) {
  // NOTHING TO DRAW IS NOT A CHART OF NOTHING. An empty array made every
  // scale here degenerate and wrote NaN into an SVG attribute, which the
  // browser drops — so the chart rendered as a blank box rather than as the
  // empty state the page around it is showing. `useRows` hands back `[]`
  // before the query settles and on every site whose owner has added nothing.
  if (!products.length) return null

  const rows = products.map((p) => {
    const pts = [...p.firmness].sort((a, b) => a.day - b.day)
    let crossed: number | null = null
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].n >= saleableFirmness && pts[i - 1].n < saleableFirmness) {
        const a = pts[i - 1]
        const b = pts[i]
        crossed = a.day + ((saleableFirmness - a.n) * (b.day - a.day)) / Math.max(b.n - a.n, 1e-9)
        break
      }
    }
    return { ...p, pts, crossed, overstated: p.statedDays !== undefined && crossed !== null && p.statedDays > crossed }
  })
  const maxDay = Math.max(...rows.flatMap((r) => r.pts.map((p) => p.day)))
  const maxN = Math.max(saleableFirmness * 1.15, ...rows.flatMap((r) => r.pts.map((p) => p.n)))
  const px = (d: number) => (d / Math.max(maxDay, 1e-9)) * 100
  const py = (n: number) => 100 - (n / maxN) * 94 - 3
  const dashes = ["none", "5 2", "2 2", "6 2 2 2"]
  const overstated = rows.filter((r) => r.overstated)

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(saleableFirmness)} x2={100} y2={py(saleableFirmness)} stroke="currentColor" strokeWidth={1} strokeDasharray="4 2" />
          {rows.map((r, i) => (
            <polyline
              key={r.name}
              points={r.pts.map((p) => `${px(p.day)},${py(p.n)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray={dashes[i % dashes.length]}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <span className="absolute right-1 -translate-y-1/2 bg-background px-0.5 text-[9px] tabular-nums text-muted-foreground" style={{ top: `${py(saleableFirmness)}%` }}>
          unsaleable
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>day 0</span>
        <span>day {maxDay}</span>
      </div>
      <ul className="mt-2 space-y-1 text-[10px] tabular-nums">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-2">
            <svg width="22" height="6" className="shrink-0" aria-hidden>
              <line x1={0} y1={3} x2={22} y2={3} stroke="currentColor" strokeWidth={1.5} strokeDasharray={dashes[i % dashes.length]} />
            </svg>
            <span className="w-32 shrink-0 truncate">{r.name}</span>
            <span className="text-muted-foreground">
              {r.crossed === null ? `still saleable at day ${maxDay}` : `stales at day ${r.crossed.toFixed(1)}`}
              {r.statedDays !== undefined ? ` · printed ${r.statedDays} d${r.overstated ? " — overstated" : ""}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The crossing is INTERPOLATED from the firmness readings, so it is a measured shelf life rather than a printed
        one ·{" "}
        {overstated.length === 0
          ? "every printed date sits inside what the crumb actually does"
          : `${overstated.map((r) => r.name).join(" and ")} ${overstated.length === 1 ? "is" : "are"} sold with a date past the point the crumb goes, which is a return waiting to happen`}{" "}
        · staling is starch retrogradation and it happens fastest in the fridge, which is where customers put it
      </p>
    </div>
  )
}
