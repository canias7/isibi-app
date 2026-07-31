/**
 * Payroll primitives — gross to net, overtime patterns, pay drift, pension
 * opt-outs, salary sacrifice and the real cost to employ.
 *
 * What actually reaches a bank account, whether overtime is a spike or a
 * habit, how a pay scale drifts away from itself, who is opting out and at
 * what cost to them, what a sacrifice is worth to both sides and the
 * multiple over salary an employer pays are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) => {
  const a = Math.abs(v)
  // a payroll aggregate reaches millions readily — without this branch a
  // whole-company figure prints as "£13295.4k", which nobody reads as £13m
  const s =
    a >= 1e6
      ? `£${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`
      : a >= 1e4
        ? `£${(a / 1e3).toFixed(1)}k`
        : a < 10
          ? `£${a.toFixed(2)}`
          : `£${Math.round(a).toLocaleString("en-GB")}`
  return v < 0 ? `−${s}` : s
}
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/* ------------------------------------------------------------------ *
 * GrossToNet — the deductions between a salary and a bank transfer,
 * with the EFFECTIVE RATE derived at each level. Everybody knows the
 * headline rates and almost nobody knows what they add up to.
 * ------------------------------------------------------------------ */
export function GrossToNet({
  levels,
  className = "",
}: {
  levels: { gross: number; incomeTax: number; nationalInsurance: number; pension: number; studentLoan?: number }[]
  className?: string
}) {
  const rows = levels
    .map((l) => {
      const deductions = l.incomeTax + l.nationalInsurance + l.pension + (l.studentLoan ?? 0)
      return { ...l, deductions, net: l.gross - deductions, rate: deductions / Math.max(l.gross, 1) }
    })
    .sort((a, b) => a.gross - b.gross)
  const parts: [keyof (typeof rows)[number], string, string][] = [
    ["net", "Take home", "color-mix(in oklch, currentColor 25%, transparent)"],
    ["incomeTax", "Income tax", "currentColor"],
    ["nationalInsurance", "National insurance", "color-mix(in oklch, currentColor 58%, transparent)"],
    ["pension", "Pension", "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)"],
    ["studentLoan", "Student loan", "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"],
  ]
  const max = Math.max(...rows.map((r) => r.gross))
  // the marginal rate between each pair of levels, which is the number that
  // decides whether a rise is worth taking
  const marginals = rows.slice(1).map((r, i) => ({
    from: rows[i].gross,
    to: r.gross,
    rate: (r.deductions - rows[i].deductions) / Math.max(r.gross - rows[i].gross, 1e-9),
  }))
  const worstMarginal = marginals.reduce((a, m) => (m.rate > a.rate ? m : a), marginals[0] ?? { from: 0, to: 0, rate: 0 })

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.gross}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="tabular-nums">{money(r.gross)}</span>
              <span className="tabular-nums text-muted-foreground">
                {money(r.net)} in the bank · {(r.rate * 100).toFixed(1)}% gone
              </span>
            </div>
            <div className="mt-0.5 flex h-4 rounded-[2px] border border-foreground/20" style={{ width: `${(r.gross / max) * 100}%` }}>
              {parts.map(([k, label, bg]) => {
                const v = (r[k] as number | undefined) ?? 0
                if (v <= 0) return null
                return (
                  <div
                    key={label}
                    className="min-w-0 first:rounded-l-[2px] last:rounded-r-[2px]"
                    style={{ width: `${(v / Math.max(r.gross, 1)) * 100}%`, background: bg }}
                    title={`${label}: ${money(v)}`}
                  />
                )
              })}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {parts.map(([, label, bg]) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25" style={{ background: bg }} />
            {label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The effective rate is the SUM of every deduction, which nobody carries in their head — it runs{" "}
        {(rows[0].rate * 100).toFixed(1)}% at {money(rows[0].gross)} to{" "}
        {(rows[rows.length - 1].rate * 100).toFixed(1)}% at {money(rows[rows.length - 1].gross)} ·{" "}
        {marginals.length > 0
          ? `the MARGINAL rate between ${money(worstMarginal.from)} and ${money(worstMarginal.to)} is ${(worstMarginal.rate * 100).toFixed(0)}%, which is what a rise across that band is actually worth and is nowhere on a payslip`
          : "a single level cannot show a marginal rate"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * OvertimePattern — overtime by person and week, with the HABITUAL
 * share derived. A monthly total says a department worked overtime;
 * the pattern says whether that is cover or understaffing.
 * ------------------------------------------------------------------ */
export function OvertimePattern({
  people,
  weeks,
  hours,
  contractedHours,
  className = "",
}: {
  people: string[]
  weeks: string[]
  /** hours[person][week] */
  hours: number[][]
  contractedHours: number
  className?: string
}) {
  const rows = people.map((name, pi) => {
    const total = hours[pi].reduce((a, v) => a + v, 0)
    const weeksWorked = hours[pi].filter((v) => v > 0).length
    return {
      name,
      total,
      weeksWorked,
      share: weeksWorked / Math.max(weeks.length, 1),
      peak: Math.max(...hours[pi]),
      // a person doing overtime most weeks is not covering, they are the rota
      habitual: weeksWorked / Math.max(weeks.length, 1) >= 0.6,
      extraShare: total / Math.max(contractedHours * weeks.length, 1),
    }
  })
  const max = Math.max(1, ...hours.flat())
  const total = rows.reduce((a, r) => a + r.total, 0)
  const habitual = rows.filter((r) => r.habitual)
  const habitualHours = habitual.reduce((a, r) => a + r.total, 0)
  const fte = total / Math.max(contractedHours * weeks.length, 1)

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background pr-2 text-left font-normal text-muted-foreground">person</th>
              {weeks.map((w) => (
                <th key={w} className="px-1 pb-1 font-normal text-muted-foreground">
                  {w}
                </th>
              ))}
              <th className="pl-2 text-right font-normal text-muted-foreground">total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, pi) => (
              <tr key={r.name}>
                <td className="sticky left-0 bg-background pr-2 whitespace-nowrap">
                  <span aria-hidden className="mr-1 text-muted-foreground">
                    {r.habitual ? "~" : "·"}
                  </span>
                  {r.name}
                </td>
                {weeks.map((w, wi) => {
                  const v = hours[pi][wi]
                  return (
                    <td key={w} className="p-px">
                      <div
                        className="flex h-6 items-center justify-center rounded-[2px]"
                        style={{ background: v > 0 ? `color-mix(in oklch, currentColor ${clamp((v / max) * 80, 8, 80).toFixed(0)}%, transparent)` : "transparent" }}
                        title={`${r.name} · ${w}: ${v} hours`}
                      >
                        <span className={v / max > 0.6 ? "text-background" : undefined}>{v || ""}</span>
                      </div>
                    </td>
                  )
                })}
                <td className="pl-2 text-right font-medium">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A ~ marks somebody doing overtime in most weeks, which is not cover — it is the rota, and it is the finding a
        monthly total hides · {habitual.length} of {rows.length}{" "}
        {plural(habitual.length, "person accounts", "people account")} for{" "}
        {((habitualHours / Math.max(total, 1)) * 100).toFixed(0)}% of {total} overtime hours · that is{" "}
        {fte.toFixed(2)} full-time equivalents being bought at overtime rates rather than hired, which is the
        comparison this table exists to make
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PayrollDrift — where people actually sit against the published
 * scale, with the COMPRESSION derived. A scale is a policy and a
 * payroll is a history of exceptions.
 * ------------------------------------------------------------------ */
export function PayrollDrift({
  grades,
  className = "",
}: {
  grades: { name: string; min: number; max: number; salaries: number[] }[]
  className?: string
}) {
  const rows = grades.map((g) => {
    const n = g.salaries.length
    const mean = g.salaries.reduce((a, v) => a + v, 0) / Math.max(n, 1)
    const above = g.salaries.filter((s) => s > g.max).length
    const below = g.salaries.filter((s) => s < g.min).length
    return {
      ...g,
      n,
      mean,
      above,
      below,
      // where in the band the average person sits: 0.5 is the design intent
      compaRatio: (mean - g.min) / Math.max(g.max - g.min, 1e-9),
    }
  })
  const lo = Math.min(...rows.map((r) => Math.min(r.min, ...r.salaries)))
  const hi = Math.max(...rows.map((r) => Math.max(r.max, ...r.salaries)))
  const px = (v: number) => ((v - lo) / Math.max(hi - lo, 1e-9)) * 100
  // grades whose bands overlap, which is where a promotion stops paying
  const overlaps = rows.slice(1).filter((r, i) => r.min < rows[i].max)
  const outOfBand = rows.reduce((a, r) => a + r.above + r.below, 0)
  const people = rows.reduce((a, r) => a + r.n, 0)
  const topHeavy = rows.filter((r) => r.compaRatio > 0.65)

  return (
    <div className={className}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {money(r.min)}–{money(r.max)} · {r.n} {plural(r.n, "person", "people")} · compa{" "}
                {r.compaRatio.toFixed(2)}
              </span>
            </div>
            <div className="relative mt-0.5 h-6">
              <span
                className="absolute inset-y-2 rounded-[2px] bg-foreground/12"
                style={{ left: `${px(r.min)}%`, width: `${Math.max(px(r.max) - px(r.min), 0.6)}%` }}
                title={`band ${money(r.min)}–${money(r.max)}`}
              />
              {r.salaries.map((s, i) => (
                <span
                  key={i}
                  className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground"
                  style={{
                    left: `${clamp(px(s), 1, 99)}%`,
                    background: s > r.max || s < r.min ? "var(--background)" : "currentColor",
                  }}
                  title={`${money(s)}${s > r.max ? " — above the band" : s < r.min ? " — below the band" : ""}`}
                />
              ))}
              <span className="absolute inset-y-1 w-0.5 bg-foreground/70" style={{ left: `${clamp(px(r.mean), 0, 99)}%` }} title={`mean ${money(r.mean)}`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              mean {money(r.mean)}
              {r.above > 0 ? ` · ${r.above} above the band` : ""}
              {r.below > 0 ? ` · ${r.below} below it` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hollow dots are people OUTSIDE their own band — {outOfBand} of {people}, which is the history of exceptions a
        published scale does not contain · the compa-ratio is derived per grade and{" "}
        {topHeavy.length > 0
          ? `${topHeavy.length} ${plural(topHeavy.length, "grade sits", "grades sit")} above 0.65, which is a grade with nowhere left to give a rise`
          : "no grade is top-heavy, so every grade still has room to reward somebody"}{" "}
        ·{" "}
        {overlaps.length > 0
          ? `${overlaps.length} pair${overlaps.length === 1 ? "" : "s"} of adjacent bands OVERLAP, so a promotion into the bottom of the next grade can pay less than staying put`
          : "no adjacent bands overlap, so every promotion is a rise"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PensionOptOut — who opts out, by age and salary band, with the
 * FORGONE EMPLOYER CONTRIBUTION derived. Opting out is a decision
 * about this month's pay and it is priced over a career.
 * ------------------------------------------------------------------ */
export function PensionOptOut({
  bands,
  employerRate,
  yearsToRetirement,
  realReturn = 0.03,
  className = "",
}: {
  bands: { name: string; headcount: number; optedOut: number; meanSalary: number; meanAge: number }[]
  employerRate: number
  yearsToRetirement: (age: number) => number
  realReturn?: number
  className?: string
}) {
  const rows = bands.map((b) => {
    const rate = b.optedOut / Math.max(b.headcount, 1)
    const annual = b.meanSalary * employerRate
    const years = Math.max(0, yearsToRetirement(b.meanAge))
    // the employer contribution compounded over the years left, per person
    const compounded =
      realReturn > 0 ? annual * ((Math.pow(1 + realReturn, years) - 1) / realReturn) : annual * years
    return { ...b, rate, annual, years, compounded, forgone: compounded * b.optedOut }
  })
  const headcount = rows.reduce((a, r) => a + r.headcount, 0)
  const out = rows.reduce((a, r) => a + r.optedOut, 0)
  const forgone = rows.reduce((a, r) => a + r.forgone, 0)
  const max = Math.max(...rows.map((r) => r.rate))
  const worst = rows.reduce((a, r) => (r.rate > a.rate ? r : a), rows[0])
  const costliest = rows.reduce((a, r) => (r.compounded > a.compounded ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.optedOut} of {r.headcount} out · mean {money(r.meanSalary)}, age {r.meanAge.toFixed(0)}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(r.rate / max) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: "1px solid currentColor",
                  outlineOffset: -1,
                }}
                title={`${(r.rate * 100).toFixed(0)}% opted out`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.rate * 100).toFixed(0)}% opted out · {money(r.annual)} of employer money a year each, worth{" "}
              {money(r.compounded)} by retirement over {r.years.toFixed(0)} years
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is the opt-out RATE and the figure under it is what that person walks away from, COMPOUNDED to
        retirement at {(realReturn * 100).toFixed(0)}% real — an opt-out is a decision about this month's pay and it
        is priced over a career · {out} of {headcount}{" "}
        {plural(out, "person has", "people have")} opted out, {money(forgone)} of employer contribution forgone ·{" "}
        {worst.name} has the highest rate at {(worst.rate * 100).toFixed(0)}% and{" "}
        {costliest.name} the most to lose per person at {money(costliest.compounded)},{" "}
        {worst.name === costliest.name ? "which is the same band and makes it the one to talk to" : "which are different bands"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SalarySacrifice — what a sacrifice is worth to the employee and to
 * the employer, side by side. It is presented as a benefit and it is
 * a trade, and both halves are computable.
 * ------------------------------------------------------------------ */
export function SalarySacrifice({
  schemes,
  salary,
  marginalTaxRate,
  employeeNiRate,
  employerNiRate,
  className = "",
}: {
  schemes: { name: string; monthlyAmount: number; retailPrice?: number }[]
  salary: number
  marginalTaxRate: number
  employeeNiRate: number
  employerNiRate: number
  className?: string
}) {
  const rows = schemes
    .map((s) => {
      const annual = s.monthlyAmount * 12
      const employeeSaving = annual * (marginalTaxRate + employeeNiRate)
      const employerSaving = annual * employerNiRate
      const netCost = annual - employeeSaving
      const retail = s.retailPrice ?? annual
      return {
        ...s,
        annual,
        employeeSaving,
        employerSaving,
        netCost,
        retail,
        // against buying the same thing out of taxed pay
        versusRetail: retail - netCost,
        effectiveDiscount: (retail - netCost) / Math.max(retail, 1e-9),
      }
    })
    .sort((a, b) => b.effectiveDiscount - a.effectiveDiscount)
  const max = Math.max(...rows.map((r) => r.retail))
  const totalEmployer = rows.reduce((a, r) => a + r.employerSaving, 0)
  const totalEmployee = rows.reduce((a, r) => a + r.versusRetail, 0)
  const afterAll = salary - rows.reduce((a, r) => a + r.annual, 0)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {money(r.monthlyAmount)}/mo · {money(r.annual)} sacrificed
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/22" style={{ width: `${(r.retail / max) * 100}%` }} title={`buying it out of taxed pay: ${money(r.retail)}`} />
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground" style={{ width: `${(r.netCost / max) * 100}%` }} title={`net cost through the scheme: ${money(r.netCost)}`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              costs {money(r.netCost)} instead of {money(r.retail)}, {(r.effectiveDiscount * 100).toFixed(0)}% off ·
              the employer keeps {money(r.employerSaving)} of national insurance
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is what the same thing costs bought out of taxed pay and solid is the net cost through the scheme, so
        the gap is the real benefit — {money(totalEmployee)} a year to the employee at a{" "}
        {((marginalTaxRate + employeeNiRate) * 100).toFixed(0)}% combined marginal rate · the employer's side is
        derived too and is rarely mentioned: {money(totalEmployer)} of national insurance saved on the same
        arrangement · a {money(salary)} salary becomes {money(afterAll)} of reference pay, which is the figure a
        mortgage lender and a redundancy calculation both use
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CostToEmploy — the multiple over salary an employer really pays,
 * by role. A budget is written in salaries and spent in total cost,
 * and the multiple is not the same for every role.
 * ------------------------------------------------------------------ */
export function CostToEmploy({
  roles,
  className = "",
}: {
  roles: {
    name: string
    salary: number
    employerNi: number
    pension: number
    benefits: number
    equipment: number
    space: number
    training: number
  }[]
  className?: string
}) {
  const extras: [keyof (typeof roles)[number], string, string][] = [
    ["employerNi", "Employer NI", "currentColor"],
    ["pension", "Pension", "color-mix(in oklch, currentColor 58%, transparent)"],
    ["benefits", "Benefits", "color-mix(in oklch, currentColor 34%, transparent)"],
    ["equipment", "Equipment", "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)"],
    ["space", "Space", "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 6px)"],
    ["training", "Training", "color-mix(in oklch, currentColor 16%, transparent)"],
  ]
  const rows = roles
    .map((r) => {
      const on = extras.reduce((a, [k]) => a + (r[k] as number), 0)
      return { ...r, on, total: r.salary + on, multiple: (r.salary + on) / Math.max(r.salary, 1) }
    })
    .sort((a, b) => b.multiple - a.multiple)
  const max = Math.max(...rows.map((r) => r.total))
  const salaries = rows.reduce((a, r) => a + r.salary, 0)
  const totals = rows.reduce((a, r) => a + r.total, 0)
  const blended = totals / Math.max(salaries, 1)
  const highest = rows[0]
  const lowest = rows[rows.length - 1]

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {money(r.salary)} salary → {money(r.total)} · ×{r.multiple.toFixed(2)}
              </span>
            </div>
            <div className="mt-0.5 flex h-4 rounded-[2px] border border-foreground/20" style={{ width: `${(r.total / max) * 100}%` }}>
              <div
                className="rounded-l-[2px] bg-foreground/12"
                style={{ width: `${(r.salary / Math.max(r.total, 1)) * 100}%` }}
                title={`salary ${money(r.salary)}`}
              />
              {extras.map(([k, label, bg]) => (
                <div
                  key={label}
                  className="min-w-0 last:rounded-r-[2px]"
                  style={{ width: `${((r[k] as number) / Math.max(r.total, 1)) * 100}%`, background: bg }}
                  title={`${label}: ${money(r[k] as number)}`}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25 bg-foreground/12" />
          Salary
        </span>
        {extras.map(([, label, bg]) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25" style={{ background: bg }} />
            {label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The MULTIPLE over salary is derived per role and is not a constant — {highest.name} costs ×
        {highest.multiple.toFixed(2)} and {lowest.name} ×{lowest.multiple.toFixed(2)}, so a headcount budget written
        in salaries under-provides for one and over-provides for the other · {money(salaries)} of salary is{" "}
        {money(totals)} of cost, ×{blended.toFixed(2)} blended · the fixed items — equipment, space, training — are
        the reason the multiple falls as salary rises
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PayrunVariance — this run against the last, with every movement
 * ATTRIBUTED. A payroll that moved 3% is normal and a payroll that
 * moved 3% for six different reasons is a control question.
 * ------------------------------------------------------------------ */
export function PayrunVariance({
  previousTotal,
  movements,
  toleranceShare = 0.005,
  className = "",
}: {
  previousTotal: number
  /** each attributed movement, signed */
  movements: { name: string; amount: number; headcount?: number }[]
  /** the share of the run below which a movement is not worth chasing */
  toleranceShare?: number
  className?: string
}) {
  const explained = movements.reduce((a, m) => a + m.amount, 0)
  const current = previousTotal + explained
  const rows = [...movements].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  const max = Math.max(...rows.map((r) => Math.abs(r.amount)))
  const tolerance = previousTotal * toleranceShare
  const material = rows.filter((r) => Math.abs(r.amount) > tolerance)
  const up = rows.filter((r) => r.amount > 0).reduce((a, r) => a + r.amount, 0)
  const down = rows.filter((r) => r.amount < 0).reduce((a, r) => a + r.amount, 0)
  // movements in one run span two orders of magnitude and money() changes
  // format at £10k, so a column reads "£125.7k" against "£9,100" and the two
  // cannot be compared by eye — the whole column goes to thousands when any
  // one of them needs to
  const fmt =
    max >= 1e4 ? (v: number) => `${v < 0 ? "−" : ""}£${(Math.abs(v) / 1e3).toFixed(1)}k` : money

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between text-[11px]">
        <span className="text-muted-foreground">Last run {money(previousTotal)}</span>
        <span className="tabular-nums">
          this run {money(current)} ·{" "}
          {explained >= 0 ? "+" : ""}
          {((explained / Math.max(previousTotal, 1)) * 100).toFixed(2)}%
        </span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span aria-hidden className="w-3">
              {Math.abs(r.amount) > tolerance ? "!" : "·"}
            </span>
            <span className="w-32 shrink-0 truncate">{r.name}</span>
            <div className="relative h-3.5 flex-1 rounded-[1px] bg-muted">
              <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/45" />
              <div
                className="absolute inset-y-0"
                style={{
                  left: r.amount >= 0 ? "50%" : `${50 - (Math.abs(r.amount) / max) * 50}%`,
                  width: `${(Math.abs(r.amount) / max) * 50}%`,
                  background:
                    r.amount >= 0
                      ? "currentColor"
                      : "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 4px)",
                  outline: r.amount < 0 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`${money(r.amount)}`}
              />
            </div>
            <span className="w-32 shrink-0 text-right text-muted-foreground">
              {r.amount >= 0 ? "+" : ""}
              {fmt(r.amount)}
              {r.headcount !== undefined ? ` · ${r.headcount} ${plural(r.headcount, "person", "people")}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Every movement is ATTRIBUTED, so the run reconciles rather than merely differing — {fmt(up)} up against{" "}
        {fmt(Math.abs(down))} down nets to {fmt(explained)} · {material.length} of {rows.length}{" "}
        {plural(material.length, "movement is", "movements are")} above the{" "}
        {(toleranceShare * 100).toFixed(1)}% materiality line and worth a query; the rest are noise and chasing them
        is how a payroll close overruns · a run that moved{" "}
        {Math.abs((explained / Math.max(previousTotal, 1)) * 100).toFixed(2)}% for one reason is normal and the same
        move for {rows.length} reasons is a control question
      </p>
    </div>
  )
}
