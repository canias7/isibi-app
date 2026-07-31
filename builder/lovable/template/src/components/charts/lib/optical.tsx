/**
 * Optometry primitives — prescription drift, the dispense rate, frame margin
 * against stock turn, recall due, lens options and myopia control.
 *
 * Whether a prescription is genuinely moving or wandering inside measurement
 * error, which tests turn into a dispense, the frames that earn against the
 * frames that sit, the recall month that actually converts, what an option
 * adds to a dispense and whether a control lens is working are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
const money = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e4 ? `£${(a / 1e3).toFixed(1)}k` : a < 10 ? `£${a.toFixed(2)}` : `£${Math.round(a).toLocaleString("en-GB")}`
  return v < 0 ? `−${s}` : s
}
const dpt = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`

/* ------------------------------------------------------------------ *
 * PrescriptionDrift — successive prescriptions against MEASUREMENT
 * ERROR. Every refraction is repeatable to about a quarter of a
 * dioptre, so a 0.25 change between two tests is noise; drawing the
 * band is what separates a real shift from a different chair.
 * ------------------------------------------------------------------ */
export function PrescriptionDrift({
  tests,
  repeatabilityDpt = 0.25,
  className = "",
}: {
  /** oldest first; sphere in dioptres, negative for myopia */
  tests: { date: string; sphere: number; cylinder: number }[]
  /** how repeatable a refraction is — anything inside this is noise */
  repeatabilityDpt?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!tests.length) return null

  const spheres = tests.map((t) => t.sphere)
  const lo = Math.min(...spheres) - repeatabilityDpt * 3
  const hi = Math.max(...spheres) + repeatabilityDpt * 3
  const y = (v: number) => 100 - ((v - lo) / Math.max(hi - lo, 1e-9)) * 100
  const x = (i: number) => (i / Math.max(tests.length - 1, 1)) * 100
  const steps = tests.slice(1).map((t, i) => ({
    from: tests[i],
    to: t,
    delta: t.sphere - tests[i].sphere,
    real: Math.abs(t.sphere - tests[i].sphere) > repeatabilityDpt,
  }))
  const realSteps = steps.filter((s) => s.real)
  const total = tests[tests.length - 1].sphere - tests[0].sphere
  const perYear = tests.length > 1 ? total / Math.max(tests.length - 1, 1) : 0
  const cylChange = tests[tests.length - 1].cylinder - tests[0].cylinder

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height: 140 }}>
        {/* the noise band around the FIRST reading, so the eye can see what a
            change has to beat before it means anything */}
        <div
          className="absolute inset-x-0 bg-foreground/8"
          style={{ top: `${clamp(y(tests[0].sphere + repeatabilityDpt), 0, 100)}%`, height: `${Math.max(y(tests[0].sphere - repeatabilityDpt) - y(tests[0].sphere + repeatabilityDpt), 1)}%` }}
          title={`±${repeatabilityDpt.toFixed(2)} D of the first reading is not distinguishable from it`}
        />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polyline points={tests.map((t, i) => `${x(i)},${clamp(y(t.sphere), 0, 100)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
        </svg>
        {tests.map((t, i) => (
          <span
            key={i}
            className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground"
            style={{
              left: `${x(i)}%`,
              top: `${clamp(y(t.sphere), 0, 100)}%`,
              background: i > 0 && steps[i - 1].real ? "currentColor" : "var(--background)",
            }}
            title={`${t.date}: ${dpt(t.sphere)} / ${dpt(t.cylinder)}${i > 0 ? ` — ${steps[i - 1].real ? "a real change" : "inside measurement error"}` : ""}`}
          />
        ))}
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] tabular-nums text-muted-foreground">
        <span>{tests[0].date}</span>
        <span>shaded ±{repeatabilityDpt.toFixed(2)} D is not measurable</span>
        <span>{tests[tests.length - 1].date}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Now</dt>
          <dd className="font-medium tabular-nums">{dpt(tests[tests.length - 1].sphere)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total change</dt>
          <dd className="font-medium tabular-nums">{dpt(total)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Per test</dt>
          <dd className="font-medium tabular-nums">{dpt(perYear)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Real steps</dt>
          <dd className="font-medium tabular-nums">
            {realSteps.length}/{steps.length}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A refraction repeats to about {repeatabilityDpt.toFixed(2)} D, so the band is what a change has to BEAT
        before it is a change at all — hollow points sit inside it and solid ones do not ·{" "}
        {realSteps.length} of {steps.length} {plural(steps.length, "step", "steps")} cleared it, and the sphere has
        moved {dpt(total)} in total ·{" "}
        {realSteps.length === 0
          ? "which means this prescription has not measurably moved, and reissuing it is a choice about lens age rather than about the eye"
          : `so the drift is real, running at ${dpt(perYear)} a test`}{" "}
        · the cylinder has moved {dpt(cylChange)} over the same period
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DispenseRate — tests that became a sale, split by test type, with
 * the VALUE PER TEST derived. A practice measures dispense rate and
 * pays for tests; the two only meet at value per test, which is what
 * decides whether a free eye test scheme is worth running.
 * ------------------------------------------------------------------ */
export function DispenseRate({
  testTypes,
  testCost,
  className = "",
}: {
  testTypes: { name: string; tests: number; dispenses: number; meanDispenseValue: number; feeRecovered?: number }[]
  /** what it costs the practice to put somebody through a test */
  testCost: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!testTypes.length) return null

  const rows = testTypes
    .map((t) => {
      const rate = t.dispenses / Math.max(t.tests, 1)
      const revenue = t.dispenses * t.meanDispenseValue + (t.feeRecovered ?? 0) * t.tests
      const perTest = revenue / Math.max(t.tests, 1)
      return { ...t, rate, revenue, perTest, netPerTest: perTest - testCost }
    })
    .sort((a, b) => b.netPerTest - a.netPerTest)
  const maxNet = Math.max(...rows.map((r) => Math.abs(r.netPerTest)), 1)
  const tests = rows.reduce((a, r) => a + r.tests, 0)
  const dispenses = rows.reduce((a, r) => a + r.dispenses, 0)
  const overall = dispenses / Math.max(tests, 1)
  const revenue = rows.reduce((a, r) => a + r.revenue, 0)
  const loss = rows.filter((r) => r.netPerTest < 0)
  const bestRate = rows.reduce((a, r) => (r.rate > a.rate ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.dispenses} of {r.tests} · {(r.rate * 100).toFixed(0)}% · {money(r.meanDispenseValue)} a dispense
              </span>
            </div>
            {/* a signed bar about a centre line: a test type that loses money
                should point the other way, not simply be short */}
            <div className="relative mt-0.5 h-5 rounded-[2px] bg-muted">
              <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/45" />
              <div
                className="absolute inset-y-0"
                style={{
                  left: r.netPerTest >= 0 ? "50%" : `${50 - (Math.abs(r.netPerTest) / maxNet) * 50}%`,
                  width: `${(Math.abs(r.netPerTest) / maxNet) * 50}%`,
                  background: r.netPerTest >= 0 ? "color-mix(in oklch, currentColor 55%, transparent)" : "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)",
                  outline: r.netPerTest < 0 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`${money(r.netPerTest)} a test after the ${money(testCost)} it costs to run one`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.perTest)} a test gross, {money(r.netPerTest)} after the {money(testCost)} chair cost ·{" "}
              {money(r.revenue)} in total
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is VALUE PER TEST net of the {money(testCost)} it costs to run one, which is the number a dispense
        rate on its own cannot give — a 30% rate on a dear dispense beats a 60% rate on a cheap one ·{" "}
        {(overall * 100).toFixed(0)}% of {tests} tests dispensed, {money(revenue)} in total ·{" "}
        {bestRate.name === rows[0].name
          ? `${rows[0].name} has both the best rate and the best value per test`
          : `${bestRate.name} has the best rate at ${(bestRate.rate * 100).toFixed(0)}% while ${rows[0].name} is worth the most per test — the rate and the money are different questions`}
        {loss.length > 0 ? ` · ${loss.length} ${plural(loss.length, "type loses", "types lose")} money on every test, which is a scheme decision rather than a dispensing one` : " · every type covers its chair cost"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * FrameMargin — frames by price band, with MARGIN AGAINST TURN. A
 * frame board is bought on margin and paid for by turn: a £300 frame
 * at 65% that sells twice a year earns less than a £90 one at 55% that
 * sells monthly, and only one of those is obvious on a price list.
 * ------------------------------------------------------------------ */
export function FrameMargin({
  bands,
  className = "",
}: {
  bands: { name: string; framesOnBoard: number; cost: number; retail: number; soldPerYear: number }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!bands.length) return null

  const rows = bands
    .map((b) => {
      const unitMargin = b.retail - b.cost
      const turn = b.soldPerYear / Math.max(b.framesOnBoard, 1)
      return {
        ...b,
        unitMargin,
        marginRate: unitMargin / Math.max(b.retail, 1e-9),
        turn,
        // what a slot on the board earns in a year, which is the only
        // comparison between a fast cheap frame and a slow dear one
        perSlot: (unitMargin * b.soldPerYear) / Math.max(b.framesOnBoard, 1),
        tiedUp: b.framesOnBoard * b.cost,
        annualMargin: unitMargin * b.soldPerYear,
      }
    })
    .sort((a, b) => b.perSlot - a.perSlot)
  const max = Math.max(...rows.map((r) => r.perSlot), 1)
  const tiedUp = rows.reduce((a, r) => a + r.tiedUp, 0)
  const annual = rows.reduce((a, r) => a + r.annualMargin, 0)
  const slots = rows.reduce((a, r) => a + r.framesOnBoard, 0)
  const best = rows[0]
  const worst = rows[rows.length - 1]
  const bestRate = rows.reduce((a, r) => (r.marginRate > a.marginRate ? r : a), rows[0])
  const slow = rows.filter((r) => r.turn < 1)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.framesOnBoard} on the board · {money(r.retail)} · {(r.marginRate * 100).toFixed(0)}% ·{" "}
                {r.turn.toFixed(1)}× turn
              </span>
            </div>
            <div className="relative mt-0.5 h-5 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px]"
                style={{
                  width: `${clamp((r.perSlot / max) * 100, 2, 100)}%`,
                  background: r.turn < 1 ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 55%, transparent)",
                  outline: r.turn < 1 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`${money(r.perSlot)} a slot a year`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.perSlot)} a slot a year · {money(r.unitMargin)} a frame × {r.soldPerYear} sold ·{" "}
              {money(r.tiedUp)} of stock on this band
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is what a SLOT ON THE BOARD earns in a year — margin multiplied by turn and divided by the space it
        occupies, which is the only way a fast cheap frame and a slow dear one can be compared ·{" "}
        {best.name} returns {money(best.perSlot)} a slot against {money(worst.perSlot)} for {worst.name}, ×
        {(best.perSlot / Math.max(worst.perSlot, 1e-9)).toFixed(1)} ·{" "}
        {bestRate.name === best.name
          ? `${best.name} happens to have the best margin rate too, which is the comfortable case`
          : `${bestRate.name} has the best margin RATE at ${(bestRate.marginRate * 100).toFixed(0)}% and is not the best earner, which is what a price list can never show`}{" "}
        · {money(tiedUp)} of stock across {slots} slots returns {money(annual)} a year
        {slow.length > 0 ? `, and ${slow.length} ${plural(slow.length, "band turns", "bands turn")} less than once — hatched, because that stock is furniture` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RecallDue — patients due for recall by month, with the YIELD derived.
 * A recall list is a workload; what matters is how many of each month's
 * letters came back, because a month that converts at half the rate is
 * a message problem rather than a bigger list.
 * ------------------------------------------------------------------ */
export function RecallDue({
  months,
  testValue,
  className = "",
}: {
  months: { label: string; due: number; booked: number; attended: number }[]
  /** the value of a test that also becomes a dispense, on average */
  testValue: number
  className?: string
}) {
  const rows = months.map((m) => ({
    ...m,
    bookRate: m.due > 0 ? m.booked / m.due : null,
    attendRate: m.booked > 0 ? m.attended / m.booked : null,
    // a patient can only be lost once, so the two losses are separate
    lostToBooking: m.due - m.booked,
    lostToAttendance: m.booked - m.attended,
  }))
  const max = Math.max(...rows.map((r) => r.due), 1)
  const due = rows.reduce((a, r) => a + r.due, 0)
  const booked = rows.reduce((a, r) => a + r.booked, 0)
  const attended = rows.reduce((a, r) => a + r.attended, 0)
  const rated = rows.filter((r) => r.bookRate !== null)
  const worst = rated.length ? rated.reduce((a, r) => ((r.bookRate ?? 1) < (a.bookRate ?? 1) ? r : a), rated[0]) : null
  const best = rated.length ? rated.reduce((a, r) => ((r.bookRate ?? 0) > (a.bookRate ?? 0) ? r : a), rated[0]) : null

  return (
    <div className={className}>
      <div className="flex items-stretch gap-px" style={{ height: 130 }}>
        {rows.map((r) => (
          <div key={r.label} className="relative min-w-0 flex-1" title={`${r.label}: ${r.due} due, ${r.booked} booked, ${r.attended} attended`}>
            <div className="absolute inset-x-0 bottom-0 rounded-t-[1px] bg-foreground/65" style={{ height: `${(r.attended / max) * 100}%` }} />
            <div className="absolute inset-x-0" style={{ bottom: `${(r.attended / max) * 100}%`, height: `${(r.lostToAttendance / max) * 100}%`, background: "color-mix(in oklch, currentColor 28%, transparent)" }} />
            <div
              className="absolute inset-x-0 rounded-t-[1px]"
              style={{
                bottom: `${(r.booked / max) * 100}%`,
                height: `${(r.lostToBooking / max) * 100}%`,
                background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 5px)",
              }}
            />
          </div>
        ))}
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
          <dt className="text-muted-foreground">Due</dt>
          <dd className="font-medium tabular-nums">{due}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Booked</dt>
          <dd className="font-medium tabular-nums">{((booked / Math.max(due, 1)) * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Attended</dt>
          <dd className="font-medium tabular-nums">{((attended / Math.max(booked, 1)) * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Never seen</dt>
          <dd className="font-medium tabular-nums">{money((due - attended) * testValue)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Three heights, three different losses: solid is ATTENDED, pale is booked and did not come, hatched is never
        booked at all · {attended} of {due} recalls were seen, and the {due - attended} that were not are worth{" "}
        {money((due - attended) * testValue)} · the two losses need different answers — a letter that does not
        convert is a message problem and a booking that does not attend is a reminder problem ·{" "}
        {best && worst && best !== worst
          ? `${best.label} booked ${(((best.bookRate ?? 0)) * 100).toFixed(0)}% against ${(((worst.bookRate ?? 0)) * 100).toFixed(0)}% for ${worst.label}, and the list was not what differed`
          : "there is not enough month-to-month variation here to point at a message"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * LensAttach — lens options taken, with the VALUE PER DISPENSE derived.
 * Options are sold one at a time in a conversation and reviewed as
 * separate line items, so nobody ever sees what the whole conversation
 * is worth or which option carries it.
 * ------------------------------------------------------------------ */
export function LensAttach({
  options,
  dispenses,
  baseDispenseValue,
  className = "",
}: {
  options: { name: string; taken: number; price: number; cost: number }[]
  dispenses: number
  /** the lens and frame before any option is added */
  baseDispenseValue: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!options.length) return null

  const rows = options
    .map((o) => {
      const attach = o.taken / Math.max(dispenses, 1)
      const margin = (o.price - o.cost) * o.taken
      return { ...o, attach, margin, perDispense: margin / Math.max(dispenses, 1), unitMargin: o.price - o.cost }
    })
    .sort((a, b) => b.perDispense - a.perDispense)
  const max = Math.max(...rows.map((r) => r.perDispense), 0.01)
  const totalPerDispense = rows.reduce((a, r) => a + r.perDispense, 0)
  const uplift = totalPerDispense / Math.max(baseDispenseValue, 1e-9)
  const top = rows[0]
  const topShare = top.perDispense / Math.max(totalPerDispense, 1e-9)
  const rarelyTaken = rows.filter((r) => r.attach < 0.15)
  const bestAttach = rows.reduce((a, r) => (r.attach > a.attach ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.taken} taken · {(r.attach * 100).toFixed(0)}% attach · {money(r.price)}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/55" style={{ width: `${clamp((r.perDispense / max) * 100, 1, 100)}%` }} title={`${money(r.perDispense)} per dispense`} />
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${clamp(r.attach * 100, 0, 99)}%` }} title={`attached to ${(r.attach * 100).toFixed(0)}% of dispenses`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.perDispense)} across every dispense · {money(r.unitMargin)} a unit when it is taken ·{" "}
              {money(r.margin)} in total
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is margin spread across EVERY dispense, not just the ones that took the option, because that is the
        number an average dispense value contains · options add {money(totalPerDispense)} to a{" "}
        {money(baseDispenseValue)} dispense, {(uplift * 100).toFixed(0)}% on top, from a conversation at the desk ·{" "}
        {top.name} carries {(topShare * 100).toFixed(0)}% of it
        {bestAttach.name === top.name ? " and is also the most often taken" : `, while ${bestAttach.name} is taken most often at ${(bestAttach.attach * 100).toFixed(0)}%`}
        {rarelyTaken.length > 0 ? ` · ${rarelyTaken.length} ${plural(rarelyTaken.length, "option is", "options are")} taken under 15% of the time, which is either a pricing answer or a conversation nobody is having` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * MyopiaProgression — a child's myopia against what it would have done
 * untreated, with the SLOWING derived. Progression is measured in
 * dioptres a year and the only useful question is whether the control
 * lens changed the slope, which needs the counterfactual drawn.
 * ------------------------------------------------------------------ */
export function MyopiaProgression({
  readings,
  expectedPerYear,
  startedControlAt,
  className = "",
}: {
  /** oldest first; sphere in dioptres, negative for myopia */
  readings: { age: number; sphere: number }[]
  /** untreated progression for this age group, dioptres a year (negative) */
  expectedPerYear: number
  /** the age at which a control lens was fitted, if it was */
  startedControlAt?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!readings.length) return null

  const first = readings[0]
  const last = readings[readings.length - 1]
  const years = last.age - first.age
  const actual = years > 0 ? (last.sphere - first.sphere) / years : 0
  const expectedNow = first.sphere + expectedPerYear * years
  const saved = last.sphere - expectedNow
  const before = startedControlAt !== undefined ? readings.filter((r) => r.age <= startedControlAt) : []
  const after = startedControlAt !== undefined ? readings.filter((r) => r.age >= startedControlAt) : readings
  const slope = (rs: typeof readings) => (rs.length > 1 && rs[rs.length - 1].age > rs[0].age ? (rs[rs.length - 1].sphere - rs[0].sphere) / (rs[rs.length - 1].age - rs[0].age) : null)
  const beforeSlope = slope(before)
  const afterSlope = slope(after)
  const lo = Math.min(expectedNow, ...readings.map((r) => r.sphere)) - 0.4
  const hi = Math.max(...readings.map((r) => r.sphere)) + 0.4
  const y = (v: number) => 100 - ((v - lo) / Math.max(hi - lo, 1e-9)) * 100
  const x = (age: number) => ((age - first.age) / Math.max(years, 1e-9)) * 100

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height: 150 }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {/* the counterfactual: what this eye was expected to do untreated */}
          <line x1={0} y1={clamp(y(first.sphere), 0, 100)} x2={100} y2={clamp(y(expectedNow), 0, 100)} stroke="currentColor" strokeWidth={0.8} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity={0.55} />
          <polyline points={readings.map((r) => `${x(r.age)},${clamp(y(r.sphere), 0, 100)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
        </svg>
        {startedControlAt !== undefined && (
          <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${clamp(x(startedControlAt), 0, 99)}%` }} title={`control lens fitted at ${startedControlAt}`} />
        )}
        {readings.map((r, i) => (
          <span key={i} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground bg-background" style={{ left: `${x(r.age)}%`, top: `${clamp(y(r.sphere), 0, 100)}%` }} title={`age ${r.age}: ${dpt(r.sphere)}`} />
        ))}
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] tabular-nums text-muted-foreground">
        <span>age {first.age}</span>
        <span>dashed is untreated progression at {expectedPerYear.toFixed(2)} D/yr</span>
        <span>age {last.age}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Now</dt>
          <dd className="font-medium tabular-nums">{dpt(last.sphere)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Actual rate</dt>
          <dd className="font-medium tabular-nums">{actual.toFixed(2)} D/yr</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Expected</dt>
          <dd className="font-medium tabular-nums">{dpt(expectedNow)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Difference</dt>
          <dd className="font-medium tabular-nums">{dpt(saved)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The dashed line is what this eye was expected to do UNTREATED, which is the only thing a measured
        progression can be judged against — a child getting more myopic on a control lens is not a failure if they
        were getting more myopic more slowly · {years.toFixed(1)} years on, the eye is at {dpt(last.sphere)} against
        an expected {dpt(expectedNow)}, {dpt(saved)} better ·{" "}
        {beforeSlope === null || afterSlope === null
          ? startedControlAt === undefined
            ? "no control lens has been fitted, so this is the untreated trajectory being watched"
            : "there are not enough readings on both sides of the fitting to compare the slopes directly"
          : `the slope went ${beforeSlope.toFixed(2)} D/yr before the lens to ${afterSlope.toFixed(2)} after, ${Math.abs(afterSlope) < Math.abs(beforeSlope) ? `a ${((1 - Math.abs(afterSlope) / Math.max(Math.abs(beforeSlope), 1e-9)) * 100).toFixed(0)}% slowing` : "no slowing, which is worth reviewing at the next visit"}`}
      </p>
    </div>
  )
}
