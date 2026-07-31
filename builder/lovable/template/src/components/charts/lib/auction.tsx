/**
 * Auction house primitives — estimate accuracy, the hammer ladder, unsold
 * lots against their reserve, bidder depth, consignment sources and the two
 * halves of the premium.
 *
 * Whether the estimates are biased rather than merely wrong, how much of a
 * sale sits in a handful of lots, which reserve position actually predicts a
 * bought-in, whether a price was a market or a duel, what each source earns
 * and the total take rate neither party sees are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
const money = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e6 ? `£${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `£${(a / 1e3).toFixed(1)}k` : `£${Math.round(a).toLocaleString("en-GB")}`
  return v < 0 ? `−${s}` : s
}

/* ------------------------------------------------------------------ *
 * EstimateAccuracy — hammer against the estimate range, with the BIAS
 * derived. Estimates are reviewed lot by lot as hits and misses, which
 * cannot distinguish a valuer who is imprecise from one who is
 * consistently low — and only the second is a fixable habit.
 * ------------------------------------------------------------------ */
export function EstimateAccuracy({
  lots,
  className = "",
}: {
  lots: { name: string; lowEstimate: number; highEstimate: number; hammer: number | null }[]
  className?: string
}) {
  const sold = lots.filter((l) => l.hammer !== null)
  const rows = lots.map((l) => {
    const mid = (l.lowEstimate + l.highEstimate) / 2
    const h = l.hammer
    return {
      ...l,
      mid,
      // where the hammer landed on the estimate range: 0 is the low, 1 the
      // high, and outside that is above or below the whole range
      position: h === null ? null : (h - l.lowEstimate) / Math.max(l.highEstimate - l.lowEstimate, 1e-9),
      ratio: h === null ? null : h / Math.max(mid, 1e-9),
    }
  })
  const positions = rows.map((r) => r.position).filter((p): p is number => p !== null)
  const ratios = rows.map((r) => r.ratio).filter((p): p is number => p !== null)
  const meanRatio = ratios.length ? ratios.reduce((a, v) => a + v, 0) / ratios.length : null
  const within = positions.filter((p) => p >= 0 && p <= 1).length
  const above = positions.filter((p) => p > 1).length
  const below = positions.filter((p) => p < 0).length
  const lo = Math.min(-0.6, ...positions) - 0.15
  const hi = Math.max(1.6, ...positions) + 0.15
  const px = (p: number) => ((p - lo) / Math.max(hi - lo, 1e-9)) * 100

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span className="w-32 shrink-0 truncate">{r.name}</span>
            <div className="relative h-4 flex-1 rounded-[1px] bg-muted">
              <div className="absolute inset-y-0 bg-foreground/18" style={{ left: `${px(0)}%`, width: `${px(1) - px(0)}%` }} title={`estimate ${money(r.lowEstimate)}–${money(r.highEstimate)}`} />
              <span className="absolute inset-y-1 w-px bg-foreground/50" style={{ left: `${px(0.5)}%` }} />
              {r.position === null ? (
                <span className="absolute inset-y-0 flex items-center pl-1 text-[9px] text-muted-foreground" style={{ left: `${px(0)}%` }}>
                  unsold
                </span>
              ) : (
                <span
                  className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground"
                  style={{ left: `${clamp(px(r.position), 0.5, 99.5)}%`, background: r.position >= 0 && r.position <= 1 ? "currentColor" : "var(--background)" }}
                  title={`hammer ${money(r.hammer ?? 0)}`}
                />
              )}
            </div>
            <span className="w-28 shrink-0 text-right text-muted-foreground">
              {r.hammer === null ? "bought in" : `${money(r.hammer)} · ×${(r.ratio ?? 0).toFixed(2)}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The shaded block is the estimate range, the tick its midpoint, and the dot the hammer — hollow when it landed
        outside the range altogether · {within} of {sold.length} sold lots fell inside their estimate,{" "}
        {above} above and {below} below ·{" "}
        {meanRatio === null
          ? "nothing sold, so there is no accuracy to measure"
          : Math.abs(meanRatio - 1) < 0.05
            ? `the hammer averages ×${meanRatio.toFixed(2)} the midpoint, so the estimates are imprecise rather than biased and the answer is a wider range, not a different number`
            : `the hammer averages ×${meanRatio.toFixed(2)} the midpoint, which is a consistent ${meanRatio > 1 ? "UNDER" : "OVER"}-estimate — a habit, not a scatter, and the only kind of error a valuer can be asked to correct`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * HammerLadder — lots by hammer price with the CONCENTRATION derived.
 * A sale total is reported as one number and is usually a handful of
 * lots plus a long tail that costs as much to catalogue, photograph
 * and store as the lots that paid for the day.
 * ------------------------------------------------------------------ */
export function HammerLadder({
  lots,
  costPerLot,
  className = "",
}: {
  lots: { name: string; hammer: number }[]
  /** cataloguing, photography, storage and floor time, per lot */
  costPerLot: number
  className?: string
}) {
  const rows = [...lots].sort((a, b) => b.hammer - a.hammer)
  const total = rows.reduce((a, r) => a + r.hammer, 0)
  const max = Math.max(...rows.map((r) => r.hammer), 1)
  const min = Math.min(...rows.map((r) => r.hammer), max)
  // a sale spans orders of magnitude, so a linear axis draws the tail as
  // nothing at all — logarithmic, and said so
  const floor = Math.max(min * 0.7, 1)
  const w = (v: number) => clamp(((Math.log(Math.max(v, floor)) - Math.log(floor)) / Math.max(Math.log(max) - Math.log(floor), 1e-9)) * 100, 2, 100)
  let running = 0
  const cumulative = rows.map((r) => {
    running += r.hammer
    return running / Math.max(total, 1e-9)
  })
  const halfAt = cumulative.findIndex((c) => c >= 0.5)
  const topTen = rows.slice(0, Math.min(10, rows.length)).reduce((a, r) => a + r.hammer, 0)
  const belowCost = rows.filter((r) => r.hammer < costPerLot * 5)

  return (
    <div className={className}>
      <ul className="space-y-1">
        {rows.slice(0, 14).map((r, i) => (
          <li key={r.name} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span className="w-6 shrink-0 text-muted-foreground">{i + 1}</span>
            <span className="w-32 shrink-0 truncate">{r.name}</span>
            <div className="relative h-3.5 flex-1 rounded-[1px] bg-muted">
              <div className="absolute inset-y-0 rounded-[1px] bg-foreground/55" style={{ width: `${w(r.hammer)}%` }} title={`${money(r.hammer)}`} />
              <span className="absolute inset-y-0 w-px bg-foreground/70" style={{ left: `${clamp(cumulative[i] * 100, 0, 99.5)}%` }} title={`${(cumulative[i] * 100).toFixed(0)}% of the sale by this lot`} />
            </div>
            <span className="w-24 shrink-0 text-right text-muted-foreground">{money(r.hammer)}</span>
          </li>
        ))}
      </ul>
      {rows.length > 14 && (
        <p className="mt-1 text-[9px] tabular-nums text-muted-foreground">
          … and {rows.length - 14} more lots below, {money(rows.slice(14).reduce((a, r) => a + r.hammer, 0))} between
          them
        </p>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Bar widths are LOGARITHMIC — a sale spans ×{(max / Math.max(min, 1e-9)).toFixed(0)} from top lot to bottom
        and a linear axis draws most of the catalogue as a stub · the tick is the running share of the sale:{" "}
        {halfAt >= 0 ? `half the money is in the top ${halfAt + 1} ${plural(halfAt + 1, "lot", "lots")} of ${rows.length}` : "no single group reaches half"}
        , and the top ten carry {((topTen / Math.max(total, 1)) * 100).toFixed(0)}% of {money(total)} ·{" "}
        {belowCost.length === 0
          ? `every lot clears five times the ${money(costPerLot)} it costs to catalogue`
          : `${belowCost.length} of ${rows.length} lots hammer at under five times the ${money(costPerLot)} it costs to catalogue, photograph and store one — the tail is not free and it is not small`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * UnsoldRate — bought-in lots by where the reserve sat against the low
 * estimate. Unsold rate is reported by category, which is a fact about
 * taste; the reserve position is a fact about the negotiation with the
 * seller, and it is the one the house controls.
 * ------------------------------------------------------------------ */
export function UnsoldRate({
  bands,
  className = "",
}: {
  /** reserve as a share of the low estimate, banded */
  bands: { label: string; lots: number; unsold: number; meanLowEstimate: number }[]
  className?: string
}) {
  const rows = bands.map((b) => ({
    ...b,
    rate: b.lots > 0 ? b.unsold / b.lots : null,
    value: b.unsold * b.meanLowEstimate,
  }))
  const rated = rows.filter((r) => r.rate !== null)
  const maxRate = Math.max(...rated.map((r) => r.rate ?? 0), 0.05)
  const lots = rows.reduce((a, r) => a + r.lots, 0)
  const unsold = rows.reduce((a, r) => a + r.unsold, 0)
  const overall = unsold / Math.max(lots, 1)
  const value = rows.reduce((a, r) => a + r.value, 0)
  const worst = rated.length ? rated.reduce((a, r) => ((r.rate ?? 0) > (a.rate ?? 0) ? r : a), rated[0]) : null
  const best = rated.length ? rated.reduce((a, r) => ((r.rate ?? 1) < (a.rate ?? 1) ? r : a), rated[0]) : null

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.unsold} of {r.lots} bought in ·{" "}
                {r.rate === null ? "no lots in this band" : `${(r.rate * 100).toFixed(0)}%`}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              {r.rate !== null && (
                <div
                  className="absolute inset-y-0 rounded-[2px]"
                  style={{
                    width: `${clamp((r.rate / maxRate) * 100, 1, 100)}%`,
                    background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)",
                    outline: "1px solid currentColor",
                    outlineOffset: -1,
                  }}
                  title={`${((r.rate ?? 0) * 100).toFixed(0)}% bought in`}
                />
              )}
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${clamp((overall / maxRate) * 100, 0, 99)}%` }} title={`sale average ${(overall * 100).toFixed(0)}%`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.value)} of low estimate went home unsold · mean low estimate {money(r.meanLowEstimate)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Banded by where the RESERVE sat against the low estimate rather than by category, because the category is a
        fact about taste and the reserve is a conversation the house had with the seller · {unsold} of {lots} lots
        were bought in ({(overall * 100).toFixed(0)}%), {money(value)} of low estimate that went home ·{" "}
        {worst && best && worst !== best
          ? `${worst.label} buys in at ${(((worst.rate ?? 0)) * 100).toFixed(0)}% against ${(((best.rate ?? 0)) * 100).toFixed(0)}% for ${best.label} — the same rooms, the same bidders, a different promise made at the door`
          : "there is only one populated band here, so the reserve position cannot be compared"}{" "}
        · the mark on each bar is the sale average, which is the only fair comparison a band has
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * BidderDepth — how many bidders were still in at the hammer. A high
 * price with two bidders is a duel and does not repeat; the same price
 * with nine is a market. Only the second tells a valuer anything about
 * the next one of these to come through the door.
 * ------------------------------------------------------------------ */
export function BidderDepth({
  lots,
  className = "",
}: {
  /** bidders still active at each step of the bidding, ending at the hammer */
  lots: { name: string; hammer: number; lowEstimate: number; biddersAtSteps: number[] }[]
  className?: string
}) {
  const rows = lots
    .map((l) => {
      const atHammer = l.biddersAtSteps[l.biddersAtSteps.length - 1] ?? 0
      const opening = l.biddersAtSteps[0] ?? 0
      return {
        ...l,
        atHammer,
        opening,
        overEstimate: l.hammer / Math.max(l.lowEstimate, 1e-9),
        // a lot carried by two people past its estimate is a duel: the price
        // exists because of who was in the room, not what the thing is worth
        duel: atHammer <= 2 && l.hammer > l.lowEstimate * 1.3,
      }
    })
    .sort((a, b) => b.overEstimate - a.overEstimate)
  const maxSteps = Math.max(...rows.map((r) => r.biddersAtSteps.length))
  const maxBidders = Math.max(...rows.flatMap((r) => r.biddersAtSteps), 1)
  const duels = rows.filter((r) => r.duel)
  const deep = rows.filter((r) => r.atHammer >= 4)
  const meanDepth = rows.reduce((a, r) => a + r.atHammer, 0) / Math.max(rows.length, 1)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">
                <span aria-hidden className="mr-1 inline-block w-3 text-muted-foreground">
                  {r.duel ? "!" : "·"}
                </span>
                {r.name}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {money(r.hammer)} · ×{r.overEstimate.toFixed(2)} low estimate · {r.atHammer} still in
              </span>
            </div>
            <div className="mt-0.5 flex items-end gap-px" style={{ height: 22 }}>
              {Array.from({ length: maxSteps }, (_, i) => {
                const b = r.biddersAtSteps[i]
                return (
                  // relative box, bar pinned to its bottom — a percentage
                  // height needs a parent with a height, and `items-end` on
                  // the row does not give a self-stretching child one
                  <div key={i} className="relative min-w-0 flex-1 self-stretch" title={b === undefined ? "bidding had ended" : `step ${i + 1}: ${b} bidders`}>
                    {b !== undefined && (
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-t-[1px]"
                        style={{
                          height: `${clamp((b / maxBidders) * 100, 3, 100)}%`,
                          background: i === r.biddersAtSteps.length - 1 ? "currentColor" : "color-mix(in oklch, currentColor 32%, transparent)",
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.opening} bidders opened, {r.atHammer} at the hammer ·{" "}
              {r.duel
                ? "carried past estimate by two people — a duel, and it will not repeat"
                : r.atHammer >= 4
                  ? "a real market for this, so the price is repeatable"
                  : "thin at the top, so treat the price as one buyer's"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Each bar is the bidding, step by step, and the last block — drawn solid — is who was still in at the hammer ·{" "}
        {duels.length === 0
          ? "no lot here was carried past its estimate by two people, so every price on this list has a market under it"
          : `${duels.length} of ${rows.length} lots went well past estimate on two bidders — the price is a fact about who was in the room and NOT a comparable for the next one`}{" "}
        · {deep.length} {plural(deep.length, "lot has", "lots have")} four or more bidders at the close, which is
        what makes a price repeatable · mean depth at the hammer is {meanDepth.toFixed(1)}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ConsignmentMix — where the lots came from, with COMMISSION PER LOT
 * derived. Sources are counted by volume, and a source sending fifty
 * small lots on a negotiated rate can be worth less than one sending
 * three at full commission — while costing far more to handle.
 * ------------------------------------------------------------------ */
export function ConsignmentMix({
  sources,
  costPerLot,
  className = "",
}: {
  sources: { name: string; lots: number; hammerTotal: number; sellerCommission: number }[]
  costPerLot: number
  className?: string
}) {
  const rows = sources
    .map((s) => {
      const commission = s.hammerTotal * s.sellerCommission
      const cost = s.lots * costPerLot
      return {
        ...s,
        commission,
        cost,
        net: commission - cost,
        perLot: commission / Math.max(s.lots, 1),
        netPerLot: (commission - cost) / Math.max(s.lots, 1),
        meanLot: s.hammerTotal / Math.max(s.lots, 1),
      }
    })
    .sort((a, b) => b.net - a.net)
  const max = Math.max(...rows.map((r) => Math.abs(r.net)), 1)
  const lots = rows.reduce((a, r) => a + r.lots, 0)
  const commission = rows.reduce((a, r) => a + r.commission, 0)
  const net = rows.reduce((a, r) => a + r.net, 0)
  const mostLots = rows.reduce((a, r) => (r.lots > a.lots ? r : a), rows[0])
  const loss = rows.filter((r) => r.net < 0)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.lots} lots · {money(r.meanLot)} mean · {(r.sellerCommission * 100).toFixed(0)}% commission
              </span>
            </div>
            <div className="relative mt-0.5 h-5 rounded-[2px] bg-muted">
              <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/45" />
              <div
                className="absolute inset-y-0"
                style={{
                  left: r.net >= 0 ? "50%" : `${50 - (Math.abs(r.net) / max) * 50}%`,
                  width: `${(Math.abs(r.net) / max) * 50}%`,
                  background: r.net >= 0 ? "color-mix(in oklch, currentColor 55%, transparent)" : "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px)",
                  outline: r.net < 0 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
                title={`${money(r.net)} after ${money(r.cost)} of handling`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.commission)} of commission less {money(r.cost)} to handle {r.lots} lots ={" "}
              {money(r.net)} · {money(r.netPerLot)} a lot
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Net of the {money(costPerLot)} it costs to catalogue, photograph, store and sell a lot — which is per LOT
        and has nothing to do with what the lot makes, so a source of small consignments is expensive in a way a
        volume count cannot show · {money(commission)} of commission on {lots} lots becomes {money(net)} ·{" "}
        {mostLots.name === rows[0].name
          ? `${rows[0].name} sends the most lots and is also the best after handling`
          : `${mostLots.name} sends the most lots (${mostLots.lots}) and nets ${money(mostLots.netPerLot)} each against ${money(rows[0].netPerLot)} for ${rows[0].name}`}
        {loss.length > 0 ? ` · ${loss.length} ${plural(loss.length, "source costs", "sources cost")} more to handle than it earns, which is a rate conversation rather than a rejection` : " · every source covers its own handling"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PremiumSplit — what the buyer paid against what the seller received,
 * with the TOTAL TAKE derived. The buyer sees a premium, the seller
 * sees a commission, and neither ever sees the two added together —
 * which is the number that decides whether the sale was worth making.
 * ------------------------------------------------------------------ */
export function PremiumSplit({
  tiers,
  sellerCommission,
  className = "",
}: {
  /** buyer's premium bands, applied on the portion of hammer in each band */
  tiers: { upTo: number | null; rate: number }[]
  sellerCommission: number
  className?: string
}) {
  const examples = [1000, 5000, 25000, 100000, 500000]
  const premiumOn = (hammer: number) => {
    let remaining = hammer
    let from = 0
    let premium = 0
    for (const t of tiers) {
      const ceiling = t.upTo ?? Infinity
      const slice = Math.max(0, Math.min(hammer, ceiling) - from)
      if (slice <= 0) break
      premium += slice * t.rate
      remaining -= slice
      from = ceiling
      if (remaining <= 0) break
    }
    return premium
  }
  const rows = examples.map((h) => {
    const premium = premiumOn(h)
    const commission = h * sellerCommission
    return {
      hammer: h,
      premium,
      commission,
      buyerPays: h + premium,
      sellerGets: h - commission,
      take: (premium + commission) / Math.max(h, 1e-9),
      // the spread between the two sides, which is what the house earns
      spread: (h + premium) / Math.max(h - commission, 1e-9) - 1,
    }
  })
  // every row is drawn to FULL width, not to a shared money scale. The example
  // hammers span ×500, so a shared scale draws the small end as a two-pixel
  // sliver — and the small end is where the argument is, because that is where
  // the two sides are furthest apart
  const lowTake = rows[0].take
  const highTake = rows[rows.length - 1].take

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.hammer}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="tabular-nums">{money(r.hammer)} hammer</span>
              <span className="tabular-nums text-muted-foreground">
                buyer pays {money(r.buyerPays)} · seller gets {money(r.sellerGets)}
              </span>
            </div>
            <div className="mt-0.5 flex h-5 rounded-[2px] bg-muted">
              <div className="rounded-l-[2px] bg-foreground/60" style={{ width: `${(r.sellerGets / Math.max(r.buyerPays, 1e-9)) * 100}%` }} title={`to the seller ${money(r.sellerGets)}`} />
              <div
                style={{ width: `${(r.commission / Math.max(r.buyerPays, 1e-9)) * 100}%`, background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 4px)" }}
                title={`seller's commission ${money(r.commission)}`}
              />
              <div
                className="rounded-r-[2px]"
                style={{ width: `${(r.premium / Math.max(r.buyerPays, 1e-9)) * 100}%`, background: "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 4px)", outline: "1px solid currentColor", outlineOffset: -1 }}
                title={`buyer's premium ${money(r.premium)}`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.commission)} commission + {money(r.premium)} premium = {(r.take * 100).toFixed(1)}% of hammer
              to the house · the two sides are {(r.spread * 100).toFixed(1)}% apart
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-[1px] bg-foreground/60" /> reaches the seller
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25" style={{ background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 4px)" }} /> seller's
          commission
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-[1px] border border-foreground/25" style={{ background: "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 4px)" }} /> buyer's
          premium
        </span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The buyer sees a premium, the seller sees a commission, and the bar is the only place the two appear
        together — each row is drawn to full width, so the SPLIT is comparable across hammer prices that span ×500,
        and the money itself is written beside it · the house takes {(lowTake * 100).toFixed(1)}% of hammer at {money(rows[0].hammer)} falling to{" "}
        {(highTake * 100).toFixed(1)}% at {money(rows[rows.length - 1].hammer)}, because the premium is tiered and
        the commission is not · at the small end the two sides of one lot are{" "}
        {(rows[0].spread * 100).toFixed(0)}% apart, which is the number that decides whether a modest consignment is
        worth anybody's afternoon
      </p>
    </div>
  )
}
