/**
 * Quantitative finance primitives — derivatives, credit, working capital,
 * covenants, interest-rate risk, fund distributions and factor exposure.
 *
 * Monochrome discipline: profit/loss, upgrade/downgrade and headroom/breach are
 * carried by fill weight, hatching and an explicit glyph — never by colour.
 * Everything computed (break-evens, crossovers, cycle length, headroom, gaps,
 * carried interest, active weights) is DERIVED from the inputs, never a prop.
 */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number, dp = 0) =>
  (v < 0 ? "−" : "") + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })

/* ------------------------------------------------------------------ *
 * OptionPayoff — the payoff diagram for a book of option legs.
 * Break-even points are SOLVED from the legs, never supplied.
 * ------------------------------------------------------------------ */
export type OptionLeg = {
  kind: "call" | "put" | "stock"
  side: "long" | "short"
  strike: number
  premium: number
  qty?: number
}

const legPayoff = (leg: OptionLeg, s: number) => {
  const q = leg.qty ?? 1
  const sign = leg.side === "long" ? 1 : -1
  const intrinsic =
    leg.kind === "call" ? Math.max(0, s - leg.strike) : leg.kind === "put" ? Math.max(0, leg.strike - s) : s - leg.strike
  return q * sign * (intrinsic - (leg.kind === "stock" ? 0 : leg.premium))
}

