/**
 * Security-operations primitives — attack paths, patching against the SLA,
 * alert triage, access review, phishing simulation and blast radius.
 *
 * The shortest path to the crown jewel, the SLA breach count, the funnel's
 * conversion at each stage, the accounts nobody re-approved, the click-to-report
 * ratio and the reachable set are all DERIVED. A blast radius passed as a prop
 * is a claim; one walked from the graph is a finding.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * AttackPath — the shortest chain from any entry point to the target,
 * SOLVED by breadth-first search over the stated edges.
 * ------------------------------------------------------------------ */
export function AttackPath({
  nodes,
  edges,
  target,
  className = "",
}: {
  nodes: { id: string; kind?: "entry" | "host" | "identity" | "data"; label?: string }[]
  /** from → to, with the technique that gets you there */
  edges: { from: string; to: string; technique?: string }[]
  target: string
  className?: string
}) {
  const out = new Map<string, { to: string; technique?: string }[]>()
  edges.forEach((e) => out.set(e.from, [...(out.get(e.from) ?? []), { to: e.to, technique: e.technique }]))
  const entries = nodes.filter((n) => n.kind === "entry").map((n) => n.id)

  // BFS from every entry at once: the first time we reach the target is the
  // shortest chain, which is the number that decides where to spend
  const prev = new Map<string, { from: string; technique?: string }>()
  const seen = new Set(entries)
  const queue = [...entries]
  while (queue.length) {
    const cur = queue.shift() as string
    if (cur === target) break
    for (const nxt of out.get(cur) ?? []) {
      if (seen.has(nxt.to)) continue
      seen.add(nxt.to)
      prev.set(nxt.to, { from: cur, technique: nxt.technique })
      queue.push(nxt.to)
    }
  }
  const path: { id: string; technique?: string }[] = []
  if (seen.has(target)) {
    let cur = target
    path.unshift({ id: cur })
    while (prev.has(cur)) {
      const p = prev.get(cur) as { from: string; technique?: string }
      path.unshift({ id: p.from, technique: p.technique })
      cur = p.from
    }
  }
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const unreachable = nodes.filter((n) => !seen.has(n.id))
  const glyph = (k?: string) => (k === "entry" ? "◇" : k === "identity" ? "◆" : k === "data" ? "▣" : "▢")

  return (
    <div className={className}>
      {path.length === 0 ? (
        <p className="text-[11px]">
          {target} is not reachable from any entry point on these edges — which is the result, not an empty chart.
        </p>
      ) : (
        <ol className="space-y-1">
          {path.map((p, i) => (
            <li key={p.id}>
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center text-[11px] text-muted-foreground" aria-hidden>
                  {glyph(byId.get(p.id)?.kind)}
                </span>
                <span className="flex-1 rounded-[2px] border border-foreground/45 px-2 py-1 text-[11px]" style={{ background: i === path.length - 1 ? "color-mix(in oklch, currentColor 18%, transparent)" : undefined }}>
                  {byId.get(p.id)?.label ?? p.id}
                </span>
              </div>
              {i < path.length - 1 && (
                <div className="ml-[0.6rem] flex items-center gap-2 py-0.5">
                  <span className="h-4 w-px bg-foreground/40" />
                  {/* path[i] holds the technique that leaves node i; path[i+1] is one hop further on */}
                  <span className="text-[9px] text-muted-foreground">{p.technique ?? "reachable"}</span>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        {path.length
          ? `${path.length - 1} hop${path.length === 2 ? "" : "s"} from an entry point to ${byId.get(target)?.label ?? target}, found by search rather than drawn by hand · breaking any one link on this chain breaks the whole path`
          : "no chain exists on the recorded edges"}
        {unreachable.length ? ` · ${unreachable.length} of ${nodes.length} assets are not reachable at all` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PatchSla — days to remediate against the SLA for each severity, with
 * the breach count and the ageing tail derived.
 * ------------------------------------------------------------------ */
export function PatchSla({
  findings,
  sla,
  height = 200,
  className = "",
}: {
  findings: { severity: string; ageDays: number; remediated?: boolean }[]
  /** days allowed per severity */
  sla: Record<string, number>
  height?: number
  className?: string
}) {
  const severities = Object.keys(sla)
  const rows = severities.map((sev) => {
    const items = findings.filter((f) => f.severity === sev)
    const open = items.filter((f) => !f.remediated)
    const breached = open.filter((f) => f.ageDays > sla[sev])
    const oldest = open.reduce((a, f) => Math.max(a, f.ageDays), 0)
    return { sev, allowed: sla[sev], items, open, breached, oldest }
  })
  const axis = Math.max(...rows.map((r) => Math.max(r.oldest, r.allowed))) * 1.06
  const totalBreached = rows.reduce((a, r) => a + r.breached.length, 0)

  return (
    <div className={className}>
      <ul className="space-y-3" style={{ minHeight: height }}>
        {rows.map((r) => (
          <li key={r.sev}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="font-medium capitalize">{r.sev}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.open.length} open of {r.items.length} · {r.allowed}-day SLA
              </span>
            </div>
            <div className="relative mt-1 h-6 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-l-[2px] bg-foreground/10" style={{ width: `${(r.allowed / axis) * 100}%` }} />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(r.allowed / axis) * 100}%` }} />
              {r.open.map((f, i) => (
                <span
                  key={i}
                  className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-[1px]"
                  style={{
                    left: `${(clamp(f.ageDays, 0, axis) / axis) * 100}%`,
                    background: f.ageDays > r.allowed ? "currentColor" : "color-mix(in oklch, currentColor 40%, transparent)",
                  }}
                  title={`${f.ageDays} days old`}
                />
              ))}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              <span aria-hidden>{r.breached.length ? "✗" : "✓"}</span> {r.breached.length} past SLA · oldest{" "}
              {r.oldest} days
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Each tick is one open finding placed at its own age; the shaded run is the window it was allowed ·{" "}
        {totalBreached} finding{totalBreached === 1 ? "" : "s"} past SLA — a mean age hides exactly this, because one
        very old critical and forty fresh ones average to something comfortable
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AlertFunnel — alerts down to real incidents, with the conversion at
 * each stage and the analyst cost of the false positives derived.
 * ------------------------------------------------------------------ */
export function AlertFunnel({
  stages,
  minutesPerTriage,
  analystCostPerHour,
  triagedStage,
  className = "",
}: {
  stages: { name: string; count: number }[]
  minutesPerTriage: number
  analystCostPerHour: number
  /** the stage a person actually opens; defaults to the first */
  triagedStage?: string
  className?: string
}) {
  const rows = stages.map((s, i) => ({
    ...s,
    conversion: i === 0 ? 1 : s.count / Math.max(stages[i - 1].count, 1),
    overall: s.count / Math.max(stages[0].count, 1),
  }))
  // The stage a HUMAN opens, not the raw signal count — charging 4.1M machine
  // events at eleven analyst-minutes each reported 755,000 hours of work nobody did.
  const triageIdx = triagedStage ? stages.findIndex((s) => s.name === triagedStage) : 0
  const triaged = stages[Math.max(0, triageIdx)]?.count ?? 0
  const real = stages[stages.length - 1]?.count ?? 0
  const wasted = Math.max(0, triaged - real)
  const hours = (wasted * minutesPerTriage) / 60
  const worstDrop = rows.slice(1).reduce((a, r) => (r.conversion < a.conversion ? r : a), rows[1] ?? rows[0])
  const max = Math.max(1, ...rows.map((r) => r.count))

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span>{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.count.toLocaleString()}
                {i > 0 ? ` · ${(r.conversion * 100).toFixed(1)}% of the step before` : ""}
              </span>
            </div>
            <div className="mt-0.5 h-5 rounded-[2px] bg-muted">
              <div
                className="flex h-full items-center justify-end rounded-[2px] pr-1 text-[9px] tabular-nums"
                style={{
                  // Log width: a funnel whose second stage is 0.9% of the first
                  // is one pixel on a linear scale, and the drops between the
                  // later stages — the ones a rule change acts on — are invisible.
                  width: `${Math.max(3, (Math.log10(Math.max(1, r.count)) / Math.log10(Math.max(10, max))) * 100)}%`,
                  background: "color-mix(in oklch, currentColor 22%, transparent)",
                }}
              >
                <span className="text-foreground">{(r.overall * 100).toFixed(2)}%</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">End to end</dt>
          <dd className="font-medium tabular-nums">{((real / Math.max(triaged, 1)) * 100).toFixed(3)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Analyst hours</dt>
          <dd className="font-medium tabular-nums">{Math.round(hours).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cost of noise</dt>
          <dd className="font-medium tabular-nums">${Math.round(hours * analystCostPerHour).toLocaleString()}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        The steepest drop is at {worstDrop?.name} ({((worstDrop?.conversion ?? 1) * 100).toFixed(1)}% carry through),
        which is where a rule change buys the most · {wasted.toLocaleString()} alerts that were never incidents cost{" "}
        {Math.round(hours).toLocaleString()} analyst hours
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AccessReview — entitlements against last use and last approval, so
 * the accounts nobody re-approved are found rather than reported.
 * ------------------------------------------------------------------ */
export function AccessReview({
  grants,
  staleDays = 90,
  reviewDays = 180,
  className = "",
}: {
  grants: { principal: string; role: string; lastUsedDays: number | null; lastApprovedDays: number; privileged?: boolean }[]
  staleDays?: number
  reviewDays?: number
  className?: string
}) {
  const rows = grants.map((g) => ({
    ...g,
    neverUsed: g.lastUsedDays === null,
    stale: g.lastUsedDays === null || g.lastUsedDays > staleDays,
    overdue: g.lastApprovedDays > reviewDays,
  }))
  const revoke = rows.filter((r) => r.stale && r.privileged)
  const overdue = rows.filter((r) => r.overdue)
  const axis = Math.max(reviewDays, staleDays, ...rows.map((r) => Math.max(r.lastUsedDays ?? 0, r.lastApprovedDays))) * 1.05

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={`${r.principal}-${r.role}`}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">
                {r.principal} <span className="text-muted-foreground">{r.role}</span>
                {r.privileged ? <span aria-hidden> ★</span> : null}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {r.neverUsed ? "never used" : `used ${r.lastUsedDays}d ago`} · approved {r.lastApprovedDays}d ago
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-l-[2px] bg-foreground/10" style={{ width: `${(staleDays / axis) * 100}%` }} />
              {!r.neverUsed && (
                <span
                  className="absolute top-1/2 h-3 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-[1px] bg-foreground"
                  style={{ left: `${((r.lastUsedDays as number) / axis) * 100}%` }}
                  title={`last used ${r.lastUsedDays} days ago`}
                />
              )}
              <span
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground bg-background"
                style={{ left: `${(r.lastApprovedDays / axis) * 100}%` }}
                title={`last approved ${r.lastApprovedDays} days ago`}
              />
              <span className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${(reviewDays / axis) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Solid mark is last use, hollow is last approval, the line is the {reviewDays}-day review deadline ·{" "}
        {overdue.length} grant{overdue.length === 1 ? "" : "s"} past review ·{" "}
        {revoke.length
          ? `${revoke.length} PRIVILEGED grant${revoke.length === 1 ? "" : "s"} unused for over ${staleDays} days — those are the ones an attacker inherits without anybody noticing`
          : "no privileged grant is stale"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PhishSimulation — click rate and report rate by department. The
 * report-to-click ratio is the number that matters, and it is derived.
 * ------------------------------------------------------------------ */
export function PhishSimulation({
  departments,
  height = 200,
  className = "",
}: {
  departments: { name: string; sent: number; clicked: number; reported: number; submitted?: number }[]
  height?: number
  className?: string
}) {
  const rows = departments.map((d) => ({
    ...d,
    clickRate: d.clicked / Math.max(d.sent, 1),
    reportRate: d.reported / Math.max(d.sent, 1),
    ratio: d.reported / Math.max(d.clicked, 1),
    submitRate: (d.submitted ?? 0) / Math.max(d.sent, 1),
  }))
  const totalSent = departments.reduce((a, d) => a + d.sent, 0)
  const totalClicked = departments.reduce((a, d) => a + d.clicked, 0)
  const totalReported = departments.reduce((a, d) => a + d.reported, 0)
  const max = Math.max(0.01, ...rows.map((r) => Math.max(r.clickRate, r.reportRate)))
  const best = rows.reduce((a, r) => (r.ratio > a.ratio ? r : a), rows[0])
  const worst = rows.reduce((a, r) => (r.ratio < a.ratio ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2" style={{ minHeight: height }}>
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.clicked} clicked, {r.reported} reported of {r.sent}
              </span>
            </div>
            <div className="mt-0.5 space-y-px">
              <div className="h-3 rounded-[1px] bg-muted">
                <div
                  className="h-full rounded-[1px] border border-foreground/50"
                  style={{ width: `${(r.clickRate / max) * 100}%`, background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 5px)" }}
                />
              </div>
              <div className="h-3 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground" style={{ width: `${(r.reportRate / max) * 100}%` }} />
              </div>
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.clickRate * 100).toFixed(1)}% clicked, {(r.reportRate * 100).toFixed(1)}% reported ·{" "}
              {r.ratio.toFixed(2)} reports per click
              {r.submitRate > 0 ? ` · ${(r.submitRate * 100).toFixed(1)}% entered credentials` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched is clicks, solid is reports · across {totalSent.toLocaleString()} messages,{" "}
        {((totalClicked / Math.max(totalSent, 1)) * 100).toFixed(1)}% clicked and{" "}
        {((totalReported / Math.max(totalSent, 1)) * 100).toFixed(1)}% reported · {best.name} reports{" "}
        {best.ratio.toFixed(1)} times for every click and {worst.name} only {worst.ratio.toFixed(2)} — a team that
        reports is an extra detection, and a team that clicks silently is not a training problem, it is a blind spot
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * BlastRadius — everything one compromised principal can reach, walked
 * from the trust edges rather than declared.
 * ------------------------------------------------------------------ */
export function BlastRadius({
  assets,
  trusts,
  compromised,
  height = 210,
  className = "",
}: {
  assets: { id: string; label?: string; value?: number; tier?: string }[]
  /** from can act on to */
  trusts: { from: string; to: string }[]
  compromised: string
  height?: number
  className?: string
}) {
  const out = new Map<string, string[]>()
  trusts.forEach((t) => out.set(t.from, [...(out.get(t.from) ?? []), t.to]))
  const hops = new Map<string, number>([[compromised, 0]])
  const queue = [compromised]
  while (queue.length) {
    const cur = queue.shift() as string
    const d = hops.get(cur) as number
    for (const nxt of out.get(cur) ?? []) {
      if (hops.has(nxt)) continue
      hops.set(nxt, d + 1)
      queue.push(nxt)
    }
  }
  const byId = new Map(assets.map((a) => [a.id, a]))
  const reached = assets.filter((a) => hops.has(a.id))
  const safe = assets.filter((a) => !hops.has(a.id))
  const valueReached = reached.reduce((a, r) => a + (r.value ?? 0), 0)
  const valueTotal = assets.reduce((a, r) => a + (r.value ?? 0), 0)
  const maxHop = Math.max(0, ...reached.map((r) => hops.get(r.id) as number))
  const rings = Array.from({ length: maxHop + 1 }, (_, h) => reached.filter((r) => hops.get(r.id) === h))

  return (
    <div className={className}>
      <ol className="space-y-2" style={{ minHeight: height }}>
        {rings.map((ring, h) => (
          <li key={h}>
            <div className="mb-1 flex items-baseline justify-between text-[10px] text-muted-foreground">
              <span>{h === 0 ? "compromised" : `${h} hop${h === 1 ? "" : "s"} away`}</span>
              <span className="tabular-nums">
                {ring.length} asset{ring.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {ring.map((a) => (
                <span
                  key={a.id}
                  className="rounded-[2px] border border-foreground/45 px-1.5 py-0.5 text-[10px]"
                  style={{ background: `color-mix(in oklch, currentColor ${Math.max(4, 34 - h * 9)}%, transparent)` }}
                  title={a.tier ? `${a.tier}${a.value ? ` · value ${a.value}` : ""}` : undefined}
                >
                  {a.label ?? a.id}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Starting from {byId.get(compromised)?.label ?? compromised}: {reached.length} of {assets.length} assets are
        reachable in {maxHop} hop{maxHop === 1 ? "" : "s"}
        {valueTotal > 0 ? `, carrying ${((valueReached / valueTotal) * 100).toFixed(0)}% of the recorded value` : ""} ·{" "}
        {safe.length
          ? `${safe.length} asset${safe.length === 1 ? " stays" : "s stay"} out of reach — that is the segmentation actually working`
          : "nothing is out of reach, so there is no segmentation here at all"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * IncidentTimeline — the detection and response intervals of a single
 * incident. MTTD and MTTR are DERIVED from the timestamps, and so is
 * the dwell time, which is the number that decides how bad it was.
 * ------------------------------------------------------------------ */
export function IncidentTimeline({
  events,
  className = "",
}: {
  /** minutes from the initial compromise */
  events: {
    name: string
    atMinute: number
    phase: "compromise" | "detect" | "triage" | "contain" | "eradicate" | "recover"
  }[]
  className?: string
}) {
  const sorted = [...events].sort((a, b) => a.atMinute - b.atMinute)
  const at = (phase: (typeof events)[number]["phase"]) => sorted.find((e) => e.phase === phase)?.atMinute ?? null
  const compromise = at("compromise") ?? 0
  const detect = at("detect")
  const contain = at("contain")
  const recover = at("recover")
  const dwell = detect === null ? null : detect - compromise
  const respond = detect === null || contain === null ? null : contain - detect
  const total = recover === null ? sorted[sorted.length - 1].atMinute - compromise : recover - compromise

  const span = Math.max(1, sorted[sorted.length - 1].atMinute - compromise)
  const px = (m: number) => ((m - compromise) / span) * 100
  const fmt = (m: number) =>
    m >= 1440 ? `${(m / 1440).toFixed(1)} d` : m >= 60 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`
  const glyph = (p: string) =>
    p === "compromise" ? "✕" : p === "detect" ? "◆" : p === "contain" ? "▣" : p === "recover" ? "●" : "○"

  // the two intervals that get reported, drawn to scale against each other
  const bands: { label: string; from: number; to: number; hatched: boolean }[] = []
  if (detect !== null) bands.push({ label: "dwell", from: compromise, to: detect, hatched: true })
  if (detect !== null && contain !== null) bands.push({ label: "respond", from: detect, to: contain, hatched: false })
  if (contain !== null && recover !== null) bands.push({ label: "recover", from: contain, to: recover, hatched: false })

  return (
    <div className={className}>
      <div className="relative h-7 rounded-[3px] border border-foreground/30 bg-muted">
        {bands.map((b) => (
          <div
            key={b.label}
            className="absolute inset-y-0 border-r border-foreground/30 last:border-r-0"
            style={{
              left: `${px(b.from)}%`,
              width: `${Math.max(0.5, px(b.to) - px(b.from))}%`,
              background: b.hatched
                ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                : "color-mix(in oklch, currentColor 42%, transparent)",
            }}
            title={`${b.label}: ${fmt(b.to - b.from)}`}
          />
        ))}
        {sorted.map((e) => (
          <span
            key={`${e.name}-${e.atMinute}`}
            className="absolute -top-1 -translate-x-1/2 bg-background px-0.5 text-[10px]"
            style={{ left: `${px(e.atMinute)}%` }}
            title={`${e.name} at ${fmt(e.atMinute - compromise)}`}
          >
            <span aria-hidden>{glyph(e.phase)}</span>
          </span>
        ))}
      </div>
      <ul className="mt-3 space-y-0.5 text-[10px] tabular-nums">
        {sorted.map((e) => (
          <li key={`${e.name}-row-${e.atMinute}`} className="flex items-center gap-2">
            <span aria-hidden className="w-3">
              {glyph(e.phase)}
            </span>
            <span className="w-16 shrink-0 text-right text-muted-foreground">{fmt(e.atMinute - compromise)}</span>
            <span className="truncate">{e.name}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Dwell</dt>
          <dd className="font-medium tabular-nums">{dwell === null ? "undetected" : fmt(dwell)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Detect to contain</dt>
          <dd className="font-medium tabular-nums">{respond === null ? "—" : fmt(respond)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">End to end</dt>
          <dd className="font-medium tabular-nums">{fmt(total)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Hatched is dwell — the time the attacker had before anybody knew ·{" "}
        {dwell !== null && respond !== null && dwell > respond * 3
          ? `dwell was ${(dwell / Math.max(respond, 1)).toFixed(0)}× the response, so the loss here was in detection and no amount of faster containment would have changed it`
          : "response time is the larger share, which is where the practice drills should go"}
      </p>
    </div>
  )
}
