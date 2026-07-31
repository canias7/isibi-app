/**
 * Recruiting primitives — time to fill, offer acceptance, source yield,
 * interviewer calibration, pipeline composition and requisition ageing.
 *
 * The days a stage really adds, the offers lost and to what, the cost of a
 * hire from each source, how far an interviewer sits from the panel, where
 * a pipeline narrows and how long a vacancy has been open are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e4 ? `£${(a / 1e3).toFixed(0)}k` : a < 10 ? `£${a.toFixed(2)}` : `£${Math.round(a).toLocaleString("en-GB")}`
  return v < 0 ? `−${s}` : s
}
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/* ------------------------------------------------------------------ *
 * TimeToFill — the days each stage adds, split into WORK and WAIT.
 * A 62-day time to fill is quoted as one number and spent almost
 * entirely in queues nobody owns.
 * ------------------------------------------------------------------ */
export function TimeToFill({
  roles,
  stages,
  targetDays,
  className = "",
}: {
  /** days spent in each stage, per role */
  roles: { name: string; days: number[] }[]
  /** the stage names, and how much of each is waiting rather than doing */
  stages: { name: string; waitShare: number }[]
  targetDays?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!roles.length || !stages.length) return null

  const rows = roles.map((r) => ({ ...r, total: r.days.reduce((a, v) => a + v, 0) }))
  const max = Math.max(targetDays ?? 0, ...rows.map((r) => r.total))
  const byStage = stages.map((s, i) => {
    const days = rows.reduce((a, r) => a + r.days[i], 0) / Math.max(rows.length, 1)
    return { ...s, days, wait: days * s.waitShare }
  })
  const totalWait = byStage.reduce((a, s) => a + s.wait, 0)
  const mean = rows.reduce((a, r) => a + r.total, 0) / Math.max(rows.length, 1)
  const worstWait = byStage.reduce((a, s) => (s.wait > a.wait ? s : a), byStage[0])
  const over = targetDays === undefined ? [] : rows.filter((r) => r.total > targetDays)

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span className="w-28 shrink-0 truncate">{r.name}</span>
            <div className="relative h-4 flex-1 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 left-0 flex gap-px" style={{ width: `${(r.total / max) * 100}%` }}>
                {r.days.map((d, i) => (
                  <div
                    key={i}
                    className="min-w-0 first:rounded-l-[2px] last:rounded-r-[2px]"
                    style={{
                      width: `${(d / Math.max(r.total, 1e-9)) * 100}%`,
                      background: `color-mix(in oklch, currentColor ${(88 - i * 13).toFixed(0)}%, transparent)`,
                    }}
                    title={`${stages[i].name}: ${d} days`}
                  />
                ))}
              </div>
              {targetDays !== undefined && (
                <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(targetDays / max) * 100}%` }} title={`target ${targetDays} days`} />
              )}
            </div>
            <span className="w-14 shrink-0 text-right text-muted-foreground">{r.total} d</span>
          </li>
        ))}
      </ul>
      <ul className="mt-3 space-y-1">
        {byStage.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span
              className="inline-block h-2.5 w-4 shrink-0 rounded-[1px] border border-foreground/25"
              style={{ background: `color-mix(in oklch, currentColor ${(88 - i * 13).toFixed(0)}%, transparent)` }}
            />
            <span className="w-28 shrink-0 truncate">{s.name}</span>
            <div className="flex h-2.5 flex-1 rounded-[1px] bg-muted">
              <div
                className="rounded-l-[1px]"
                style={{
                  width: `${(s.wait / Math.max(...byStage.map((x) => x.days))) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                }}
                title={`waiting ${s.wait.toFixed(1)} days`}
              />
              <div
                className="rounded-r-[1px] bg-foreground/60"
                style={{ width: `${((s.days - s.wait) / Math.max(...byStage.map((x) => x.days))) * 100}%` }}
                title={`doing ${(s.days - s.wait).toFixed(1)} days`}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-muted-foreground">
              {s.days.toFixed(1)} d · {(s.waitShare * 100).toFixed(0)}% waiting
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The lower bars split each stage into WAITING (hatched) and doing · {totalWait.toFixed(0)} of the average{" "}
        {mean.toFixed(0)} days is queue, {((totalWait / Math.max(mean, 1e-9)) * 100).toFixed(0)}%, and{" "}
        {worstWait.name.toLowerCase()} holds {worstWait.wait.toFixed(1)} days of it — a hiring manager who reads one
        number sees a slow recruiter, and every day here is spent between two people's calendars
        {targetDays !== undefined
          ? ` · ${over.length} of ${rows.length} ${plural(over.length, "role is", "roles are")} past the ${targetDays}-day target`
          : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * OfferAcceptance — offers made against offers taken, with the reason
 * lost. An acceptance rate says a company is losing offers; only the
 * reasons say whether that is a pay problem or a speed problem.
 * ------------------------------------------------------------------ */
export function OfferAcceptance({
  teams,
  reasons,
  className = "",
}: {
  /** declines by reason, per team, plus the offers accepted */
  teams: { name: string; accepted: number; declined: number[] }[]
  reasons: string[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!teams.length || !reasons.length) return null

  const rows = teams
    .map((t) => {
      const declinedTotal = t.declined.reduce((a, v) => a + v, 0)
      const made = t.accepted + declinedTotal
      return { ...t, declinedTotal, made, rate: t.accepted / Math.max(made, 1) }
    })
    .sort((a, b) => a.rate - b.rate)
  const made = rows.reduce((a, r) => a + r.made, 0)
  const accepted = rows.reduce((a, r) => a + r.accepted, 0)
  const byReason = reasons.map((_, ri) => rows.reduce((a, r) => a + r.declined[ri], 0))
  const topReason = byReason.indexOf(Math.max(...byReason))
  const totalDeclined = byReason.reduce((a, v) => a + v, 0)
  const max = Math.max(...rows.map((r) => r.made))
  const shade = (i: number) => `color-mix(in oklch, currentColor ${(80 - i * 14).toFixed(0)}%, transparent)`

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.accepted} of {r.made} · {(r.rate * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-0.5 flex h-4 gap-px" style={{ width: `${(r.made / max) * 100}%` }}>
              <div
                className="rounded-l-[2px] bg-foreground"
                style={{ width: `${(r.accepted / Math.max(r.made, 1)) * 100}%` }}
                title={`accepted ${r.accepted}`}
              />
              {r.declined.map((d, i) => (
                <div
                  key={i}
                  className="last:rounded-r-[2px]"
                  style={{ width: `${(d / Math.max(r.made, 1)) * 100}%`, background: shade(i) }}
                  title={`${reasons[i]}: ${d}`}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground tabular-nums">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-[1px] bg-foreground" />
          Accepted
        </span>
        {reasons.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25" style={{ background: shade(i) }} />
            {n} · {byReason[i]}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        {((accepted / Math.max(made, 1)) * 100).toFixed(0)}% of {made} offers were accepted, and the REASONS are what
        make that number actionable — {reasons[topReason].toLowerCase()} accounts for{" "}
        {((byReason[topReason] / Math.max(totalDeclined, 1)) * 100).toFixed(0)}% of the{" "}
        {totalDeclined} declines · {rows[0].name} is the weakest at {(rows[0].rate * 100).toFixed(0)}%, and an
        acceptance rate on its own tells a company it is losing offers without saying whether to pay more or move
        faster
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SourceYield — applications through to hires, by channel, with the
 * COST PER HIRE derived. An agency looks expensive per hire and cheap
 * per application, and a job board is the reverse.
 * ------------------------------------------------------------------ */
export function SourceYield({
  sources,
  className = "",
}: {
  sources: { name: string; applications: number; interviews: number; hires: number; spend: number; retainedAt12m?: number }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!sources.length) return null

  const rows = sources
    .map((s) => ({
      ...s,
      perHire: s.spend / Math.max(s.hires, 1),
      perApplication: s.spend / Math.max(s.applications, 1),
      hireRate: s.hires / Math.max(s.applications, 1),
      quality: s.retainedAt12m === undefined ? null : s.retainedAt12m / Math.max(s.hires, 1),
      // what a hire costs once the ones who left are excluded
      perKeptHire: s.retainedAt12m === undefined ? null : s.spend / Math.max(s.retainedAt12m, 1),
    }))
    .sort((a, b) => a.perHire - b.perHire)
  const hires = rows.reduce((a, r) => a + r.hires, 0)
  const spend = rows.reduce((a, r) => a + r.spend, 0)
  const blended = spend / Math.max(hires, 1)
  const max = Math.max(...rows.map((r) => r.perHire))
  const bestVolume = rows.reduce((a, r) => (r.applications > a.applications ? r : a), rows[0])
  const bestRate = rows.reduce((a, r) => (r.hireRate > a.hireRate ? r : a), rows[0])
  const withQuality = rows.filter((r) => r.perKeptHire !== null)
  const reordered =
    withQuality.length > 1 &&
    withQuality[0].name !== [...withQuality].sort((a, b) => a.perKeptHire! - b.perKeptHire!)[0].name

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.applications.toLocaleString()} → {r.interviews} → {r.hires} · {money(r.spend)}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/60" style={{ width: `${(r.perHire / max) * 100}%` }} title={`${money(r.perHire)} a hire`} />
              {r.perKeptHire !== null && (
                <span className="absolute inset-y-0 w-1 rounded-[1px] bg-foreground" style={{ left: `${clamp((r.perKeptHire / max) * 100 - 0.4, 0, 99)}%` }} title={`${money(r.perKeptHire)} a hire still here at a year`} />
              )}
              <span className="absolute inset-y-0 w-px bg-foreground/45" style={{ left: `${clamp((blended / max) * 100, 0, 100)}%` }} title={`blended ${money(blended)}`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.perHire)} a hire · {(r.hireRate * 100).toFixed(2)}% of applications
              {r.quality !== null ? ` · ${(r.quality * 100).toFixed(0)}% still here at a year, ${money(r.perKeptHire!)} each` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is cost per HIRE and the mark past it is cost per hire STILL HERE at a year, which is the number a
        channel should be judged on · {bestVolume.name} sends the most applications and {bestRate.name} converts the
        highest share, {bestVolume.name === bestRate.name ? "which is the same channel" : "which are different channels"}{" "}
        · {money(blended)} blended over {hires} hires ·{" "}
        {reordered
          ? "and the cheapest channel changes once retention is counted, which is the whole argument for measuring it"
          : "the ranking survives the retention adjustment, which does not always happen"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * InterviewCalibration — how far each interviewer sits from the panel
 * on the same candidates. A scorecard average is meaningless while one
 * person scores a point higher than everybody else on every candidate.
 * ------------------------------------------------------------------ */
export function InterviewCalibration({
  interviewers,
  candidates,
  scores,
  bar,
  className = "",
}: {
  interviewers: string[]
  candidates: string[]
  /** scores[interviewer][candidate], null where they did not see them */
  scores: (number | null)[][]
  /** the score at which a candidate passes */
  bar: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!interviewers.length || !candidates.length || !scores.length) return null

  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!interviewers.length || !candidates.length || !scores.length) return null

  // the panel's view of each candidate, then each interviewer's distance from it
  const panel = candidates.map((_, ci) => {
    const seen = scores.map((row) => row[ci]).filter((v): v is number => v !== null)
    return seen.length ? seen.reduce((a, v) => a + v, 0) / seen.length : null
  })
  const rows = interviewers.map((name, ii) => {
    const pairs = candidates
      .map((_, ci) => ({ mine: scores[ii][ci], theirs: panel[ci] }))
      .filter((p): p is { mine: number; theirs: number } => p.mine !== null && p.theirs !== null)
    const bias = pairs.length ? pairs.reduce((a, p) => a + (p.mine - p.theirs), 0) / pairs.length : 0
    const spread = pairs.length
      ? Math.sqrt(pairs.reduce((a, p) => a + (p.mine - p.theirs - bias) ** 2, 0) / pairs.length)
      : 0
    // candidates this person would pass that the panel would not, and the reverse
    const swings = pairs.filter((p) => (p.mine >= bar) !== (p.theirs >= bar)).length
    return { name, bias, spread, seen: pairs.length, swings }
  })
  const maxAbs = Math.max(0.25, ...rows.map((r) => Math.abs(r.bias) + r.spread))
  const hardest = rows.reduce((a, r) => (r.bias < a.bias ? r : a), rows[0])
  const softest = rows.reduce((a, r) => (r.bias > a.bias ? r : a), rows[0])
  const noisiest = rows.reduce((a, r) => (r.spread > a.spread ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.seen} {plural(r.seen, "candidate", "candidates")} · {r.bias >= 0 ? "+" : ""}
                {r.bias.toFixed(2)} ± {r.spread.toFixed(2)}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              {/* the SPREAD as a band and the bias as a mark: a consistently
                  generous interviewer is correctable and a noisy one is not */}
              <div
                className="absolute inset-y-0 bg-foreground/22"
                style={{
                  left: `${clamp(50 + ((r.bias - r.spread) / maxAbs) * 50, 0, 100)}%`,
                  width: `${clamp((r.spread * 2 / maxAbs) * 50, 0.6, 100)}%`,
                }}
                title={`± ${r.spread.toFixed(2)}`}
              />
              <span className="absolute inset-y-0 w-1 rounded-[1px] bg-foreground" style={{ left: `${clamp(50 + (r.bias / maxAbs) * 50, 0, 99)}%` }} title={`bias ${r.bias.toFixed(2)}`} />
              <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/55" />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.swings === 0
                ? "agrees with the panel on every pass or fail"
                : `${r.swings} ${plural(r.swings, "candidate", "candidates")} would cross the bar differently`}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>harsher than the panel</span>
        <span>agrees</span>
        <span>more generous</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Each interviewer is measured against the PANEL's view of the same candidates, so this is calibration rather
        than opinion · {softest.name} scores {softest.bias.toFixed(2)} above and {hardest.name}{" "}
        {Math.abs(hardest.bias).toFixed(2)} below, a gap of {(softest.bias - hardest.bias).toFixed(2)} points on the
        same people · a consistent bias is correctable by moving the bar for that interviewer; {noisiest.name}'s ±
        {noisiest.spread.toFixed(2)} is NOISE and no adjustment fixes it
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PipelineDiversity — the composition of a pipeline at each stage,
 * with the stage-by-stage PASS RATE derived per group. A funnel chart
 * shows a pipeline narrowing; only the rates say where unevenly.
 * ------------------------------------------------------------------ */
export function PipelineDiversity({
  stages,
  groups,
  counts,
  className = "",
}: {
  stages: string[]
  groups: string[]
  /** counts[group][stage] */
  counts: number[][]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!stages.length || !groups.length || !counts.length) return null

  const totals = stages.map((_, si) => counts.reduce((a, row) => a + row[si], 0))
  const rows = groups.map((name, gi) => {
    const shares = stages.map((_, si) => counts[gi][si] / Math.max(totals[si], 1))
    const rates = stages.map((_, si) => (si === 0 ? 1 : counts[gi][si] / Math.max(counts[gi][si - 1], 1)))
    return { name, shares, rates, start: shares[0], end: shares[shares.length - 1] }
  })
  // the stage where the groups' pass rates differ most, which is the answer
  const gaps = stages.map((_, si) => {
    if (si === 0) return 0
    const rs = rows.map((r) => r.rates[si])
    return Math.max(...rs) - Math.min(...rs)
  })
  const worstStage = gaps.indexOf(Math.max(...gaps))
  const shade = (i: number) => `color-mix(in oklch, currentColor ${(84 - i * 20).toFixed(0)}%, transparent)`

  return (
    <div className={className}>
      <ul className="space-y-2">
        {stages.map((s, si) => (
          <li key={s}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{s}</span>
              <span className="tabular-nums text-muted-foreground">{totals[si].toLocaleString()}</span>
            </div>
            <div className="mt-0.5 flex h-4 overflow-hidden rounded-[2px] border border-foreground/20">
              {rows.map((r, gi) => (
                <div
                  key={r.name}
                  className="border-r border-background last:border-r-0"
                  style={{ width: `${r.shares[si] * 100}%`, background: shade(gi) }}
                  title={`${r.name}: ${counts[gi][si]} (${(r.shares[si] * 100).toFixed(1)}%)`}
                />
              ))}
            </div>
            {si > 0 && (
              <span className="text-[9px] tabular-nums text-muted-foreground">
                pass rates:{" "}
                {rows.map((r) => `${r.name} ${(r.rates[si] * 100).toFixed(0)}%`).join(" · ")}
                {si === worstStage ? " — the widest gap in the pipeline" : ""}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground tabular-nums">
        {rows.map((r, i) => (
          <span key={r.name} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25" style={{ background: shade(i) }} />
            {r.name} · {(r.start * 100).toFixed(0)}% → {(r.end * 100).toFixed(0)}%
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Each bar is the COMPOSITION at that stage and the numbers under it are each group's pass rate INTO it, which
        is where a funnel chart stops and this begins · the widest gap is at {stages[worstStage].toLowerCase()},{" "}
        {(gaps[worstStage] * 100).toFixed(0)} points between the best and worst rate — a pipeline that narrows evenly
        needs more applicants and one that narrows unevenly needs a different {stages[worstStage].toLowerCase()}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * RequisitionAgeing — open vacancies by how long they have been open,
 * with the COST OF THE VACANCY derived. An ageing list is sorted by
 * date; the money is in the roles that produce revenue.
 * ------------------------------------------------------------------ */
export function RequisitionAgeing({
  requisitions,
  className = "",
}: {
  requisitions: { name: string; openDays: number; team: string; dailyValue?: number; candidatesAtOffer?: number }[]
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!requisitions.length) return null

  const rows = [...requisitions]
    .map((r) => ({ ...r, cost: (r.dailyValue ?? 0) * r.openDays }))
    .sort((a, b) => b.cost - a.cost || b.openDays - a.openDays)
  const bands: [string, (d: number) => boolean][] = [
    ["under 30 days", (d) => d < 30],
    ["30–60", (d) => d >= 30 && d < 60],
    ["60–90", (d) => d >= 60 && d < 90],
    ["over 90", (d) => d >= 90],
  ]
  const byBand = bands.map(([label, f]) => ({ label, count: rows.filter((r) => f(r.openDays)).length }))
  const maxDays = Math.max(...rows.map((r) => r.openDays))
  const totalCost = rows.reduce((a, r) => a + r.cost, 0)
  const oldest = rows.reduce((a, r) => (r.openDays > a.openDays ? r : a), rows[0])
  const dearest = rows[0]
  const nearOffer = rows.filter((r) => (r.candidatesAtOffer ?? 0) > 0)

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span aria-hidden className="w-3">
              {(r.candidatesAtOffer ?? 0) > 0 ? "→" : "·"}
            </span>
            <span className="w-32 shrink-0 truncate">{r.name}</span>
            <div className="relative h-3.5 flex-1 rounded-[1px] bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-[1px]"
                style={{
                  width: `${(r.openDays / maxDays) * 100}%`,
                  background:
                    r.openDays >= 90
                      ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                      : `color-mix(in oklch, currentColor ${(30 + (r.openDays / maxDays) * 45).toFixed(0)}%, transparent)`,
                  outline: r.openDays >= 90 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`${r.openDays} days open`}
              />
            </div>
            <span className="w-40 shrink-0 text-right text-muted-foreground">
              {r.openDays} d · {r.team}
              {r.dailyValue ? ` · ${money(r.cost)} so far` : ""}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2 text-[10px] tabular-nums">
        {byBand.map((b) => (
          <div key={b.label} className="min-w-0 flex-1">
            <div className="text-muted-foreground">{b.label}</div>
            <div className="font-medium">{b.count}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        An ageing list sorted by DATE puts the oldest requisition first; this one is sorted by what the vacancy has
        cost, which is a different order · {oldest.name} has been open longest at {oldest.openDays} days and{" "}
        {dearest.name} has cost the most at {money(dearest.cost)}
        {oldest.name === dearest.name ? ", which is the same role and makes it the obvious one to fix" : ""} ·{" "}
        {money(totalCost)} of unfilled capacity across {rows.length}{" "}
        {plural(rows.length, "requisition", "requisitions")}, {nearOffer.length} of them at offer
      </p>
    </div>
  )
}