export function OptionPayoff({
  legs,
  spot,
  span = 0.4,
  height = 190,
  className = "",
}: {
  legs: OptionLeg[]
  spot: number
  /** half-width of the price axis as a fraction of spot */
  span?: number
  height?: number
  className?: string
}) {
  const lo = spot * (1 - span)
  const hi = spot * (1 + span)
  const N = 160
  const xs = Array.from({ length: N + 1 }, (_, i) => lo + ((hi - lo) * i) / N)
  const pnl = xs.map((s) => legs.reduce((a, l) => a + legPayoff(l, s), 0))

  const maxAbs = Math.max(1e-9, ...pnl.map(Math.abs))
  const px = (s: number) => ((s - lo) / (hi - lo)) * 100
  const py = (p: number) => 50 - (p / maxAbs) * 46

  // break-evens: sign changes along the sampled curve, refined by linear interpolation
  const breakEvens: number[] = []
  for (let i = 1; i <= N; i++) {
    const a = pnl[i - 1]
    const b = pnl[i]
    if (a === 0) breakEvens.push(xs[i - 1])
    else if (a * b < 0) breakEvens.push(xs[i - 1] + ((xs[i] - xs[i - 1]) * -a) / (b - a))
  }

  const maxGain = Math.max(...pnl)
  const maxLoss = Math.min(...pnl)
  const atSpot = pnl[Math.round(((spot - lo) / (hi - lo)) * N)]

  // Unbounded means the payoff is still MOVING at the edge of the range, not
  // that the edge happens to hold the extreme value. A collar's gain is capped
  // by its short call and its curve goes flat — testing "is this the maximum"
  // called that unbounded, which is the opposite of what the position does.
  const flat = (a: number, b: number) => Math.abs(b - a) < Math.max(1e-6, maxAbs * 0.002)
  const gainUnbounded = !flat(pnl[N - 1], pnl[N]) && pnl[N] === maxGain
  const lossUnbounded = !flat(pnl[0], pnl[1]) && pnl[0] === maxLoss

  // split the curve into profit and loss runs so each can be filled differently
  const area = (want: "up" | "down") => {
    const pts = xs.map((s, i) => {
      const p = pnl[i]
      const keep = want === "up" ? Math.max(0, p) : Math.min(0, p)
      return `${px(s)},${py(keep)}`
    })
    return `0,50 ${pts.join(" ")} 100,50`
  }

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={area("up")} fill="currentColor" opacity={0.16} />
          <polygon points={area("down")} fill="currentColor" opacity={0.34} />
          <line x1={0} y1={50} x2={100} y2={50} stroke="currentColor" strokeWidth={0.4} opacity={0.5} />
          <line
            x1={px(spot)}
            y1={2}
            x2={px(spot)}
            y2={98}
            stroke="currentColor"
            strokeWidth={0.4}
            strokeDasharray="2 2"
            opacity={0.45}
          />
          <polyline
            points={xs.map((s, i) => `${px(s)},${py(pnl[i])}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {breakEvens.map((b, i) => (
          <span
            key={i}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground bg-background"
            style={{ left: `${px(b)}%`, top: "50%" }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{money(lo)}</span>
        <span>spot {money(spot)}</span>
        <span>{money(hi)}</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Max gain</dt>
          <dd className="font-medium tabular-nums">{gainUnbounded ? "unbounded" : money(maxGain)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Max loss</dt>
          <dd className="font-medium tabular-nums">{lossUnbounded ? "unbounded" : money(maxLoss)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">P/L at spot</dt>
          <dd className="font-medium tabular-nums">{money(atSpot)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Break-even {breakEvens.length ? breakEvens.map((b) => money(b)).join(" and ") : "none in range"} · loss region
        shaded darker
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CreditMigration — a rating transition matrix. Upgrades and downgrades
 * are read off the diagonal, not declared.
 * ------------------------------------------------------------------ */
export function CreditMigration({
  grades,
  matrix,
  className = "",
}: {
  /** ordered best-to-worst, e.g. ["AAA","AA","A","BBB","BB","B","D"] */
  grades: string[]
  /** matrix[from][to] as a percentage; rows need not sum to exactly 100 */
  matrix: number[][]
  className?: string
}) {
  const n = grades.length
  const max = Math.max(1e-9, ...matrix.flat())
  const stability = grades.map((_, i) => matrix[i]?.[i] ?? 0)
  const downgraded = grades.map((_, i) => (matrix[i] ?? []).reduce((a, v, j) => a + (j > i ? v : 0), 0))
  const upgraded = grades.map((_, i) => (matrix[i] ?? []).reduce((a, v, j) => a + (j < i ? v : 0), 0))

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background pr-1 text-left font-normal text-muted-foreground">from \ to</th>
              {grades.map((g) => (
                <th key={g} className="px-0.5 pb-1 font-medium">
                  {g}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grades.map((g, i) => (
              <tr key={g}>
                <th className="sticky left-0 bg-background pr-1 text-left font-medium">{g}</th>
                {grades.map((_, j) => {
                  const v = matrix[i]?.[j] ?? 0
                  const a = v / max
                  return (
                    <td key={j} className="p-px">
                      <div
                        className="flex h-6 items-center justify-center rounded-[2px]"
                        style={{
                          background:
                            v === 0
                              ? "transparent"
                              : `color-mix(in oklch, currentColor ${(6 + a * 74).toFixed(1)}%, transparent)`,
                          outline: i === j ? "1px solid currentColor" : undefined,
                          outlineOffset: -1,
                        }}
                      >
                        <span style={{ opacity: v === 0 ? 0.25 : a > 0.55 ? 1 : 0.85 }}>
                          {v === 0 ? "·" : v < 1 ? "<1" : Math.round(v)}
                        </span>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
        {grades.map((g, i) => (
          <li key={g} className="flex items-center gap-1.5 tabular-nums">
            <span className="w-8 font-medium text-foreground">{g}</span>
            <span className="w-14">stays {stability[i].toFixed(0)}%</span>
            <span aria-hidden>↑</span>
            <span className="w-9">{upgraded[i].toFixed(1)}%</span>
            <span aria-hidden>↓</span>
            <span className="w-9">{downgraded[i].toFixed(1)}%</span>
            <span className="sr-only">
              {upgraded[i].toFixed(1)}% upgraded, {downgraded[i].toFixed(1)}% downgraded
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground">Outlined cell is the unchanged grade</p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CashConversion — DSO + DIO − DPO laid out on one axis so the cash gap
 * is a visible distance, not an arithmetic claim.
 * ------------------------------------------------------------------ */
export function CashConversion({
  dso,
  dio,
  dpo,
  className = "",
}: {
  /** days sales outstanding */
  dso: number
  /** days inventory outstanding */
  dio: number
  /** days payables outstanding */
  dpo: number
  className?: string
}) {
  const operating = dio + dso
  const ccc = operating - dpo
  const span = Math.max(operating, dpo, 1)
  const pc = (d: number) => (d / span) * 100

  const Bar = ({
    label,
    from,
    to,
    hatch,
  }: {
    label: string
    from: number
    to: number
    hatch?: boolean
  }) => (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="relative h-5 flex-1">
        <div
          className="absolute inset-y-0 rounded-[2px] border border-foreground/50"
          style={{
            left: `${pc(from)}%`,
            width: `${Math.max(0.6, pc(to - from))}%`,
            background: hatch
              ? "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 5px)"
              : "color-mix(in oklch, currentColor 22%, transparent)",
          }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-[11px] tabular-nums">{(to - from).toFixed(0)}d</span>
    </div>
  )

  return (
    <div className={className}>
      <div className="space-y-1.5">
        <Bar label="Inventory held" from={0} to={dio} />
        <Bar label="Receivables" from={dio} to={operating} />
        <Bar label="Payables (float)" from={0} to={dpo} hatch />
      </div>
      <div className="relative mt-2 h-6">
        <div className="absolute inset-x-0 top-0 flex items-center gap-2">
          <span className="w-24 shrink-0 text-[11px] font-medium">Cash gap</span>
          <div className="relative h-5 flex-1">
            <div
              className="absolute inset-y-0 flex items-center justify-center rounded-[2px] bg-foreground text-[10px] font-medium text-background"
              style={{
                left: `${pc(Math.min(dpo, operating))}%`,
                width: `${Math.max(2, pc(Math.abs(ccc)))}%`,
              }}
            >
              {Math.abs(ccc) > 8 ? `${ccc.toFixed(0)}d` : ""}
            </div>
          </div>
          <span className="w-12 shrink-0 text-right text-[11px] font-medium tabular-nums">{ccc.toFixed(0)}d</span>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {ccc < 0
          ? "Negative cycle — suppliers fund the working capital"
          : `Cash is tied up for ${ccc.toFixed(0)} days between paying and being paid`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CovenantHeadroom — distance to each covenant threshold, normalised so
 * ratios with opposite polarity read the same way.
 * ------------------------------------------------------------------ */
export type Covenant = {
  name: string
  actual: number
  limit: number
  /** "max" — actual must stay below limit (leverage); "min" — above (coverage) */
  direction: "max" | "min"
  unit?: string
}

export function CovenantHeadroom({ covenants, className = "" }: { covenants: Covenant[]; className?: string }) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!covenants.length) return null

  const rows = covenants.map((c) => {
    const headroom = c.direction === "max" ? (c.limit - c.actual) / Math.abs(c.limit || 1) : (c.actual - c.limit) / Math.abs(c.limit || 1)
    return { ...c, headroom, breached: headroom < 0 }
  })
  const worst = rows.reduce((a, b) => (b.headroom < a.headroom ? b : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => {
          const pct = clamp(r.headroom, -0.5, 0.5)
          return (
            <li key={r.name}>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="font-medium">{r.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {r.actual.toFixed(2)}
                  {r.unit ?? ""} vs {r.direction === "max" ? "≤" : "≥"} {r.limit.toFixed(2)}
                  {r.unit ?? ""}
                </span>
              </div>
              <div className="relative mt-1 h-4 rounded-[2px] bg-muted">
                <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/50" />
                <div
                  className="absolute inset-y-0 rounded-[2px]"
                  style={{
                    left: pct >= 0 ? "50%" : `${50 + pct * 100}%`,
                    width: `${Math.max(1, Math.abs(pct) * 100)}%`,
                    background: r.breached
                      ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                      : "color-mix(in oklch, currentColor 32%, transparent)",
                    border: r.breached ? "1px solid currentColor" : undefined,
                  }}
                />
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                <span aria-hidden>{r.breached ? "✗" : "✓"}</span>
                <span>
                  {r.breached ? "breached by" : "headroom"} {(Math.abs(r.headroom) * 100).toFixed(1)}%
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Tightest: {worst.name} at {(worst.headroom * 100).toFixed(1)}% · centre line is the threshold, hatched means
        breached
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DurationGap — asset and liability repricing by bucket, with the gap
 * and cumulative gap derived.
 * ------------------------------------------------------------------ */
export function DurationGap({
  buckets,
  height = 150,
  className = "",
}: {
  buckets: { label: string; assets: number; liabilities: number }[]
  height?: number
  className?: string
}) {
  const gaps = buckets.map((b) => b.assets - b.liabilities)
  const cum = gaps.reduce<number[]>((a, g) => [...a, (a[a.length - 1] ?? 0) + g], [])
  const max = Math.max(...buckets.map((b) => Math.max(b.assets, b.liabilities)), 1)
  const cumMax = Math.max(1, ...cum.map(Math.abs))
  const closing = cum[cum.length - 1] ?? 0
  const widest = gaps.reduce((a, g) => (Math.abs(g) > Math.abs(a) ? g : a), 0)

  return (
    <div className={className}>
      {/* items-stretch, not items-end: with items-end each column shrinks to its
          content and the bar area's height:100% resolves against auto — every bar
          collapses to nothing. min-h-0 lets the bar area actually take the space. */}
      <div className="flex items-stretch gap-1.5" style={{ height }}>
        {buckets.map((b, i) => (
          <div key={b.label} className="flex flex-1 flex-col items-center gap-px">
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {gaps[i] >= 0 ? "+" : "−"}
              {Math.abs(gaps[i])}
            </span>
            <div className="flex w-full min-h-0 flex-1 items-end justify-center gap-px">
              <div
                className="w-1/2 rounded-t-[2px] bg-foreground/70"
                style={{ height: `${(b.assets / max) * 100}%` }}
                title={`assets ${b.assets}`}
              />
              <div
                className="w-1/2 rounded-t-[2px] border border-foreground/60"
                style={{
                  height: `${(b.liabilities / max) * 100}%`,
                  background: "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)",
                }}
                title={`liabilities ${b.liabilities}`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {buckets.map((b) => (
          <span key={b.label} className="flex-1 text-center text-[9px] text-muted-foreground">
            {b.label}
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {cum.map((c, i) => (
          <div key={i} className="relative h-6 flex-1 rounded-[2px] bg-muted">
            <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/40" />
            <div
              className="absolute inset-y-1 bg-foreground"
              style={{
                left: c >= 0 ? "50%" : `${50 - (Math.abs(c) / cumMax) * 50}%`,
                width: `${(Math.abs(c) / cumMax) * 50}%`,
              }}
            />
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Solid = assets, hatched = liabilities · lower strip is cumulative gap, ending{" "}
        {/* a closing gap of exactly zero is BALANCED, not asset-sensitive — >= 0
            would report a matched book as tilted one way */}
        {closing === 0
          ? "matched"
          : `${closing > 0 ? "asset" : "liability"}-sensitive at ${closing > 0 ? "+" : "−"}${Math.abs(closing)}`}
        {" · widest single-bucket gap "}
        {widest >= 0 ? "+" : "−"}
        {Math.abs(widest)} at {buckets[gaps.indexOf(widest)]?.label}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * WaterfallDistribution — a fund distribution waterfall. Every tier's
 * split is SOLVED from the proceeds, not listed.
 * ------------------------------------------------------------------ */
export function WaterfallDistribution({
  contributed,
  proceeds,
  preferredReturn,
  catchUpRate = 1,
  carry = 0.2,
  className = "",
}: {
  contributed: number
  proceeds: number
  /** hurdle as a fraction, e.g. 0.08 */
  preferredReturn: number
  /** GP share during catch-up, 1 = full catch-up */
  catchUpRate?: number
  carry?: number
  className?: string
}) {
  let left = Math.max(0, proceeds)
  const tiers: { name: string; lp: number; gp: number }[] = []

  const roc = Math.min(left, contributed)
  tiers.push({ name: "Return of capital", lp: roc, gp: 0 })
  left -= roc

  const pref = Math.min(left, contributed * preferredReturn)
  tiers.push({ name: `Preferred ${(preferredReturn * 100).toFixed(0)}%`, lp: pref, gp: 0 })
  left -= pref

  // catch-up: GP takes catchUpRate until it holds `carry` of profit distributed so far
  const target = (carry / (1 - carry)) * pref
  const cu = Math.min(left, catchUpRate > 0 ? target / catchUpRate : 0)
  tiers.push({ name: "GP catch-up", lp: cu * (1 - catchUpRate), gp: cu * catchUpRate })
  left -= cu

  tiers.push({ name: `Split ${((1 - carry) * 100).toFixed(0)}/${(carry * 100).toFixed(0)}`, lp: left * (1 - carry), gp: left * carry })

  const totalLp = tiers.reduce((a, t) => a + t.lp, 0)
  const totalGp = tiers.reduce((a, t) => a + t.gp, 0)
  const max = Math.max(1e-9, ...tiers.map((t) => t.lp + t.gp))

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {tiers.map((t) => {
          const tot = t.lp + t.gp
          return (
            <li key={t.name}>
              <div className="flex items-baseline justify-between text-[11px]">
                <span>{t.name}</span>
                <span className="tabular-nums text-muted-foreground">{money(tot)}</span>
              </div>
              <div className="mt-0.5 flex h-4 gap-px" style={{ width: `${Math.max(1, (tot / max) * 100)}%` }}>
                {t.lp > 0 && (
                  <div
                    className="rounded-l-[2px] bg-foreground/30"
                    style={{ width: `${(t.lp / Math.max(tot, 1e-9)) * 100}%` }}
                    title={`LP ${money(t.lp)}`}
                  />
                )}
                {t.gp > 0 && (
                  <div
                    className="rounded-r-[2px] bg-foreground"
                    style={{ width: `${(t.gp / Math.max(tot, 1e-9)) * 100}%` }}
                    title={`GP ${money(t.gp)}`}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">LP total</dt>
          <dd className="font-medium tabular-nums">{money(totalLp)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">GP total</dt>
          <dd className="font-medium tabular-nums">{money(totalGp)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">LP multiple</dt>
          <dd className="font-medium tabular-nums">{(totalLp / Math.max(contributed, 1e-9)).toFixed(2)}×</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">Light segment is LP, solid is GP</p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * FactorExposure — active weights against a benchmark, with the
 * contribution to active risk derived from exposure × factor volatility.
 * ------------------------------------------------------------------ */
export function FactorExposure({
  factors,
  className = "",
}: {
  factors: { name: string; portfolio: number; benchmark: number; volatility?: number }[]
  className?: string
}) {
  const rows = factors.map((f) => {
    const active = f.portfolio - f.benchmark
    return { ...f, active, contribution: Math.abs(active) * (f.volatility ?? 1) }
  })
  const maxActive = Math.max(0.01, ...rows.map((r) => Math.abs(r.active)))
  const totalContribution = rows.reduce((a, r) => a + r.contribution, 0)
  const ordered = [...rows].sort((a, b) => Math.abs(b.active) - Math.abs(a.active))

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {ordered.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-[11px]">{r.name}</span>
            <div className="relative h-4 flex-1 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/40" />
              <div
                className="absolute inset-y-0.5 rounded-[1px] bg-foreground"
                style={{
                  left: r.active >= 0 ? "50%" : `${50 - (Math.abs(r.active) / maxActive) * 48}%`,
                  width: `${(Math.abs(r.active) / maxActive) * 48}%`,
                }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-[11px] tabular-nums">
              {r.active >= 0 ? "+" : "−"}
              {Math.abs(r.active).toFixed(2)}
            </span>
            <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {totalContribution > 0 ? ((r.contribution / totalContribution) * 100).toFixed(0) : "0"}%
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Active weight versus benchmark, largest tilt first · right column is share of active risk (exposure × factor
        volatility)
      </p>
    </div>
  )
}
