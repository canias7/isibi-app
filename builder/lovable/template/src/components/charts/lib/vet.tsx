/**
 * Small-animal veterinary primitives — the consult mix, vaccination lapse,
 * weight against breed range, anaesthetic risk, practice plans and dispensing.
 *
 * Whether a booked slot matches the consult that fills it, how many animals
 * never come back after a missed booster, whether a weight trend has left the
 * range, which procedures carry risk the list order ignores, what a plan
 * member is really worth and where the dispensing money actually is are all
 * DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
const money = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e4 ? `£${(a / 1e3).toFixed(1)}k` : a < 10 ? `£${a.toFixed(2)}` : `£${Math.round(a).toLocaleString("en-GB")}`
  return v < 0 ? `−${s}` : s
}

/* ------------------------------------------------------------------ *
 * ConsultMix — consult types against the slot they are booked into,
 * with the OVERRUN derived. A practice books everything in ten-minute
 * slots and then wonders why it runs forty minutes late by lunch; the
 * answer is a small number of consult types that never fitted.
 * ------------------------------------------------------------------ */
export function ConsultMix({
  types,
  slotMinutes,
  className = "",
}: {
  types: { name: string; count: number; meanMinutes: number; p90Minutes: number }[]
  slotMinutes: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!types.length) return null

  const rows = types
    .map((t) => {
      const overrunPerConsult = Math.max(0, t.meanMinutes - slotMinutes)
      return {
        ...t,
        overrunPerConsult,
        totalOverrun: overrunPerConsult * t.count,
        fits: t.p90Minutes <= slotMinutes,
        // how long a slot would have to be for nine in ten to fit
        neededSlot: Math.ceil(t.p90Minutes / 5) * 5,
      }
    })
    .sort((a, b) => b.totalOverrun - a.totalOverrun)
  const max = Math.max(...rows.map((r) => r.p90Minutes), slotMinutes)
  const totalOverrun = rows.reduce((a, r) => a + r.totalOverrun, 0)
  const consults = rows.reduce((a, r) => a + r.count, 0)
  const overrunning = rows.filter((r) => r.overrunPerConsult > 0)
  const share = overrunning.reduce((a, r) => a + r.count, 0) / Math.max(consults, 1)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">
                <span aria-hidden className="mr-1 inline-block w-3 text-muted-foreground">
                  {r.fits ? "·" : "!"}
                </span>
                {r.name}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {r.count} · mean {r.meanMinutes} min · p90 {r.p90Minutes} min
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/30" style={{ width: `${(r.meanMinutes / max) * 100}%` }} title={`mean ${r.meanMinutes} min`} />
              <div
                className="absolute inset-y-0 rounded-r-[2px]"
                style={{
                  left: `${(r.meanMinutes / max) * 100}%`,
                  width: `${((r.p90Minutes - r.meanMinutes) / max) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 5px)",
                }}
                title={`out to p90 ${r.p90Minutes} min`}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${clamp((slotMinutes / max) * 100, 0, 99)}%` }} title={`booked slot ${slotMinutes} min`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {/* three cases, not two: a type whose MEAN fits and whose tail
                  does not is the commonest of the three and reads as fine */}
              {r.overrunPerConsult > 0
                ? `${r.overrunPerConsult.toFixed(0)} min over on average, ${r.totalOverrun.toFixed(0)} min across ${r.count} — needs a ${r.neededSlot}-minute slot`
                : r.fits
                  ? `fits the ${slotMinutes}-minute slot, nine times in ten`
                  : `fits on average and runs to ${r.p90Minutes} min one time in ten, which is where a morning goes`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Every consult is booked into the same {slotMinutes} minutes and the mark is that slot, so the hatch past it is
        the practice running late · {overrunning.length} of {rows.length} types overrun, and they are only{" "}
        {(share * 100).toFixed(0)}% of {consults} consults — which is why the day feels fine until it suddenly is not
        · {totalOverrun.toFixed(0)} minutes of overrun is {(totalOverrun / 60).toFixed(1)} hours, or{" "}
        {Math.round(totalOverrun / slotMinutes)} slots that were never sold · the fix is a longer slot for{" "}
        {rows[0].name}, not a faster vet
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * VaccinationDue — animals due, given and lapsed by month, with the
 * LAPSE CURVE derived. A reminder system is judged on how many came
 * back this month; what matters is how many never come back at all,
 * which only shows up as the months since due grow.
 * ------------------------------------------------------------------ */
export function VaccinationDue({
  months,
  boosterValue,
  className = "",
}: {
  /** in order, oldest due date first */
  months: { label: string; due: number; given: number }[]
  /** the practice value of a booster visit, including what else gets seen */
  boosterValue: number
  className?: string
}) {
  const rows = months.map((m) => {
    const lapsed = Math.max(0, m.due - m.given)
    return { ...m, lapsed, rate: m.given / Math.max(m.due, 1) }
  })
  const max = Math.max(...rows.map((r) => r.due), 1)
  const due = rows.reduce((a, r) => a + r.due, 0)
  const given = rows.reduce((a, r) => a + r.given, 0)
  const lapsed = due - given
  // a month with nothing due has no rate — that is unknown, not zero
  const rated = rows.filter((r) => r.due > 0)
  const recent = rated.slice(-3)
  const old = rated.slice(0, 3)
  const recentRate = recent.length ? recent.reduce((a, r) => a + r.rate, 0) / recent.length : null
  const oldRate = old.length ? old.reduce((a, r) => a + r.rate, 0) / old.length : null

  return (
    <div className={className}>
      <div className="flex items-stretch gap-px" style={{ height: 130 }}>
        {rows.map((r) => (
          <div key={r.label} className="relative min-w-0 flex-1" title={`${r.label}: ${r.given} of ${r.due} given, ${r.lapsed} lapsed`}>
            <div className="absolute inset-x-0 bottom-0 rounded-t-[1px] bg-foreground/55" style={{ height: `${(r.given / max) * 100}%` }} />
            <div
              className="absolute inset-x-0 rounded-t-[1px]"
              style={{
                bottom: `${(r.given / max) * 100}%`,
                height: `${(r.lapsed / max) * 100}%`,
                background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 5px)",
                outline: r.lapsed > 0 ? "1px solid currentColor" : undefined,
                outlineOffset: -1,
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
          <dt className="text-muted-foreground">Lapsed</dt>
          <dd className="font-medium tabular-nums">{lapsed}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Compliance</dt>
          <dd className="font-medium tabular-nums">{((given / Math.max(due, 1)) * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Value lapsed</dt>
          <dd className="font-medium tabular-nums">{money(lapsed * boosterValue)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Solid is given and hatched is LAPSED, carried at the month it was due rather than the month it was chased ·{" "}
        {lapsed} of {due} boosters were never given, {money(lapsed * boosterValue)} of visits that also contained the
        weight check, the teeth and the lump nobody had noticed ·{" "}
        {recentRate === null || oldRate === null
          ? "there is not enough dated history to say whether compliance is moving"
          : recentRate > oldRate
            ? `compliance is rising — ${(oldRate * 100).toFixed(0)}% on the oldest months against ${(recentRate * 100).toFixed(0)}% on the newest, so the reminders are working`
            : `the newest months sit at ${(recentRate * 100).toFixed(0)}% against ${(oldRate * 100).toFixed(0)}% on the oldest, and an animal that misses one rarely returns for the next`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * WeightTrack — one animal's weight against its breed range, with the
 * TREND and the crossing derived. A single weight is compared to a
 * chart on the wall; what a consult needs is the direction, because a
 * dog inside the range and falling fast is the one to worry about.
 * ------------------------------------------------------------------ */
export function WeightTrack({
  readings,
  breedMinKg,
  breedMaxKg,
  animal = "the animal",
  className = "",
}: {
  /** in order, oldest first */
  readings: { date: string; kg: number }[]
  breedMinKg: number
  breedMaxKg: number
  animal?: string
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!readings.length) return null

  const kgs = readings.map((r) => r.kg)
  const lo = Math.min(breedMinKg, ...kgs) * 0.94
  const hi = Math.max(breedMaxKg, ...kgs) * 1.06
  const y = (kg: number) => 100 - ((kg - lo) / Math.max(hi - lo, 1e-9)) * 100
  const x = (i: number) => (i / Math.max(readings.length - 1, 1)) * 100
  const first = readings[0]
  const last = readings[readings.length - 1]
  const change = last.kg - first.kg
  const pct = change / Math.max(first.kg, 1e-9)
  // slope over the last three readings, which is what a consult can act on
  const tail = readings.slice(-3)
  const recent = tail.length > 1 ? (tail[tail.length - 1].kg - tail[0].kg) / (tail.length - 1) : 0
  const inRange = (kg: number) => kg >= breedMinKg && kg <= breedMaxKg
  const crossings = readings.filter((r, i) => i > 0 && inRange(readings[i - 1].kg) !== inRange(r.kg))
  const state = last.kg > breedMaxKg ? "above" : last.kg < breedMinKg ? "below" : "inside"

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height: 150 }}>
        {/* the breed range as a band, because a weight only means something
            against one and a bare line invites reading the wiggle */}
        <div
          className="absolute inset-x-0 bg-foreground/8"
          style={{ top: `${y(breedMaxKg)}%`, height: `${Math.max(y(breedMinKg) - y(breedMaxKg), 0.5)}%` }}
          title={`breed range ${breedMinKg}–${breedMaxKg} kg`}
        />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polyline
            points={readings.map((r, i) => `${x(i)},${clamp(y(r.kg), 0, 100)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.9}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {readings.map((r, i) => (
          <span
            key={i}
            className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground"
            style={{ left: `${x(i)}%`, top: `${clamp(y(r.kg), 0, 100)}%`, background: inRange(r.kg) ? "currentColor" : "var(--background)" }}
            title={`${r.date}: ${r.kg.toFixed(1)} kg${inRange(r.kg) ? "" : " — outside the breed range"}`}
          />
        ))}
        <span className="absolute right-1 text-[9px] text-muted-foreground" style={{ top: `${clamp(y(breedMaxKg), 2, 92)}%` }}>
          {breedMaxKg} kg
        </span>
        <span className="absolute right-1 text-[9px] text-muted-foreground" style={{ top: `${clamp(y(breedMinKg), 6, 96)}%` }}>
          {breedMinKg} kg
        </span>
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] tabular-nums text-muted-foreground">
        <span>{first.date}</span>
        <span>shaded band is the breed range</span>
        <span>{last.date}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Now</dt>
          <dd className="font-medium tabular-nums">{last.kg.toFixed(1)} kg</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Change</dt>
          <dd className="font-medium tabular-nums">
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)} kg
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Recent</dt>
          <dd className="font-medium tabular-nums">
            {recent >= 0 ? "+" : ""}
            {recent.toFixed(2)} kg/visit
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Range</dt>
          <dd className="font-medium">{state}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A single weight is read against the band and the useful quantity is the DIRECTION — {animal} is {state} the
        breed range and has moved {change >= 0 ? "+" : ""}
        {change.toFixed(1)} kg ({(pct * 100).toFixed(0)}%) since {first.date}, with the last few visits running at{" "}
        {recent >= 0 ? "+" : ""}
        {recent.toFixed(2)} kg a visit ·{" "}
        {crossings.length === 0
          ? state === "inside"
            ? "it has stayed inside the range throughout, so the trend is the only thing to watch"
            : "it has been outside the range at every visit, which is a starting point rather than a change"
          : `it crossed the range boundary ${crossings.length} ${plural(crossings.length, "time", "times")}, most recently at ${crossings[crossings.length - 1].date}`}{" "}
        · hollow points are readings outside the band
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AnaestheticRisk — a day's procedure list ordered by RISK rather than
 * by the time it was booked. A list runs in booking order and the
 * ASA grade, the age and the length are known in advance, so the
 * ordering is a choice nobody consciously makes.
 * ------------------------------------------------------------------ */
export function AnaestheticRisk({
  procedures,
  className = "",
}: {
  procedures: {
    name: string
    patient: string
    /** ASA physical status 1–5 */
    asa: number
    ageYears: number
    /** expected anaesthetic time */
    minutes: number
    bookedOrder: number
  }[]
  className?: string
}) {
  const rows = procedures
    .map((p) => {
      // a simple, stated composite: grade dominates, with age and duration as
      // modifiers. The point is that it is EXPLICIT rather than felt
      const gradeScore = (p.asa - 1) / 4
      const ageScore = clamp((p.ageYears - 7) / 8, 0, 1)
      const timeScore = clamp((p.minutes - 30) / 120, 0, 1)
      const score = gradeScore * 0.6 + ageScore * 0.25 + timeScore * 0.15
      return { ...p, score }
    })
    .sort((a, b) => b.score - a.score)
  const moved = rows.filter((r, i) => r.bookedOrder !== i + 1)
  const highest = rows[0]
  const bookedFirst = rows.reduce((a, r) => (r.bookedOrder < a.bookedOrder ? r : a), rows[0])
  const glyph = (asa: number) => "▮".repeat(clamp(Math.round(asa), 1, 5))
  const meanAsa = rows.reduce((a, r) => a + r.asa, 0) / Math.max(rows.length, 1)

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={`${r.patient}-${r.name}`} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span className="w-8 shrink-0 text-muted-foreground">
              {i + 1}
              {r.bookedOrder !== i + 1 ? <span title={`booked ${r.bookedOrder}`}>←{r.bookedOrder}</span> : ""}
            </span>
            <span className="w-28 shrink-0 truncate">{r.patient}</span>
            <span aria-hidden className="w-10 shrink-0 tracking-tighter text-muted-foreground" title={`ASA ${r.asa}`}>
              {glyph(r.asa)}
            </span>
            <div className="relative h-3.5 flex-1 rounded-[1px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[1px]"
                style={{
                  width: `${clamp(r.score * 100, 2, 100)}%`,
                  background: r.asa >= 4 ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)" : "color-mix(in oklch, currentColor 50%, transparent)",
                  outline: r.asa >= 4 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`risk score ${(r.score * 100).toFixed(0)}`}
              />
            </div>
            <span className="w-40 shrink-0 truncate text-right text-muted-foreground">
              {r.name} · {r.ageYears}y · {r.minutes} min
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Ordered by a STATED composite — ASA grade at 60%, age over seven at 25%, anaesthetic time at 15% — rather than
        by when the owner rang · the blocks are the ASA grade and a hatched bar is grade 4 or worse ·{" "}
        {moved.length === 0
          ? "the booked order already matches the risk order, which is luck rather than a system"
          : `${moved.length} of ${rows.length} ${plural(moved.length, "procedure moves", "procedures move")} from where it was booked — ${highest.patient} goes first at ASA ${highest.asa}${highest.bookedOrder === 1 ? " and was already first" : `, having been booked ${highest.bookedOrder}${highest.bookedOrder === bookedFirst.bookedOrder ? "" : ""}`}`}{" "}
        · mean grade {meanAsa.toFixed(1)} · a composite anybody can argue with beats a running order nobody chose
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PracticePlan — plan members against pay-as-you-go, with the REAL
 * comparison derived. A plan is sold on monthly revenue and judged on
 * whether members spend more; the number that decides it is spend per
 * year INCLUDING the plan fee, against what the plan gives away.
 * ------------------------------------------------------------------ */
export function PracticePlan({
  cohorts,
  planFeePerMonth,
  planIncludedValue,
  className = "",
}: {
  cohorts: { name: string; animals: number; onPlan: boolean; visitsPerYear: number; feeSpendPerYear: number }[]
  planFeePerMonth: number
  /** the retail value of what a plan includes and does not charge for */
  planIncludedValue: number
  className?: string
}) {
  const rows = cohorts
    .map((c) => {
      const planIncome = c.onPlan ? planFeePerMonth * 12 : 0
      const givenAway = c.onPlan ? planIncludedValue : 0
      const gross = c.feeSpendPerYear + planIncome
      return { ...c, planIncome, givenAway, gross, net: gross - givenAway, perAnimal: gross - givenAway }
    })
    .sort((a, b) => b.net - a.net)
  const max = Math.max(...rows.map((r) => r.gross), 1)
  const plan = rows.filter((r) => r.onPlan)
  const payg = rows.filter((r) => !r.onPlan)
  const meanPlan = plan.length ? plan.reduce((a, r) => a + r.net, 0) / plan.length : null
  const meanPayg = payg.length ? payg.reduce((a, r) => a + r.net, 0) / payg.length : null
  const planVisits = plan.length ? plan.reduce((a, r) => a + r.visitsPerYear, 0) / plan.length : null
  const paygVisits = payg.length ? payg.reduce((a, r) => a + r.visitsPerYear, 0) / payg.length : null
  const planAnimals = plan.reduce((a, r) => a + r.animals, 0)
  const allAnimals = rows.reduce((a, r) => a + r.animals, 0)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">
                <span aria-hidden className="mr-1 inline-block w-3 text-muted-foreground">
                  {r.onPlan ? "▣" : "▢"}
                </span>
                {r.name}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {r.animals} animals · {r.visitsPerYear.toFixed(1)} visits/yr · {r.onPlan ? "on plan" : "pay as you go"}
              </span>
            </div>
            <div className="relative mt-0.5 h-5 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/30" style={{ width: `${(r.feeSpendPerYear / max) * 100}%` }} title={`fees ${money(r.feeSpendPerYear)}`} />
              {r.planIncome > 0 && (
                <div
                  className="absolute inset-y-0"
                  style={{ left: `${(r.feeSpendPerYear / max) * 100}%`, width: `${(r.planIncome / max) * 100}%`, background: "color-mix(in oklch, currentColor 60%, transparent)" }}
                  title={`plan fees ${money(r.planIncome)}`}
                />
              )}
              {r.givenAway > 0 && (
                <div
                  className="absolute inset-y-0 rounded-r-[2px]"
                  style={{
                    left: `${((r.gross - r.givenAway) / max) * 100}%`,
                    width: `${(r.givenAway / max) * 100}%`,
                    background: "repeating-linear-gradient(135deg, var(--background) 0 2px, transparent 2px 4px)",
                    outline: "1px dashed currentColor",
                    outlineOffset: -1,
                  }}
                  title={`included in the plan and not charged: ${money(r.givenAway)}`}
                />
              )}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.gross)} gross a year
              {r.onPlan ? ` less ${money(r.givenAway)} included in the plan` : " with nothing included"} ={" "}
              <span className="font-medium text-foreground/70">{money(r.net)} an animal</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A plan is sold as monthly income and the honest comparison is net of what it GIVES AWAY — the dashed section
        is the boosters, the check and the flea treatment the member no longer pays for ·{" "}
        {meanPlan === null || meanPayg === null
          ? "one side of the comparison is missing here, so the difference cannot be stated"
          : `a plan animal is worth ${money(meanPlan)} a year against ${money(meanPayg)} off plan, ${meanPlan >= meanPayg ? `${money(meanPlan - meanPayg)} better` : `${money(meanPayg - meanPlan)} WORSE`}`}
        {planVisits !== null && paygVisits !== null
          ? ` · the mechanism is visits, not price: ${planVisits.toFixed(1)} a year against ${paygVisits.toFixed(1)}, and an animal that comes in is an animal whose lump gets found`
          : ""}{" "}
        · {planAnimals} of {allAnimals} animals are on a plan
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DispensingMargin — drugs dispensed, with the FEE separated from the
 * markup. A practice argues about the markup on a bottle while most of
 * the money is in the dispensing fee, which is per item and therefore
 * enormous on the cheap ones and invisible on the expensive ones.
 * ------------------------------------------------------------------ */
export function DispensingMargin({
  items,
  dispensingFee,
  className = "",
}: {
  items: { name: string; itemsDispensed: number; unitCost: number; unitPrice: number }[]
  /** charged once per item dispensed, on top of the price */
  dispensingFee: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!items.length) return null

  const rows = items
    .map((i) => {
      const markup = (i.unitPrice - i.unitCost) * i.itemsDispensed
      const fees = dispensingFee * i.itemsDispensed
      const total = markup + fees
      return {
        ...i,
        markup,
        fees,
        total,
        feeShare: total > 0 ? fees / total : null,
        markupRate: (i.unitPrice - i.unitCost) / Math.max(i.unitPrice, 1e-9),
      }
    })
    .sort((a, b) => b.total - a.total)
  const max = Math.max(...rows.map((r) => r.total), 1)
  const totalMarkup = rows.reduce((a, r) => a + r.markup, 0)
  const totalFees = rows.reduce((a, r) => a + r.fees, 0)
  const grand = totalMarkup + totalFees
  const feeLed = rows.filter((r) => r.feeShare !== null && r.feeShare > 0.5)
  const dearest = rows.reduce((a, r) => (r.unitPrice > a.unitPrice ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.itemsDispensed} items · {money(r.unitCost)} → {money(r.unitPrice)} ·{" "}
                {(r.markupRate * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-0.5 flex h-4 rounded-[2px] bg-muted" style={{ width: `${(r.total / max) * 100}%` }}>
              <div className="rounded-l-[2px] bg-foreground/50" style={{ width: `${(r.markup / Math.max(r.total, 1e-9)) * 100}%` }} title={`markup ${money(r.markup)}`} />
              <div
                className="rounded-r-[2px]"
                style={{
                  width: `${(r.fees / Math.max(r.total, 1e-9)) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 4px)",
                  outline: "1px solid currentColor",
                  outlineOffset: -1,
                }}
                title={`dispensing fees ${money(r.fees)}`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.total)} — {money(r.markup)} of markup and {money(r.fees)} of fees
              {r.feeShare !== null ? `, ${(r.feeShare * 100).toFixed(0)}% of it the fee` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Solid is MARKUP and hatched is the {money(dispensingFee)} DISPENSING FEE, which is per item and therefore has
        nothing to do with what the item cost · {money(totalFees)} of {money(grand)} is fee —{" "}
        {((totalFees / Math.max(grand, 1)) * 100).toFixed(0)}% of the dispensing margin arrives regardless of the
        price list everybody argues about ·{" "}
        {feeLed.length === 0
          ? "no line is fee-led here, so the markup really is the lever"
          : `${feeLed.length} of ${rows.length} ${plural(feeLed.length, "line makes", "lines make")} most of its money from the fee, and every one of them is a cheap item dispensed often`}{" "}
        · {dearest.name} is the dearest at {money(dearest.unitPrice)} and its fee is{" "}
        {dearest.feeShare !== null ? `${(dearest.feeShare * 100).toFixed(0)}%` : "not measurable"} of the take, which
        is the same fee, unnoticed
      </p>
    </div>
  )
}
