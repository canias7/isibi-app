/**
 * Intellectual-property primitives — patent families, claim scope, citation
 * lag, expiry, filing strategy and prior art.
 *
 * The family's coverage gaps, the independent claim's narrowing through
 * prosecution, the lag distribution, the revenue cliff at each expiry, the cost
 * of a filing programme and the closest prior art are all DERIVED. A claim-scope
 * chart that takes "broad" as a prop is a marketing slide.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) => "$" + Math.round(Math.abs(v)).toLocaleString("en-US")

/* ------------------------------------------------------------------ *
 * PatentFamily — members by jurisdiction and status, with the coverage
 * gaps against the markets that matter derived.
 * ------------------------------------------------------------------ */
export function PatentFamily({
  members,
  markets,
  className = "",
}: {
  members: { jurisdiction: string; status: "granted" | "pending" | "abandoned" | "refused"; filedYear: number }[]
  /** the jurisdictions the business actually sells into, with their share */
  markets: { jurisdiction: string; revenueShare: number }[]
  className?: string
}) {
  const byJur = new Map<string, (typeof members)[number][]>()
  members.forEach((m) => byJur.set(m.jurisdiction, [...(byJur.get(m.jurisdiction) ?? []), m]))
  const rows = markets.map((mk) => {
    const here = byJur.get(mk.jurisdiction) ?? []
    const granted = here.some((m) => m.status === "granted")
    const pending = here.some((m) => m.status === "pending")
    return { ...mk, here, covered: granted, pending, uncovered: !granted && !pending }
  })
  const exposed = rows.filter((r) => r.uncovered)
  const exposedShare = exposed.reduce((a, r) => a + r.revenueShare, 0)
  const grantedShare = rows.filter((r) => r.covered).reduce((a, r) => a + r.revenueShare, 0)
  const orphans = [...byJur.keys()].filter((j) => !markets.some((m) => m.jurisdiction === j))
  const glyph = (s: string) => (s === "granted" ? "●" : s === "pending" ? "◐" : s === "refused" ? "✕" : "○")

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows
          .slice()
          .sort((a, b) => b.revenueShare - a.revenueShare)
          .map((r) => (
            <li key={r.jurisdiction} className="flex items-center gap-2">
              <span className="w-16 shrink-0 truncate text-[11px]">{r.jurisdiction}</span>
              <div className="h-4 flex-1 rounded-[2px] bg-muted">
                <div
                  className="h-full rounded-[2px]"
                  style={{
                    width: `${(r.revenueShare / Math.max(...markets.map((m) => m.revenueShare))) * 100}%`,
                    background: r.covered
                      ? "color-mix(in oklch, currentColor 55%, transparent)"
                      : r.pending
                        ? "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)"
                        : "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)",
                    outline: r.uncovered ? "1px solid currentColor" : undefined,
                    outlineOffset: -1,
                  }}
                />
              </div>
              <span className="w-40 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                {(r.revenueShare * 100).toFixed(0)}% of revenue ·{" "}
                {r.here.length ? r.here.map((m) => `${glyph(m.status)} ${m.status}`).join(", ") : "no filing"}
              </span>
            </li>
          ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        {(grantedShare * 100).toFixed(0)}% of revenue sits behind a granted patent ·{" "}
        {exposed.length
          ? `${exposed.map((e) => e.jurisdiction).join(", ")} have no filing at all — ${(exposedShare * 100).toFixed(0)}% of revenue with nothing behind it`
          : "every market has at least a pending application"}
        {orphans.length ? ` · ${orphans.length} filing${orphans.length === 1 ? "" : "s"} in markets with no recorded revenue` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ClaimScope — how an independent claim narrows through prosecution.
 * The scope is measured by the LIMITATIONS added, which is the only
 * honest proxy, and stated as such.
 * ------------------------------------------------------------------ */
export function ClaimScope({
  versions,
  className = "",
}: {
  versions: { label: string; limitations: string[]; date?: string }[]
  className?: string
}) {
  const rows = versions.map((v, i) => {
    const prev = versions[i - 1]?.limitations ?? []
    const added = v.limitations.filter((l) => !prev.includes(l))
    const removed = prev.filter((l) => !v.limitations.includes(l))
    return { ...v, added, removed, count: v.limitations.length }
  })
  const first = rows[0]
  const last = rows[rows.length - 1]
  const max = Math.max(...rows.map((r) => r.count))
  const totalAdded = rows.slice(1).reduce((a, r) => a + r.added.length, 0)

  return (
    <div className={className}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="font-medium">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.count} limitation{r.count === 1 ? "" : "s"}
                {r.date ? ` · ${r.date}` : ""}
              </span>
            </div>
            {/* scope shrinks as limitations accumulate — the bar is the inverse */}
            <div className="mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px] bg-foreground/50"
                style={{ width: `${((max + 1 - r.count) / (max + 1)) * 100}%` }}
              />
            </div>
            {(r.added.length > 0 || r.removed.length > 0) && (
              <ul className="mt-0.5 space-y-px text-[9px] text-muted-foreground">
                {r.added.map((a) => (
                  <li key={a}>
                    <span aria-hidden>+</span> {a}
                  </li>
                ))}
                {r.removed.map((a) => (
                  <li key={a}>
                    <span aria-hidden>−</span> {a}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Bar length is inverse limitation count, which is a PROXY for scope and not a measurement of it — no chart can
        read a claim · {first.label} carried {first.count} limitations and {last.label} carries {last.count},{" "}
        {totalAdded} added during prosecution, and every one of them is a way around the claim
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CitationLag — how long after publication a patent starts being cited,
 * with the median lag and the still-accruing tail derived.
 * ------------------------------------------------------------------ */
export function CitationLag({
  citations,
  publishedYear,
  currentYear,
  height = 190,
  className = "",
}: {
  /** the year each forward citation was filed */
  citations: number[]
  publishedYear: number
  currentYear: number
  height?: number
  className?: string
}) {
  const lags = citations.map((c) => c - publishedYear).filter((l) => l >= 0).sort((a, b) => a - b)
  const maxLag = currentYear - publishedYear
  const buckets = Array.from({ length: maxLag + 1 }, (_, i) => lags.filter((l) => l === i).length)
  const cumulative = buckets.reduce<number[]>((a, v) => [...a, (a[a.length - 1] ?? 0) + v], [])
  const median = lags.length ? lags[Math.floor(lags.length / 2)] : 0
  const half = cumulative.findIndex((c) => c >= lags.length / 2)
  const recentThird = buckets.slice(-Math.max(1, Math.ceil(buckets.length / 3))).reduce((a, v) => a + v, 0)
  const stillAccruing = recentThird / Math.max(lags.length, 1) > 0.25
  const max = Math.max(1, ...buckets)

  return (
    <div className={className}>
      <div className="relative flex items-end gap-1" style={{ height }}>
        {buckets.map((v, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t-[1px] bg-foreground/60"
              style={{ height: `${(v / max) * 100}%` }}
              title={`year ${i}: ${v} citation${v === 1 ? "" : "s"}`}
            />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${(half / Math.max(buckets.length, 1)) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>publication</span>
        <span>+{maxLag} years</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Citations</dt>
          <dd className="font-medium tabular-nums">{lags.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Median lag</dt>
          <dd className="font-medium tabular-nums">{median} yr</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Half by</dt>
          <dd className="font-medium tabular-nums">year {half}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {stillAccruing
          ? "A quarter of the citations arrived in the last third of the window, so this count is still growing — comparing it to an older patent's total is comparing a partial to a finished number"
          : "The tail has flattened, so this citation count is close to its final value"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ExpiryCliff — revenue by patent against its expiry date, with the
 * cliff at each year computed.
 * ------------------------------------------------------------------ */
export function ExpiryCliff({
  patents,
  fromYear,
  toYear,
  height = 200,
  className = "",
}: {
  patents: { name: string; expiryYear: number; annualRevenue: number }[]
  fromYear: number
  toYear: number
  height?: number
  className?: string
}) {
  const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i)
  const protectedBy = years.map((y) => patents.filter((p) => p.expiryYear >= y))
  const revenue = protectedBy.map((ps) => ps.reduce((a, p) => a + p.annualRevenue, 0))
  const drops = years.map((y, i) => (i === 0 ? 0 : revenue[i - 1] - revenue[i]))
  const worstIdx = drops.indexOf(Math.max(...drops))
  const max = Math.max(...revenue) || 1
  const total = patents.reduce((a, p) => a + p.annualRevenue, 0)

  return (
    <div className={className}>
      <div className="flex items-end gap-px" style={{ height }}>
        {revenue.map((v, i) => (
          <div
            key={years[i]}
            className="min-w-0 flex-1 rounded-t-[1px]"
            style={{
              height: `${(v / max) * 100}%`,
              background: i === worstIdx ? "currentColor" : "color-mix(in oklch, currentColor 42%, transparent)",
            }}
            title={`${years[i]}: ${money(v)} protected by ${protectedBy[i].length} patent${protectedBy[i].length === 1 ? "" : "s"}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{fromYear}</span>
        <span>{toYear}</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {[...patents]
          .sort((a, b) => a.expiryYear - b.expiryYear)
          .map((p) => (
            <li key={p.name} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate">{p.name}</span>
              <span className="text-muted-foreground">
                expires {p.expiryYear} · {money(p.annualRevenue)}/yr ({((p.annualRevenue / Math.max(total, 1)) * 100).toFixed(0)}%)
              </span>
            </li>
          ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        The tallest cliff is {years[worstIdx]}, when {money(drops[worstIdx])} of protected revenue falls off in one year
        — {((drops[worstIdx] / Math.max(total, 1)) * 100).toFixed(0)}% of the portfolio · by {toYear},{" "}
        {money(revenue[revenue.length - 1])} is still protected
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * FilingJurisdictions — the cost of a filing programme over its life,
 * with renewals compounded rather than quoted as a headline.
 * ------------------------------------------------------------------ */
export function FilingJurisdictions({
  jurisdictions,
  years = 20,
  className = "",
}: {
  jurisdictions: { name: string; filingCost: number; annualRenewal: number; renewalGrowth?: number; marketShare?: number }[]
  years?: number
  className?: string
}) {
  const rows = jurisdictions.map((j) => {
    let renewals = 0
    let fee = j.annualRenewal
    for (let y = 1; y <= years; y++) {
      renewals += fee
      fee *= 1 + (j.renewalGrowth ?? 0.08)
    }
    const lifetime = j.filingCost + renewals
    return { ...j, renewals, lifetime, perShare: j.marketShare ? lifetime / j.marketShare : null }
  })
  const total = rows.reduce((a, r) => a + r.lifetime, 0)
  const totalFiling = rows.reduce((a, r) => a + r.filingCost, 0)
  const max = Math.max(...rows.map((r) => r.lifetime))
  const worstValue = rows.filter((r) => r.perShare !== null).sort((a, b) => (b.perShare ?? 0) - (a.perShare ?? 0))[0]

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows
          .slice()
          .sort((a, b) => b.lifetime - a.lifetime)
          .map((r) => (
            <li key={r.name}>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="truncate">{r.name}</span>
                <span className="tabular-nums text-muted-foreground">{money(r.lifetime)} over {years} years</span>
              </div>
              <div className="mt-0.5 flex h-4 gap-px" style={{ width: `${(r.lifetime / max) * 100}%` }}>
                <div className="rounded-l-[2px] bg-foreground" style={{ width: `${(r.filingCost / r.lifetime) * 100}%` }} title={`filing ${money(r.filingCost)}`} />
                <div
                  className="rounded-r-[2px] border border-foreground/45"
                  style={{ width: `${(r.renewals / r.lifetime) * 100}%`, background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 5px)" }}
                  title={`renewals ${money(r.renewals)}`}
                />
              </div>
              <span className="text-[9px] tabular-nums text-muted-foreground">
                {money(r.filingCost)} to file, {money(r.renewals)} in renewals
                {r.marketShare ? ` · ${(r.marketShare * 100).toFixed(0)}% of the market` : ""}
              </span>
            </li>
          ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Solid is filing, hatched is renewals compounded at the stated growth — {money(totalFiling)} to file becomes{" "}
        {money(total)} over {years} years, which is the number a filing decision is actually about
        {worstValue ? ` · ${worstValue.name} costs the most per point of market share` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PriorArtMap — references scored against each claim element, so the
 * closest reference and the element nothing discloses are found.
 * ------------------------------------------------------------------ */
export function PriorArtMap({
  elements,
  references,
  disclosure,
  className = "",
}: {
  elements: string[]
  references: { id: string; date: string }[]
  /** disclosure[reference][element]: 0 none, 1 arguably, 2 clearly */
  disclosure: number[][]
  className?: string
}) {
  const scores = references.map((_, ri) => elements.reduce((a, _e, ei) => a + (disclosure[ri]?.[ei] ?? 0), 0))
  const closest = scores.indexOf(Math.max(...scores))
  const perElement = elements.map((_, ei) => references.reduce((a, _r, ri) => a + (disclosure[ri]?.[ei] ?? 0), 0))
  const undisclosed = elements.filter((_, ei) => perElement[ei] === 0)
  const anticipated = scores.some((s) => s === elements.length * 2)
  const glyph = ["·", "◐", "●"]

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px]">
          <thead>
            <tr>
              <th className="pr-1.5 pb-1 text-left font-normal text-muted-foreground">reference \ element</th>
              {elements.map((e) => (
                <th key={e} className="px-0.5 pb-1 font-medium">
                  {/* max-w-[3rem] and a narrower reference column: at 4rem the
                      sixth element ran off the right-hand edge of the card */}
                  <span className="block max-w-[3rem] truncate" title={e}>
                    {e}
                  </span>
                </th>
              ))}
              <th className="pl-1.5 pb-1 font-medium">score</th>
            </tr>
          </thead>
          <tbody>
            {references.map((r, ri) => (
              <tr key={r.id}>
                <th className="pr-1.5 text-left font-normal">
                  <span className="block max-w-[7rem] truncate">
                    {r.id} <span className="text-muted-foreground">{r.date}</span>
                  </span>
                </th>
                {elements.map((e, ei) => {
                  const d = disclosure[ri]?.[ei] ?? 0
                  return (
                    <td key={e} className="p-px">
                      <div
                        className="flex h-6 items-center justify-center rounded-[2px]"
                        style={{ background: `color-mix(in oklch, currentColor ${d * 26}%, transparent)` }}
                        title={`${r.id} × ${e}: ${["not disclosed", "arguably disclosed", "clearly disclosed"][d]}`}
                      >
                        <span aria-hidden>{glyph[d]}</span>
                        <span className="sr-only">{["not disclosed", "arguably disclosed", "clearly disclosed"][d]}</span>
                      </div>
                    </td>
                  )
                })}
                <td className="pl-1.5 text-center font-medium tabular-nums" style={{ textDecoration: ri === closest ? "underline" : undefined }}>
                  {scores[ri]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        {references[closest]?.id} is the closest art at {scores[closest]} of {elements.length * 2} ·{" "}
        {anticipated
          ? "one reference discloses every element clearly, which is anticipation rather than obviousness"
          : undisclosed.length
            ? `nothing discloses ${undisclosed.join(", ")} — that element is where the claim survives, and it is what a narrowing amendment should be built around`
            : "every element is disclosed somewhere, so the case rests on combination rather than on any single element"}
      </p>
    </div>
  )
}
