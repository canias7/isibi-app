/**
 * Collections-care primitives — cumulative light exposure, humidity cycling,
 * pest trapping, condition survey, loan schedule and visitor dwell.
 *
 * The lux-hours an object has actually accumulated, the amplitude and rate of
 * RH change (which damages more than the level), the trap trend against its own
 * baseline, the survey's priority ranking, the object's rest between loans and
 * the dwell distribution are all DERIVED. A display limit stated in lux says
 * nothing without the hours.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * LightExposure — cumulative lux-hours against the annual allowance,
 * because the limit is a dose and the lux level alone is not.
 * ------------------------------------------------------------------ */
export function LightExposure({
  objects,
  annualLimitLuxHours,
  className = "",
}: {
  objects: { name: string; lux: number; hoursPerDay: number; daysDisplayed: number; category?: string }[]
  /** the annual dose this material class may take */
  annualLimitLuxHours: number
  className?: string
}) {
  const rows = objects
    .map((o) => {
      const dose = o.lux * o.hoursPerDay * o.daysDisplayed
      const daysAllowed = annualLimitLuxHours / Math.max(o.lux * o.hoursPerDay, 1e-9)
      return { ...o, dose, daysAllowed, over: dose > annualLimitLuxHours }
    })
    .sort((a, b) => b.dose - a.dose)
  const max = Math.max(annualLimitLuxHours * 1.2, ...rows.map((r) => r.dose))
  const over = rows.filter((r) => r.over)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.lux} lux × {r.hoursPerDay} h × {r.daysDisplayed} days
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(r.dose / max) * 100}%`,
                  background: r.over ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 50%, transparent)",
                  outline: r.over ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${(annualLimitLuxHours / max) * 100}%` }} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {Math.round(r.dose).toLocaleString()} lux-hours ·{" "}
              {r.over
                ? `${Math.round(r.daysAllowed)} days was the allowance, ${r.daysDisplayed} were shown`
                : `${Math.round(r.daysAllowed - r.daysDisplayed)} more days available at this level`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The limit is a DOSE, so 50 lux for eight hours a day is the same damage as 200 lux for two — halving the level
        buys twice the display time and nothing else ·{" "}
        {over.length
          ? `${over.map((r) => r.name).join(", ")} exceeded the ${annualLimitLuxHours.toLocaleString()} lux-hour allowance`
          : "every object stays inside the annual allowance"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RhCycling — the amplitude and rate of humidity change, which damage
 * more than the mean the specification usually names.
 * ------------------------------------------------------------------ */
export function RhCycling({
  trace,
  targetRh,
  toleranceBand = 5,
  maxRatePerHour = 2,
  hoursPerSample = 1,
  height = 200,
  className = "",
}: {
  trace: number[]
  targetRh: number
  toleranceBand?: number
  /** the fastest change the material tolerates */
  maxRatePerHour?: number
  hoursPerSample?: number
  height?: number
  className?: string
}) {
  const mean = trace.reduce((a, v) => a + v, 0) / Math.max(trace.length, 1)
  const outside = trace.filter((v) => Math.abs(v - targetRh) > toleranceBand).length
  const rates = trace.map((v, i) => (i === 0 ? 0 : Math.abs(v - trace[i - 1]) / hoursPerSample))
  const tooFast = rates.filter((r) => r > maxRatePerHour).length
  const amplitude = Math.max(...trace) - Math.min(...trace)
  const lo = Math.min(...trace, targetRh - toleranceBand) - 3
  const hi = Math.max(...trace, targetRh + toleranceBand) + 3
  const px = (i: number) => (i / Math.max(1, trace.length - 1)) * 100
  const py = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <rect x={0} y={py(targetRh + toleranceBand)} width={100} height={py(targetRh - toleranceBand) - py(targetRh + toleranceBand)} fill="currentColor" opacity={0.1} />
          <line x1={0} y1={py(targetRh)} x2={100} y2={py(targetRh)} stroke="currentColor" strokeWidth={0.4} strokeDasharray="3 2" opacity={0.5} />
          <polyline points={trace.map((v, i) => `${px(i)},${py(v)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-3 gap-px">
          {rates.map((r, i) => (
            <span
              key={i}
              className="min-w-0 flex-1"
              style={{ background: r > maxRatePerHour ? "currentColor" : "transparent" }}
              title={`${r.toFixed(2)} %RH/h`}
            />
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 h</span>
        <span>{Math.round(trace.length * hoursPerSample)} h</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Mean</dt>
          <dd className="font-medium tabular-nums">{mean.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Amplitude</dt>
          <dd className="font-medium tabular-nums">{amplitude.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Outside band</dt>
          <dd className="font-medium tabular-nums">{((outside / Math.max(trace.length, 1)) * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Too fast</dt>
          <dd className="font-medium tabular-nums">{tooFast}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        The strip along the bottom marks every hour that moved faster than {maxRatePerHour} %RH ·{" "}
        {Math.abs(mean - targetRh) < 1
          ? `the mean sits on ${targetRh}% and would pass any specification written as a mean — but the amplitude is ${amplitude.toFixed(0)} points and ${tooFast} hours moved too fast, and it is the RATE that splits a panel`
          : `the mean is ${Math.abs(mean - targetRh).toFixed(1)} points off target and the amplitude is ${amplitude.toFixed(0)}`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PestTrapping — catches per trap over time, with each zone judged
 * against its OWN baseline rather than a single threshold.
 * ------------------------------------------------------------------ */
export function PestTrapping({
  zones,
  baselineWeeks = 8,
  height = 190,
  className = "",
}: {
  zones: { name: string; catches: number[]; species?: string }[]
  /** how many weeks at the start define normal for that zone */
  baselineWeeks?: number
  height?: number
  className?: string
}) {
  const rows = zones.map((z) => {
    const base = z.catches.slice(0, baselineWeeks)
    const mean = base.reduce((a, v) => a + v, 0) / Math.max(base.length, 1)
    const sd = Math.sqrt(base.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(base.length - 1, 1))
    const threshold = mean + 2 * Math.max(sd, 0.5)
    const alerts = z.catches.map((v, i) => (i >= baselineWeeks && v > threshold ? i : -1)).filter((i) => i >= 0)
    return { ...z, mean, sd, threshold, alerts, latest: z.catches[z.catches.length - 1] }
  })
  const weeks = Math.max(...zones.map((z) => z.catches.length))
  const max = Math.max(1, ...zones.flatMap((z) => z.catches))
  const alerting = rows.filter((r) => r.alerts.length > 0)

  return (
    <div className={className}>
      <ul className="space-y-2" style={{ minHeight: height }}>
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">
                {r.name}
                {r.species ? <span className="text-muted-foreground"> · {r.species}</span> : null}
              </span>
              <span className="tabular-nums text-muted-foreground">
                baseline {r.mean.toFixed(1)} ± {r.sd.toFixed(1)} · alert above {r.threshold.toFixed(1)}
              </span>
            </div>
            <div className="relative mt-0.5 flex h-8 items-end gap-px">
              {r.catches.map((v, i) => (
                <div
                  key={i}
                  className="min-w-0 flex-1 rounded-t-[1px]"
                  style={{
                    height: `${(v / max) * 100}%`,
                    background: i >= baselineWeeks && v > r.threshold ? "currentColor" : "color-mix(in oklch, currentColor 34%, transparent)",
                  }}
                  title={`week ${i + 1}: ${v}`}
                />
              ))}
              <span className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/60" style={{ bottom: `${(r.threshold / max) * 100}%` }} />
              <span className="pointer-events-none absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${(baselineWeeks / weeks) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Each zone is judged against its OWN first {baselineWeeks} weeks, because a store that always catches four is not
        the same as a gallery that has never caught one — a single site-wide threshold would flag the first and miss the
        second ·{" "}
        {alerting.length
          ? `${alerting.map((r) => r.name).join(", ")} broke ${alerting.length === 1 ? "its" : "their"} baseline, ${alerting[0].alerts.length} week${alerting[0].alerts.length === 1 ? "" : "s"} in`
          : "no zone has broken its baseline"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ConditionSurvey — condition against significance, with the treatment
 * priority DERIVED from both plus the work each needs.
 * ------------------------------------------------------------------ */
export function ConditionSurvey({
  objects,
  budgetHours,
  height = 210,
  className = "",
}: {
  objects: { name: string; condition: number; significance: number; treatmentHours: number }[]
  /** the conservation hours available this year */
  budgetHours: number
  height?: number
  className?: string
}) {
  // priority: significance × damage, per hour of work — the ranking a
  // conservator actually needs and the one a two-axis plot alone will not give
  const rows = objects
    .map((o) => ({ ...o, priority: (o.significance * (5 - o.condition)) / Math.max(o.treatmentHours, 1e-9) }))
    .sort((a, b) => b.priority - a.priority)
  let spent = 0
  const funded = rows.map((r) => {
    const fits = spent + r.treatmentHours <= budgetHours
    if (fits) spent += r.treatmentHours
    return { ...r, funded: fits }
  })
  const doneCount = funded.filter((f) => f.funded).length

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        {[1, 2, 3, 4].map((g) => (
          <span key={g} className="absolute inset-y-0 w-px bg-foreground/15" style={{ left: `${((g - 0.5) / 5) * 100}%` }} />
        ))}
        {funded.map((r) => (
          <span
            key={r.name}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${((r.condition - 0.5) / 5) * 100}%`,
              top: `${100 - ((r.significance - 0.5) / 5) * 100}%`,
              width: `${clamp(4 + r.treatmentHours / 6, 5, 20)}px`,
              height: `${clamp(4 + r.treatmentHours / 6, 5, 20)}px`,
              background: r.funded ? "currentColor" : "var(--background)",
              boxShadow: r.funded ? undefined : "inset 0 0 0 1.5px currentColor",
            }}
            title={`${r.name}: condition ${r.condition}, significance ${r.significance}, ${r.treatmentHours} h`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>poor condition</span>
        <span>good ·  significance ↑</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {funded.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span aria-hidden className="w-3">
              {r.funded ? "●" : "○"}
            </span>
            <span className="w-32 shrink-0 truncate">{r.name}</span>
            <span className="text-muted-foreground">
              {r.treatmentHours} h · priority {r.priority.toFixed(2)}
              {r.funded ? "" : " — not funded this year"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Marker size is the treatment hours · priority is significance × damage PER HOUR, so a badly damaged object
        needing three hundred hours ranks below three quick jobs that together save as much ·{" "}
        {doneCount} of {objects.length} fit the {budgetHours}-hour budget, using {spent} of it
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * LoanSchedule — outward loans against each object's required rest, so
 * a request that cannot be met is visible before it is agreed.
 * ------------------------------------------------------------------ */
export function LoanSchedule({
  objects,
  today,
  className = "",
}: {
  objects: {
    name: string
    /** months of rest the object needs between display periods */
    restMonths: number
    loans: { venue: string; fromMonth: number; toMonth: number; requested?: boolean }[]
  }[]
  /** the current month on the same scale */
  today: number
  className?: string
}) {
  const all = objects.flatMap((o) => o.loans)
  const from = Math.min(today, ...all.map((l) => l.fromMonth))
  const to = Math.max(...all.map((l) => l.toMonth))
  const px = (m: number) => ((m - from) / Math.max(to - from, 1)) * 100

  const rows = objects.map((o) => {
    const sorted = [...o.loans].sort((a, b) => a.fromMonth - b.fromMonth)
    const conflicts = sorted
      .map((l, i) => {
        const prev = sorted[i - 1]
        if (!prev) return null
        const rest = l.fromMonth - prev.toMonth
        return rest < o.restMonths ? { loan: l, rest, after: prev.venue } : null
      })
      .filter((c): c is { loan: (typeof sorted)[number]; rest: number; after: string } => c !== null)
    return { ...o, sorted, conflicts }
  })
  const blocked = rows.filter((r) => r.conflicts.length > 0)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">{r.restMonths} months rest required</span>
            </div>
            <div className="relative mt-0.5 h-5 rounded-[2px] bg-muted">
              {r.sorted.map((l) => {
                const clash = r.conflicts.some((c) => c.loan === l)
                return (
                  <div
                    key={`${l.venue}-${l.fromMonth}`}
                    className="absolute inset-y-0 flex items-center justify-center overflow-hidden rounded-[2px] border border-foreground/45 text-[9px] whitespace-nowrap"
                    style={{
                      left: `${px(l.fromMonth)}%`,
                      width: `${Math.max(2, px(l.toMonth) - px(l.fromMonth))}%`,
                      background: clash
                        ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                        : l.requested
                          ? "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 6px)"
                          : "color-mix(in oklch, currentColor 40%, transparent)",
                    }}
                    title={`${l.venue}, months ${l.fromMonth}–${l.toMonth}${clash ? " — too soon" : ""}`}
                  >
                    {px(l.toMonth) - px(l.fromMonth) > 14 ? l.venue : ""}
                  </div>
                )
              })}
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${px(today)}%` }} title="today" />
            </div>
            {r.conflicts.length > 0 && (
              <span className="text-[9px] tabular-nums text-muted-foreground">
                {r.conflicts.map((c) => `${c.loan.venue} is ${c.rest} months after ${c.after}, ${r.restMonths} required`).join(" · ")}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Solid bars are agreed loans, lightly hatched are requests, heavily hatched break the object's own rest period ·{" "}
        {blocked.length
          ? `${blocked.length} object${blocked.length === 1 ? "" : "s"} cannot meet ${blocked.length === 1 ? "its" : "their"} rest requirement — the rest is a property of the object, not of the diary, so the answer is no rather than later`
          : "every object gets its required rest between loans"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * VisitorDwell — time spent at each display, with the share who stop at
 * all separated from how long the stoppers stay.
 * ------------------------------------------------------------------ */
export function VisitorDwell({
  displays,
  totalVisitors,
  height = 200,
  className = "",
}: {
  displays: { name: string; passers: number; stoppers: number; medianSeconds: number }[]
  totalVisitors: number
  height?: number
  className?: string
}) {
  const rows = displays
    .map((d) => ({
      ...d,
      capture: d.stoppers / Math.max(d.passers, 1),
      reach: d.passers / Math.max(totalVisitors, 1),
      // attention actually delivered, which neither rate gives on its own
      attentionSeconds: d.stoppers * d.medianSeconds,
    }))
    .sort((a, b) => b.attentionSeconds - a.attentionSeconds)
  const maxAttention = Math.max(1, ...rows.map((r) => r.attentionSeconds))
  const byCapture = [...rows].sort((a, b) => b.capture - a.capture)
  const flipped = byCapture[0]?.name !== rows[0]?.name

  return (
    <div className={className}>
      <ul className="space-y-2" style={{ minHeight: height }}>
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.stoppers.toLocaleString()} of {r.passers.toLocaleString()} stopped · {r.medianSeconds}s median
              </span>
            </div>
            <div className="mt-0.5 space-y-px">
              <div className="h-3 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground/30" style={{ width: `${r.capture * 100}%` }} title={`capture ${(r.capture * 100).toFixed(0)}%`} />
              </div>
              <div className="h-3 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground" style={{ width: `${(r.attentionSeconds / maxAttention) * 100}%` }} title={`${Math.round(r.attentionSeconds / 60).toLocaleString()} visitor-minutes`} />
              </div>
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.capture * 100).toFixed(0)}% capture · {(r.reach * 100).toFixed(0)}% of visitors walk past ·{" "}
              {Math.round(r.attentionSeconds / 60).toLocaleString()} visitor-minutes delivered
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is capture rate, solid is total attention delivered ·{" "}
        {flipped
          ? `${byCapture[0]?.name} has the best capture rate but ${rows[0]?.name} delivers the most attention, because it is on a route more people take — a capture rate rewards a case nobody walks past`
          : `${rows[0]?.name} leads on both capture and total attention`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AccessionBacklog — how far behind cataloguing is, with the years to
 * clear DERIVED from the intake and the processing rate. A backlog
 * quoted as a count says nothing about whether it is growing.
 * ------------------------------------------------------------------ */
export function AccessionBacklog({
  years,
  staffCapacityPerYear,
  height = 200,
  className = "",
}: {
  years: { label: string; acquired: number; catalogued: number }[]
  /** objects one full-time cataloguer processes in a year */
  staffCapacityPerYear: number
  height?: number
  className?: string
}) {
  let carried = 0
  const rows = years.map((y) => {
    carried += y.acquired - y.catalogued
    return { ...y, backlog: Math.max(0, carried), net: y.acquired - y.catalogued }
  })
  const latest = rows[rows.length - 1]
  const recentNet = rows.slice(-3).reduce((a, r) => a + r.net, 0) / Math.min(3, rows.length)
  const recentRate = rows.slice(-3).reduce((a, r) => a + r.catalogued, 0) / Math.min(3, rows.length)
  // years to clear at the current net position, which is infinite when
  // acquisitions outrun cataloguing — the case a headline count never shows
  const yearsToClear = recentNet >= 0 ? Infinity : latest.backlog / Math.abs(recentNet)
  const staffNeeded = (latest.backlog / 5 + rows.slice(-3).reduce((a, r) => a + r.acquired, 0) / 3) / Math.max(staffCapacityPerYear, 1e-9)
  const max = Math.max(...rows.map((r) => Math.max(r.backlog, r.acquired, r.catalogued))) * 1.06

  return (
    <div className={className}>
      <div className="relative flex items-end gap-1" style={{ height }}>
        {rows.map((r) => (
          <div key={r.label} className="flex h-full flex-1 flex-col justify-end">
            <div className="flex w-full items-end justify-center gap-px" style={{ height: "100%" }}>
              <div className="w-1/2 rounded-t-[2px] bg-foreground/60" style={{ height: `${(r.acquired / max) * 100}%` }} title={`${r.acquired} acquired`} />
              <div
                className="w-1/2 rounded-t-[2px] border border-foreground/50"
                style={{ height: `${(r.catalogued / max) * 100}%`, background: "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)" }}
                title={`${r.catalogued} catalogued`}
              />
            </div>
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          <polyline
            points={rows.map((r, i) => `${((i + 0.5) / rows.length) * 100},${100 - (r.backlog / max) * 100}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="mt-1 flex gap-1">
        {rows.map((r) => (
          <span key={r.label} className="flex-1 truncate text-center text-[9px] text-muted-foreground">
            {r.label}
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Backlog</dt>
          <dd className="font-medium tabular-nums">{latest.backlog.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Net per year</dt>
          <dd className="font-medium tabular-nums">
            {recentNet >= 0 ? "+" : "−"}
            {Math.abs(Math.round(recentNet)).toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Years to clear</dt>
          <dd className="font-medium tabular-nums">{Number.isFinite(yearsToClear) ? yearsToClear.toFixed(1) : "never"}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Solid is acquisitions, hatched is cataloguing, the line is the backlog they leave behind ·{" "}
        {Number.isFinite(yearsToClear)
          ? `at ${Math.round(recentRate).toLocaleString()} a year it clears in ${yearsToClear.toFixed(1)} years`
          : `acquisitions outrun cataloguing by ${Math.round(recentNet).toLocaleString()} a year, so the backlog never clears at any rate — it needs about ${staffNeeded.toFixed(1)} full-time cataloguers to reverse, and a count of the backlog alone would never say that`}
      </p>
    </div>
  )
}
