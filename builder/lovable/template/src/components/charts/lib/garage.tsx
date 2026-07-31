/**
 * Vehicle repair and MOT primitives — bay hours, MOT failure items, the
 * efficiency/productivity pair, parts margin after discount, comebacks and
 * the courtesy fleet.
 *
 * What a bay actually earned against what it could, which failures were
 * advisories somebody chose to ignore, the two different numbers a garage
 * calls "efficiency", the margin that survives trade discount, what rework
 * costs in bay hours and how many jobs waited for a car are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
const money = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e4 ? `£${(a / 1e3).toFixed(1)}k` : a < 10 ? `£${a.toFixed(2)}` : `£${Math.round(a).toLocaleString("en-GB")}`
  return v < 0 ? `−${s}` : s
}

/* ------------------------------------------------------------------ *
 * BayUtilisation — bays hour by hour, with the KNOCK-ON derived. A bay
 * booked solid is not a bay earning solid: a job that overruns pushes
 * the next one, and the overrun is visible while the pushed job simply
 * never appears anywhere.
 * ------------------------------------------------------------------ */
export function BayUtilisation({
  bays,
  hours,
  labourRate,
  className = "",
}: {
  /** one entry per bay; `booked[i]` and `actual[i]` are hours worked in hour i */
  bays: { name: string; booked: number[]; actual: number[] }[]
  hours: string[]
  labourRate: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!bays.length || !hours.length) return null

  const rows = bays.map((b) => {
    // named apart from `booked`/`actual`, which are the per-hour ARRAYS — a
    // spread happily replaces an array with a scalar of the same name and the
    // only sign of it is an index expression further down
    const bookedHours = b.booked.reduce((a, v) => a + v, 0)
    const actualHours = b.actual.reduce((a, v) => a + v, 0)
    // hours the bay was open and doing nothing, and hours it ran past its book
    const idle = b.booked.reduce((a, v, i) => a + Math.max(0, 1 - Math.max(v, b.actual[i])), 0)
    const over = b.booked.reduce((a, v, i) => a + Math.max(0, b.actual[i] - v), 0)
    return { ...b, bookedHours, actualHours, idle, over, utilisation: actualHours / Math.max(hours.length, 1) }
  })
  const totalIdle = rows.reduce((a, r) => a + r.idle, 0)
  const totalOver = rows.reduce((a, r) => a + r.over, 0)
  const totalActual = rows.reduce((a, r) => a + r.actualHours, 0)
  const capacity = rows.length * hours.length
  const worstIdle = rows.reduce((a, r) => (r.idle > a.idle ? r : a), rows[0])
  const worstOver = rows.reduce((a, r) => (r.over > a.over ? r : a), rows[0])

  return (
    <div className={className}>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2">
            <span className="w-16 shrink-0 truncate text-[10px]">{r.name}</span>
            <div className="flex flex-1 items-stretch gap-px" style={{ height: 22 }}>
              {hours.map((h, i) => {
                const bk = r.booked[i] ?? 0
                const ac = r.actual[i] ?? 0
                return (
                  <div key={h} className="relative min-w-0 flex-1 rounded-[1px] bg-muted" title={`${r.name} ${h}: booked ${(bk * 60).toFixed(0)} min, worked ${(ac * 60).toFixed(0)} min`}>
                    <div className="absolute inset-x-0 bottom-0 rounded-[1px] bg-foreground/45" style={{ height: `${clamp(ac * 100, 0, 100)}%` }} />
                    {ac > bk && (
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-[1px]"
                        style={{ height: `${clamp(ac * 100, 0, 100)}%`, background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 4px)", outline: "1px solid currentColor", outlineOffset: -1 }}
                      />
                    )}
                    <span className="absolute inset-x-0 border-t border-foreground/70" style={{ bottom: `${clamp(bk * 100, 0, 100)}%` }} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex gap-px pl-[4.5rem] text-[9px] text-muted-foreground">
        {hours.map((h, i) => (
          <span key={h} className="min-w-0 flex-1 truncate text-center">
            {i % 2 === 0 ? h : ""}
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Utilisation</dt>
          <dd className="font-medium tabular-nums">{((totalActual / Math.max(capacity, 1)) * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Idle</dt>
          <dd className="font-medium tabular-nums">{totalIdle.toFixed(1)} h</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Overrun</dt>
          <dd className="font-medium tabular-nums">{totalOver.toFixed(1)} h</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Idle at rate</dt>
          <dd className="font-medium tabular-nums">{money(totalIdle * labourRate)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The rule on each hour is what was BOOKED and the fill is what was WORKED, so a hatched hour is a job running
        past its estimate and pushing whatever came next · {totalActual.toFixed(1)} of {capacity} bay-hours were
        worked, {totalIdle.toFixed(1)} sat empty at {money(totalIdle * labourRate)} of labour, and{" "}
        {totalOver.toFixed(1)} ran over ·{" "}
        {worstIdle.name === worstOver.name
          ? `${worstIdle.name} has both the most idle and the most overrun, which is an estimating problem rather than a demand one`
          : `${worstIdle.name} is idlest and ${worstOver.name} overruns most — moving work between them costs nothing`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * MotFailItems — failures by item with the PREVENTABLE share derived.
 * A failure list is read as a workload; the useful split is how many
 * of them were advisories at the last test, because those were a
 * conversation the garage already had and did not close.
 * ------------------------------------------------------------------ */
export function MotFailItems({
  items,
  testsInPeriod,
  className = "",
}: {
  items: { name: string; failures: number; wasAdvisory: number; meanRepair: number }[]
  testsInPeriod: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!items.length) return null

  const rows = items
    .map((i) => ({
      ...i,
      rate: i.failures / Math.max(testsInPeriod, 1),
      preventable: i.wasAdvisory / Math.max(i.failures, 1),
      value: i.failures * i.meanRepair,
      missedValue: i.wasAdvisory * i.meanRepair,
    }))
    .sort((a, b) => b.failures - a.failures)
  const max = Math.max(...rows.map((r) => r.failures), 1)
  const failures = rows.reduce((a, r) => a + r.failures, 0)
  const advisory = rows.reduce((a, r) => a + r.wasAdvisory, 0)
  const missed = rows.reduce((a, r) => a + r.missedValue, 0)
  const value = rows.reduce((a, r) => a + r.value, 0)
  const mostPreventable = rows.reduce((a, r) => (r.preventable > a.preventable ? r : a), rows[0])
  const failRate = failures / Math.max(testsInPeriod, 1)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.failures} fails · {(r.rate * 100).toFixed(1)}% of tests · {money(r.meanRepair)} to put right
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/45" style={{ width: `${(r.failures / max) * 100}%` }} title={`${r.failures} failures`} />
              <div
                className="absolute inset-y-0 rounded-l-[2px]"
                style={{
                  width: `${(r.wasAdvisory / max) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)",
                  outline: r.wasAdvisory > 0 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`${r.wasAdvisory} were advisories at the last test`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.wasAdvisory} of {r.failures} ({(r.preventable * 100).toFixed(0)}%) were advised last time ·{" "}
              {money(r.missedValue)} of work the customer was already told about
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The hatched part of each bar was an ADVISORY at the previous test, which makes it a conversation that already
        happened rather than a fault that appeared · {advisory} of {failures} failures were flagged a year ago —{" "}
        {((advisory / Math.max(failures, 1)) * 100).toFixed(0)}%, worth {money(missed)} of the {money(value)} on this
        list · {mostPreventable.name} is the worst at {(mostPreventable.preventable * 100).toFixed(0)}% ·{" "}
        {(failRate * 100).toFixed(0)} failures per hundred tests is the workload; the hatch is the part a reminder
        letter would have converted at a calmer moment for everybody
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * TechnicianEfficiency — the two numbers a garage confuses. PRODUCTIVITY
 * is clocked-on hours against hours attended, EFFICIENCY is hours sold
 * against hours clocked on. A technician can be 100% productive and 60%
 * efficient, and the fix for each is the opposite of the other.
 * ------------------------------------------------------------------ */
export function TechnicianEfficiency({
  technicians,
  labourRate,
  className = "",
}: {
  technicians: { name: string; attendedHours: number; clockedHours: number; soldHours: number }[]
  labourRate: number
  className?: string
}) {
  const rows = technicians
    .map((t) => {
      const productivity = t.clockedHours / Math.max(t.attendedHours, 1e-9)
      const efficiency = t.soldHours / Math.max(t.clockedHours, 1e-9)
      return {
        ...t,
        productivity,
        efficiency,
        // the product is what the business actually gets, and it is the number
        // nobody quotes because it is always lower than either
        overall: t.soldHours / Math.max(t.attendedHours, 1e-9),
        lostToIdle: t.attendedHours - t.clockedHours,
        lostToPace: t.clockedHours - t.soldHours,
      }
    })
    .sort((a, b) => b.overall - a.overall)
  const scale = Math.max(1.2, ...rows.map((r) => Math.max(r.productivity, r.efficiency)))
  const idle = rows.reduce((a, r) => a + r.lostToIdle, 0)
  const pace = rows.reduce((a, r) => a + Math.max(0, r.lostToPace), 0)
  const overtime = rows.reduce((a, r) => a + Math.max(0, -r.lostToPace), 0)
  const idleLed = rows.filter((r) => r.lostToIdle > Math.max(0, r.lostToPace))

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.attendedHours.toFixed(0)} attended → {r.clockedHours.toFixed(0)} clocked →{" "}
                {r.soldHours.toFixed(0)} sold
              </span>
            </div>
            {/* the two rates on separate rows, because the whole point is that
                they move independently and a single bar implies they do not */}
            <div className="mt-0.5 space-y-px">
              <div className="relative h-2.5 rounded-[1px] bg-muted">
                <div className="absolute inset-y-0 rounded-[1px] bg-foreground/30" style={{ width: `${clamp((r.productivity / scale) * 100, 0, 100)}%` }} title={`productivity ${(r.productivity * 100).toFixed(0)}%`} />
                <span className="absolute inset-y-0 w-px bg-foreground/60" style={{ left: `${clamp((1 / scale) * 100, 0, 100)}%` }} />
              </div>
              <div className="relative h-2.5 rounded-[1px] bg-muted">
                <div className="absolute inset-y-0 rounded-[1px] bg-foreground/70" style={{ width: `${clamp((r.efficiency / scale) * 100, 0, 100)}%` }} title={`efficiency ${(r.efficiency * 100).toFixed(0)}%`} />
                <span className="absolute inset-y-0 w-px bg-foreground/60" style={{ left: `${clamp((1 / scale) * 100, 0, 100)}%` }} />
              </div>
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              productive {(r.productivity * 100).toFixed(0)}% · efficient {(r.efficiency * 100).toFixed(0)}% ·{" "}
              <span className="font-medium text-foreground/70">{(r.overall * 100).toFixed(0)}% overall</span> ·{" "}
              {r.lostToIdle.toFixed(1)} h off the clock,{" "}
              {r.lostToPace >= 0 ? `${r.lostToPace.toFixed(1)} h slower than sold` : `${(-r.lostToPace).toFixed(1)} h faster than sold`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Two different numbers, both called efficiency: the pale bar is PRODUCTIVITY (clocked on against attended,
        i.e. whether there was work) and the solid one is EFFICIENCY (sold against clocked, i.e. whether the job beat
        its book time). The tick is 100% · {idle.toFixed(1)} hours were lost off the clock at{" "}
        {money(idle * labourRate)}, and {pace.toFixed(1)} hours were spent beyond what the book paid for
        {overtime > 0 ? `, against ${overtime.toFixed(1)} hours beaten on other jobs` : ""} ·{" "}
        {idleLed.length === 0
          ? "every technician loses more to pace than to idle time, which is a book-time and training question"
          : `${idleLed.length} of ${rows.length} lose more to IDLE than to pace, which is a booking problem and no amount of working faster fixes it`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PartsMargin — parts by band with the REALISED margin derived. A parts
 * price list has a markup on it and a trade discount comes off the
 * other end, so the margin the accounts show is neither the one on the
 * list nor the one anybody quotes.
 * ------------------------------------------------------------------ */
export function PartsMargin({
  bands,
  className = "",
}: {
  bands: { name: string; lines: number; cost: number; listPrice: number; discountGiven: number }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!bands.length) return null

  const rows = bands
    .map((b) => {
      const sold = b.listPrice * (1 - b.discountGiven)
      const listMargin = (b.listPrice - b.cost) / Math.max(b.listPrice, 1e-9)
      const realMargin = (sold - b.cost) / Math.max(sold, 1e-9)
      return {
        ...b,
        sold,
        listMargin,
        realMargin,
        gap: listMargin - realMargin,
        cash: (sold - b.cost) * b.lines,
        givenAway: (b.listPrice - sold) * b.lines,
      }
    })
    .sort((a, b) => b.cash - a.cash)
  const cash = rows.reduce((a, r) => a + r.cash, 0)
  const givenAway = rows.reduce((a, r) => a + r.givenAway, 0)
  const scale = Math.max(...rows.map((r) => r.listMargin), 0.1)
  const negative = rows.filter((r) => r.realMargin < 0)
  const worstGap = rows.reduce((a, r) => (r.gap > a.gap ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.lines} lines · {money(r.cost)} cost · {money(r.listPrice)} list · −
                {(r.discountGiven * 100).toFixed(0)}%
              </span>
            </div>
            <div className="relative mt-0.5 h-5 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/22" style={{ width: `${clamp((r.listMargin / scale) * 100, 0, 100)}%` }} title={`list margin ${(r.listMargin * 100).toFixed(0)}%`} />
              {/* a band sold BELOW cost clamps to zero width and disappears
                  entirely — which is the one row anybody needs to find */}
              {r.realMargin >= 0 ? (
                <div className="absolute inset-y-0 rounded-[2px] bg-foreground/65" style={{ width: `${clamp((r.realMargin / scale) * 100, 0, 100)}%` }} title={`realised margin ${(r.realMargin * 100).toFixed(0)}%`} />
              ) : (
                <div
                  className="absolute inset-y-0 left-0 rounded-[2px]"
                  style={{
                    width: `${clamp((Math.abs(r.realMargin) / scale) * 100, 6, 100)}%`,
                    background: "repeating-linear-gradient(45deg, currentColor 0 2px, transparent 2px 4px)",
                    outline: "1px solid currentColor",
                    outlineOffset: -1,
                  }}
                  title={`sold BELOW cost: ${(r.realMargin * 100).toFixed(0)}%`}
                />
              )}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.listMargin * 100).toFixed(0)}% on the list becomes {(r.realMargin * 100).toFixed(0)}% realised ·{" "}
              {money(r.cash)} of cash margin, {money(r.givenAway)} discounted away
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The pale bar is the margin on the PRICE LIST and the solid one is what survived the discount — a percentage
        off the top is not a percentage off the margin, and on a thin band it is most of it · {money(cash)} of cash
        margin was made and {money(givenAway)} was handed over at the counter · {worstGap.name} loses the most,{" "}
        {(worstGap.gap * 100).toFixed(0)} points from list to realised
        {negative.length > 0 ? ` · ${negative.length} ${plural(negative.length, "band is", "bands are")} sold BELOW cost after discount, which no volume fixes` : " · no band goes below cost, which is the least a discount policy should guarantee"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ComebackRate — jobs returning within a window, with the REAL cost
 * derived in bay hours. A comeback is recorded as a warranty claim
 * worth nothing; it actually costs the bay hour twice, plus the slot
 * the returning car took from a paying job.
 * ------------------------------------------------------------------ */
export function ComebackRate({
  categories,
  windowDays,
  labourRate,
  className = "",
}: {
  categories: { name: string; jobs: number; comebacks: number; meanReworkHours: number }[]
  windowDays: number
  labourRate: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!categories.length) return null

  const rows = categories
    .map((c) => {
      const rate = c.comebacks / Math.max(c.jobs, 1)
      const hours = c.comebacks * c.meanReworkHours
      return {
        ...c,
        rate,
        hours,
        // the rework hour is lost twice: once given away, once not sold
        cost: hours * labourRate * 2,
      }
    })
    .sort((a, b) => b.rate - a.rate)
  const maxRate = Math.max(...rows.map((r) => r.rate), 0.01)
  const jobs = rows.reduce((a, r) => a + r.jobs, 0)
  const comebacks = rows.reduce((a, r) => a + r.comebacks, 0)
  const hours = rows.reduce((a, r) => a + r.hours, 0)
  const cost = rows.reduce((a, r) => a + r.cost, 0)
  const overall = comebacks / Math.max(jobs, 1)
  const costliest = rows.reduce((a, r) => (r.cost > a.cost ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.comebacks} of {r.jobs} · {(r.rate * 100).toFixed(1)}% · {r.meanReworkHours.toFixed(1)} h each
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px]"
                style={{
                  width: `${clamp((r.rate / maxRate) * 100, 1, 100)}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)",
                  outline: "1px solid currentColor",
                  outlineOffset: -1,
                }}
                title={`${(r.rate * 100).toFixed(1)}% comeback rate`}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${clamp((overall / maxRate) * 100, 0, 99)}%` }} title={`garage average ${(overall * 100).toFixed(1)}%`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.hours.toFixed(1)} bay-hours of rework · {money(r.cost)} counting the hour given away and the hour
              never sold
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A comeback inside {windowDays} days is recorded as a warranty job worth nothing, and it costs the bay hour
        TWICE — once put right for free and once not available to anybody else · {comebacks} of {jobs} jobs came back
        ({(overall * 100).toFixed(1)}%), {hours.toFixed(1)} bay-hours at {money(cost)} · {costliest.name} costs the
        most at {money(costliest.cost)}
        {costliest.name !== rows[0].name ? `, though ${rows[0].name} has the highest rate — a long job coming back beats a short one coming back often` : ", and it also has the highest rate"}{" "}
        · the mark is the garage average, which is the only comparison a category has
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CourtesyFleet — courtesy cars against the jobs that needed one, with
 * the DELAY derived. A fleet is sized by what it costs; what it is
 * worth is the jobs that would otherwise have waited, and those never
 * appear in a booking system because they were simply booked later.
 * ------------------------------------------------------------------ */
export function CourtesyFleet({
  days,
  fleetSize,
  jobValue,
  carCostPerDay,
  className = "",
}: {
  days: { label: string; requested: number }[]
  fleetSize: number
  /** the gross profit on a job that had to wait */
  jobValue: number
  carCostPerDay: number
  className?: string
}) {
  const rows = days.map((d) => {
    const served = Math.min(d.requested, fleetSize)
    return { ...d, served, turned: Math.max(0, d.requested - fleetSize), spare: Math.max(0, fleetSize - d.requested) }
  })
  const max = Math.max(fleetSize, ...rows.map((r) => r.requested))
  const turned = rows.reduce((a, r) => a + r.turned, 0)
  const spare = rows.reduce((a, r) => a + r.spare, 0)
  const requested = rows.reduce((a, r) => a + r.requested, 0)
  const shortDays = rows.filter((r) => r.turned > 0)
  const fleetCost = fleetSize * days.length * carCostPerDay
  // one more car serves the shortfall on every day that had one, up to a car
  const extraServed = rows.reduce((a, r) => a + Math.min(1, r.turned), 0)
  const extraWorth = extraServed * jobValue - days.length * carCostPerDay

  return (
    <div className={className}>
      <div className="relative flex items-stretch gap-px rounded-[2px] border border-foreground/15" style={{ height: 130 }}>
        {rows.map((r) => (
          <div key={r.label} className="relative min-w-0 flex-1" title={`${r.label}: ${r.requested} asked, ${r.served} served, ${r.turned} waited`}>
            <div className="absolute inset-x-0 bottom-0 bg-foreground/40" style={{ height: `${(r.served / max) * 100}%` }} />
            <div
              className="absolute inset-x-0"
              style={{
                bottom: `${(r.served / max) * 100}%`,
                height: `${(r.turned / max) * 100}%`,
                background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)",
                outline: r.turned > 0 ? "1px solid currentColor" : undefined,
                outlineOffset: -1,
              }}
            />
          </div>
        ))}
        <span className="absolute inset-x-0 border-t-2 border-foreground/75" style={{ bottom: `${(fleetSize / max) * 100}%` }} title={`fleet of ${fleetSize}`} />
      </div>
      <div className="mt-0.5 flex gap-px text-[9px] text-muted-foreground">
        {rows.map((r, i) => (
          <span key={r.label} className="min-w-0 flex-1 truncate text-center">
            {i % 2 === 0 ? r.label : ""}
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Turned away</dt>
          <dd className="font-medium tabular-nums">{turned}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Days short</dt>
          <dd className="font-medium tabular-nums">
            {shortDays.length}/{rows.length}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Car-days spare</dt>
          <dd className="font-medium tabular-nums">{spare}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fleet cost</dt>
          <dd className="font-medium tabular-nums">{money(fleetCost)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The rule is the fleet of {fleetSize} and the hatch above it is jobs that WAITED — which never show up as lost
        work, because they were simply booked for another week · {turned} of {requested} requests went unserved
        across {shortDays.length} short {plural(shortDays.length, "day", "days")}, while {spare} car-days sat on the
        forecourt · one more car would have served {extraServed} of them, {money(extraServed * jobValue)} of gross
        profit against {money(days.length * carCostPerDay)} to run it —{" "}
        {extraWorth > 0 ? `${money(extraWorth)} better off` : `${money(-extraWorth)} worse off, so the fleet is the right size`}
      </p>
    </div>
  )
}
