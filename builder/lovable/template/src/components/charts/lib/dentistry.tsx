/**
 * Dental practice primitives — periodontal charting, chair utilisation,
 * recall compliance, treatment plan value, radiograph intervals and
 * caries risk.
 *
 * The disease burden a pocket chart adds up to, the share of a session
 * actually treating, the recall interval a patient really keeps, the value
 * that never gets accepted, the exposure an interval implies and the risk a
 * set of factors produces are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) =>
  "£" + (Math.abs(v) < 10 ? Math.abs(v).toFixed(2) : Math.round(Math.abs(v)).toLocaleString("en-GB"))

/* ------------------------------------------------------------------ *
 * PerioChart — pocket depths around each tooth, with the BURDEN
 * derived. A chart of numbers is what gets recorded; the share of
 * sites over 4 mm is what decides a treatment plan.
 * ------------------------------------------------------------------ */
export function PerioChart({
  teeth,
  threshold = 4,
  className = "",
}: {
  /** six sites per tooth, in millimetres, plus bleeding on probing */
  teeth: { id: string; depths: number[]; bleeding: boolean[] }[]
  threshold?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!teeth.length) return null

  const rows = teeth.map((t) => {
    const deep = t.depths.filter((d) => d >= threshold).length
    const bop = t.bleeding.filter(Boolean).length
    return { ...t, deep, bop, max: Math.max(...t.depths), mean: t.depths.reduce((a, d) => a + d, 0) / Math.max(t.depths.length, 1) }
  })
  const sites = rows.reduce((a, r) => a + r.depths.length, 0)
  const deepSites = rows.reduce((a, r) => a + r.deep, 0)
  const bopSites = rows.reduce((a, r) => a + r.bop, 0)
  const worst = rows.reduce((a, r) => (r.deep > a.deep ? r : a), rows[0])
  const maxDepth = Math.max(...rows.map((r) => r.max))

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <div className="flex gap-1">
          {rows.map((t) => (
            <div key={t.id} className="flex min-w-0 flex-1 flex-col items-center" style={{ minWidth: 22 }}>
              <div className="flex items-end gap-px" style={{ height: 54 }}>
                {t.depths.map((d, i) => (
                  <div key={i} className="relative w-1" style={{ height: "100%" }} title={`${t.id} site ${i + 1}: ${d} mm${t.bleeding[i] ? ", bleeding" : ""}`}>
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-t-[1px]"
                      style={{
                        height: `${(d / Math.max(maxDepth, 1)) * 100}%`,
                        background: d >= threshold ? "currentColor" : "color-mix(in oklch, currentColor 30%, transparent)",
                      }}
                    />
                    {/* bleeding is a SECOND fact about the same site, so it is a
                        mark rather than a different fill on the same bar */}
                    {t.bleeding[i] && <span className="absolute inset-x-0 top-0 h-1 rounded-[1px] bg-foreground" />}
                  </div>
                ))}
              </div>
              <span className="mt-0.5 text-[8px] tabular-nums text-muted-foreground">{t.id}</span>
            </div>
          ))}
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Sites ≥{threshold} mm</dt>
          <dd className="font-medium tabular-nums">{((deepSites / Math.max(sites, 1)) * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Bleeding</dt>
          <dd className="font-medium tabular-nums">{((bopSites / Math.max(sites, 1)) * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Deepest</dt>
          <dd className="font-medium tabular-nums">{maxDepth} mm</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Worst tooth</dt>
          <dd className="font-medium tabular-nums">{worst.id}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A bar per SITE, six to a tooth, with a mark above any that bled — depth and bleeding are two facts about the
        same site and a single fill cannot carry both · {deepSites} of {sites} sites are at or over {threshold} mm,{" "}
        {((deepSites / Math.max(sites, 1)) * 100).toFixed(0)}%, which is the number a treatment plan is written from ·
        bleeding at {((bopSites / Math.max(sites, 1)) * 100).toFixed(0)}% of sites is the ACTIVITY, and a deep pocket
        that does not bleed is a scar rather than a problem
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ChairUtilisation — what a session was actually spent on. Chair
 * time is the practice's only real capacity, and the share of it
 * spent treating is derived rather than assumed from the diary.
 * ------------------------------------------------------------------ */
export function ChairUtilisation({
  sessions,
  hourlyCost,
  className = "",
}: {
  sessions: {
    name: string
    minutes: number
    treating: number
    turnaround: number
    admin: number
    /** minutes the chair sat empty because someone did not come */
    fta: number
  }[]
  hourlyCost?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!sessions.length) return null

  const rows = sessions.map((s) => {
    const idle = Math.max(0, s.minutes - s.treating - s.turnaround - s.admin - s.fta)
    return { ...s, idle, utilisation: s.treating / Math.max(s.minutes, 1) }
  })
  const total = rows.reduce((a, r) => a + r.minutes, 0)
  const treating = rows.reduce((a, r) => a + r.treating, 0)
  const fta = rows.reduce((a, r) => a + r.fta, 0)
  const parts: [keyof (typeof rows)[number], string, string][] = [
    ["treating", "Treating", "currentColor"],
    ["turnaround", "Turnaround", "color-mix(in oklch, currentColor 45%, transparent)"],
    ["admin", "Admin", "color-mix(in oklch, currentColor 22%, transparent)"],
    ["fta", "Failed to attend", "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"],
    ["idle", "Idle", "transparent"],
  ]
  const max = Math.max(...rows.map((r) => r.minutes))
  const worst = rows.reduce((a, r) => (r.utilisation < a.utilisation ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.minutes} min · {(r.utilisation * 100).toFixed(0)}% treating
              </span>
            </div>
            <div className="mt-0.5 flex h-4 rounded-[2px] border border-foreground/20" style={{ width: `${(r.minutes / max) * 100}%` }}>
              {parts.map(([k, label, bg]) => (
                <div
                  key={label}
                  className="min-w-0 first:rounded-l-[2px] last:rounded-r-[2px]"
                  style={{ width: `${((r[k] as number) / Math.max(r.minutes, 1)) * 100}%`, background: bg }}
                  title={`${label}: ${r[k] as number} min`}
                />
              ))}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.treating} treating · {r.turnaround} turnaround · {r.admin} admin
              {r.fta > 0 ? ` · ${r.fta} lost to a no-show` : ""}
              {r.idle > 0 ? ` · ${r.idle} idle` : ""}
            </span>
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
        Chair time is the practice's only real capacity, and {((treating / Math.max(total, 1)) * 100).toFixed(0)}% of{" "}
        {total} minutes was spent treating · {fta} minutes went to people who did not come
        {hourlyCost ? `, which is ${money((fta / 60) * hourlyCost)} of chair` : ""}, and that time cannot be sold
        afterwards · {worst.name.toLowerCase()} is the weakest session at{" "}
        {(worst.utilisation * 100).toFixed(0)}%, which is a diary problem rather than a clinical one
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RecallCompliance — the interval a patient is BOOKED at against the
 * one they actually keep. A recall policy is a number in the notes
 * and the real interval is what the appointment book produces.
 * ------------------------------------------------------------------ */
export function RecallCompliance({
  cohorts,
  className = "",
}: {
  /** the assigned recall in months and the actual gaps observed */
  cohorts: { name: string; assignedMonths: number; actualMonths: number[] }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!cohorts.length) return null

  const rows = cohorts.map((c) => {
    const sorted = [...c.actualMonths].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const onTime = c.actualMonths.filter((m) => m <= c.assignedMonths * 1.25).length
    const lapsed = c.actualMonths.filter((m) => m > c.assignedMonths * 2).length
    return {
      ...c,
      median,
      onTime: onTime / Math.max(c.actualMonths.length, 1),
      lapsed: lapsed / Math.max(c.actualMonths.length, 1),
      drift: median - c.assignedMonths,
    }
  })
  const maxM = Math.max(...rows.flatMap((r) => r.actualMonths))
  const worstDrift = rows.reduce((a, r) => (r.drift > a.drift ? r : a), rows[0])
  const allOnTime = rows.reduce((a, r) => a + r.onTime * r.actualMonths.length, 0) / Math.max(rows.reduce((a, r) => a + r.actualMonths.length, 0), 1)

  return (
    <div className={className}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                booked {r.assignedMonths} months · median {r.median} · {r.actualMonths.length} patients
              </span>
            </div>
            {/* one mark per patient at their own interval, so the SPREAD is
                visible — a median alone hides a bimodal recall completely */}
            <div className="relative mt-1 h-6 rounded-[2px] bg-muted">
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(r.assignedMonths / maxM) * 100}%` }} title={`assigned ${r.assignedMonths} months`} />
              {r.actualMonths.map((m, i) => (
                <span
                  key={i}
                  className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground"
                  style={{
                    left: `${clamp((m / maxM) * 100, 1, 99)}%`,
                    background: m <= r.assignedMonths * 1.25 ? "currentColor" : "var(--background)",
                  }}
                  title={`${m} months`}
                />
              ))}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.onTime * 100).toFixed(0)}% within a quarter of the interval · {(r.lapsed * 100).toFixed(0)}% at more
              than double it · median drifts {r.drift >= 0 ? "+" : ""}
              {r.drift} months
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The mark is the interval ASSIGNED and every dot is a patient's actual gap, filled where they kept it — a policy
        is a number in the notes and this is what the appointment book produced ·{" "}
        {(allOnTime * 100).toFixed(0)}% attend within a quarter of their interval ·{" "}
        {worstDrift.name.toLowerCase()} drifts furthest at {worstDrift.drift >= 0 ? "+" : ""}
        {worstDrift.drift} months, and a recall shortened on paper without changing the reminder simply moves the mark,
        never the dots
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * TreatmentPlanValue — planned against accepted against completed.
 * The gap between planned and accepted is a conversation; the gap
 * between accepted and completed is a diary, and they need different
 * fixes.
 * ------------------------------------------------------------------ */
export function TreatmentPlanValue({
  categories,
  className = "",
}: {
  categories: { name: string; planned: number; accepted: number; completed: number }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!categories.length) return null

  const rows = [...categories]
    .map((c) => ({
      ...c,
      acceptance: c.accepted / Math.max(c.planned, 1),
      conversion: c.completed / Math.max(c.accepted, 1),
      lostToTalk: c.planned - c.accepted,
      lostToDiary: c.accepted - c.completed,
    }))
    .sort((a, b) => b.planned - a.planned)
  const planned = rows.reduce((a, r) => a + r.planned, 0)
  const accepted = rows.reduce((a, r) => a + r.accepted, 0)
  const completed = rows.reduce((a, r) => a + r.completed, 0)
  const max = Math.max(...rows.map((r) => r.planned))
  const worstTalk = rows.reduce((a, r) => (r.lostToTalk > a.lostToTalk ? r : a), rows[0])
  const worstDiary = rows.reduce((a, r) => (r.lostToDiary > a.lostToDiary ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {money(r.planned)} planned · {(r.acceptance * 100).toFixed(0)}% accepted ·{" "}
                {(r.conversion * 100).toFixed(0)}% done
              </span>
            </div>
            {/* three nested widths on ONE scale, so the two gaps are the two
                visible steps rather than three numbers to subtract */}
            <div className="relative mt-0.5 h-5 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/18" style={{ width: `${(r.planned / max) * 100}%` }} title={`planned ${money(r.planned)}`} />
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/45" style={{ width: `${(r.accepted / max) * 100}%` }} title={`accepted ${money(r.accepted)}`} />
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground" style={{ width: `${(r.completed / max) * 100}%` }} title={`completed ${money(r.completed)}`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.lostToTalk)} never accepted · {money(r.lostToDiary)} accepted and not done
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Three widths on one scale: planned, accepted, completed · {money(planned - accepted)} of{" "}
        {money(planned)} was never accepted and {money(accepted - completed)} was accepted and never done — the first
        is a CONVERSATION and the second is a DIARY, and a single "conversion rate" merges two problems with different
        fixes · {worstTalk.name.toLowerCase()} loses most at the discussion and{" "}
        {worstDiary.name.toLowerCase()} loses most after it · {((completed / Math.max(planned, 1)) * 100).toFixed(0)}%
        of what was planned reached the patient
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RadiographInterval — the exposure a recall interval implies over a
 * lifetime, by risk group. The dose from one film is trivial and the
 * decision is about a schedule, which nobody adds up.
 * ------------------------------------------------------------------ */
export function RadiographInterval({
  groups,
  years,
  backgroundUsvPerYear = 2700,
  className = "",
}: {
  /** each risk group's interval in months and the dose per set */
  groups: { name: string; intervalMonths: number; usvPerSet: number; patients: number }[]
  years: number
  /** natural background for comparison, µSv a year */
  backgroundUsvPerYear?: number
  className?: string
}) {
  const rows = groups.map((g) => {
    const sets = Math.floor((years * 12) / Math.max(g.intervalMonths, 1))
    const dose = sets * g.usvPerSet
    return { ...g, sets, dose, daysOfBackground: (dose / Math.max(backgroundUsvPerYear, 1)) * 365 }
  })
  const max = Math.max(...rows.map((r) => r.dose))
  const totalPatients = rows.reduce((a, r) => a + r.patients, 0)
  const populationDose = rows.reduce((a, r) => a + r.dose * r.patients, 0)
  const highest = rows.reduce((a, r) => (r.dose > a.dose ? r : a), rows[0])
  const lowest = rows.reduce((a, r) => (r.dose < a.dose ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                every {r.intervalMonths} months · {r.usvPerSet} µSv a set · {r.patients} patients
              </span>
            </div>
            <div className="mt-0.5 flex h-4 gap-px">
              {/* one block per exposure over the period, which is what a
                  schedule actually is — a dose figure alone hides the count */}
              {Array.from({ length: Math.min(r.sets, 40) }, (_, i) => (
                <span key={i} className="h-full w-2 rounded-[1px] bg-foreground/65" />
              ))}
              {r.sets > 40 && <span className="self-center pl-1 text-[9px] text-muted-foreground">+{r.sets - 40}</span>}
            </div>
            <div className="mt-1 h-2 rounded-[1px] bg-muted">
              <div className="h-full rounded-[1px] bg-foreground" style={{ width: `${(r.dose / max) * 100}%` }} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.sets} sets over {years} years · {r.dose.toLocaleString()} µSv ·{" "}
              {r.daysOfBackground.toFixed(0)} days of natural background
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Each block is one exposure and the bar is the cumulative dose — the dose from a single film is trivial and the
        decision being made is about a SCHEDULE, which is the sum nobody adds up · over {years} years{" "}
        {highest.name.toLowerCase()} receives {highest.dose.toLocaleString()} µSv against{" "}
        {lowest.dose.toLocaleString()} for {lowest.name.toLowerCase()},{" "}
        {(highest.dose / Math.max(lowest.dose, 1)).toFixed(1)}× as much · that is{" "}
        {highest.daysOfBackground.toFixed(0)} days of natural background, which is the comparison that makes the
        number mean anything · {totalPatients} patients carry {(populationDose / 1000).toFixed(0)} mSv between them
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CariesRisk — the factors behind a risk category. A patient is
 * filed as high or low risk and the category is what drives recall;
 * this shows which factors put them there and which are modifiable.
 * ------------------------------------------------------------------ */
export function CariesRisk({
  patients,
  factors,
  className = "",
}: {
  patients: { name: string; scores: number[] }[]
  /** each factor's weight and whether the patient can change it */
  factors: { name: string; weight: number; modifiable: boolean }[]
  className?: string
}) {
  const totalWeight = factors.reduce((a, f) => a + f.weight, 0)
  const rows = patients
    .map((p) => {
      const risk = p.scores.reduce((a, s, i) => a + s * factors[i].weight, 0) / Math.max(totalWeight, 1)
      const modifiable = p.scores.reduce((a, s, i) => a + (factors[i].modifiable ? s * factors[i].weight : 0), 0) / Math.max(totalWeight, 1)
      return {
        ...p,
        risk,
        modifiable,
        fixed: risk - modifiable,
        band: risk >= 0.66 ? "high" : risk >= 0.33 ? "moderate" : "low",
      }
    })
    .sort((a, b) => b.risk - a.risk)
  const high = rows.filter((r) => r.band === "high")
  const isAre = (n: number) => (n === 1 ? "is" : "are")
  const mostFixable = rows.reduce((a, r) => (r.modifiable > a.modifiable ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.band} · {(r.risk * 100).toFixed(0)}
              </span>
            </div>
            <div className="mt-0.5 flex h-4 rounded-[2px] bg-muted">
              <div className="rounded-l-[2px] bg-foreground" style={{ width: `${r.fixed * 100}%` }} title={`not modifiable: ${(r.fixed * 100).toFixed(0)}`} />
              <div
                className="rounded-r-[2px]"
                style={{
                  width: `${r.modifiable * 100}%`,
                  background: "repeating-linear-gradient(45deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: r.modifiable > 0 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`modifiable: ${(r.modifiable * 100).toFixed(0)}`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.modifiable * 100).toFixed(0)} of {(r.risk * 100).toFixed(0)} points are things this patient can
              change ·{" "}
              {r.scores
                .map((s, i) => (s > 0.5 ? factors[i].name : null))
                .filter(Boolean)
                .join(", ") || "no factor is strongly present"}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {factors.map((f) => (
          <span key={f.name} className={f.modifiable ? "" : "opacity-60"}>
            {f.modifiable ? "~" : "·"} {f.name} ×{f.weight}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched is the part of the score a patient can actually CHANGE, which is the half that turns a risk category
        into a conversation — a filed category drives the recall interval and says nothing about what to do ·{" "}
        {high.length} of {rows.length} patients {isAre(high.length)} high risk, and{" "}
        {mostFixable.name} has the most modifiable score at{" "}
        {(mostFixable.modifiable * 100).toFixed(0)} points · a fixed factor such as past experience never improves, so
        a patient whose bar is mostly solid stays high risk however well the appointment goes
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ProcedureMix — the practice's income by procedure against the
 * chair time it consumes. Revenue ranks the big items and revenue
 * PER HOUR ranks what the practice should be doing more of.
 * ------------------------------------------------------------------ */
export function ProcedureMix({
  procedures,
  chairCostPerHour,
  className = "",
}: {
  procedures: { name: string; count: number; feeEach: number; minutesEach: number; labEach?: number }[]
  chairCostPerHour?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!procedures.length) return null

  const rows = procedures
    .map((p) => {
      const revenue = p.count * p.feeEach
      const hours = (p.count * p.minutesEach) / 60
      const lab = p.count * (p.labEach ?? 0)
      const perHour = (revenue - lab) / Math.max(hours, 1e-9)
      return { ...p, revenue, hours, lab, perHour, margin: chairCostPerHour === undefined ? null : perHour - chairCostPerHour }
    })
    .sort((a, b) => b.perHour - a.perHour)
  const byRevenue = [...rows].sort((a, b) => b.revenue - a.revenue)
  const revenue = rows.reduce((a, r) => a + r.revenue, 0)
  const hours = rows.reduce((a, r) => a + r.hours, 0)
  const blended = (revenue - rows.reduce((a, r) => a + r.lab, 0)) / Math.max(hours, 1e-9)
  const maxRate = Math.max(...rows.map((r) => r.perHour))
  const losing = chairCostPerHour === undefined ? [] : rows.filter((r) => r.perHour < chairCostPerHour)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.count} × {money(r.feeEach)} · {r.minutesEach} min
                {r.labEach ? ` · ${money(r.labEach)} lab` : ""}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(r.perHour / maxRate) * 100}%`,
                  background:
                    chairCostPerHour !== undefined && r.perHour < chairCostPerHour
                      ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                      : "color-mix(in oklch, currentColor 58%, transparent)",
                  outline: chairCostPerHour !== undefined && r.perHour < chairCostPerHour ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`${money(r.perHour)} an hour`}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${clamp((blended / maxRate) * 100, 0, 100)}%` }} title={`blended ${money(blended)}`} />
              {chairCostPerHour !== undefined && (
                <span className="absolute inset-y-0 w-px bg-foreground/45" style={{ left: `${clamp((chairCostPerHour / maxRate) * 100, 0, 100)}%` }} title={`chair cost ${money(chairCostPerHour)}`} />
              )}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.perHour)} an hour · {money(r.revenue)} over {r.hours.toFixed(1)} hours
              {r.margin !== null ? ` · ${r.margin >= 0 ? "+" : ""}${money(r.margin)} against the chair` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Bars are revenue PER CHAIR HOUR after lab costs, which is what a practice actually sells — {byRevenue[0].name}{" "}
        earns the most money at {money(byRevenue[0].revenue)} and {rows[0].name.toLowerCase()} earns the most per hour
        at {money(rows[0].perHour)}, and they are{" "}
        {byRevenue[0].name === rows[0].name ? "the same item, which is unusually lucky" : "different items"} ·{" "}
        {money(revenue)} over {hours.toFixed(0)} chair hours, blended {money(blended)}
        {chairCostPerHour !== undefined
          ? ` · ${losing.length} procedure${losing.length === 1 ? "" : "s"} earn${losing.length === 1 ? "s" : ""} less than the ${money(chairCostPerHour)} the chair costs to run`
          : ""}
      </p>
    </div>
  )
}
