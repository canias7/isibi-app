/**
 * Electoral primitives — uniform swing, seat projection, turnout by cohort,
 * coalition arithmetic, preference transfers and malapportionment.
 *
 * The swing needed, the seats that change hands, the majority threshold, every
 * viable coalition, the transfer efficiency and the Gini of voters-per-seat are
 * all DERIVED. A seat projection that takes its own result as a prop is a
 * picture of a claim, not a projection.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * SwingPendulum — seats ordered by margin, with the swing needed for
 * each to change hands computed from the margin itself.
 * ------------------------------------------------------------------ */
export function SwingPendulum({
  seats,
  swing = 0,
  className = "",
}: {
  /** margin is the winner's lead over the runner-up, in points */
  seats: { name: string; holder: string; challenger: string; marginPoints: number }[]
  /** the uniform swing being applied, in points from holder to challenger */
  swing?: number
  className?: string
}) {
  const rows = [...seats]
    .sort((a, b) => a.marginPoints - b.marginPoints)
    .map((s) => ({ ...s, needed: s.marginPoints / 2, falls: swing >= s.marginPoints / 2 }))
  const changing = rows.filter((r) => r.falls)
  const max = Math.max(1, ...rows.map((r) => r.needed))
  const next = rows.find((r) => !r.falls)

  return (
    <div className={className}>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-[11px]">{r.name}</span>
            <div className="relative h-4 flex-1 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px]"
                style={{
                  left: 0,
                  width: `${(r.needed / max) * 100}%`,
                  background: r.falls ? "currentColor" : "color-mix(in oklch, currentColor 22%, transparent)",
                }}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${(swing / max) * 100}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {r.needed.toFixed(1)}% to {r.challenger}
            </span>
            <span className="w-4 shrink-0 text-center text-[11px]" aria-hidden>
              {r.falls ? "●" : "○"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Bar is the swing each seat needs (half the margin) and the tick is the {swing.toFixed(1)}% being applied ·{" "}
        {changing.length} seat{changing.length === 1 ? "" : "s"} change hands
        {next ? `; ${next.name} is next at ${next.needed.toFixed(1)}%` : "; nothing is left to take"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SeatProjection — a parliament arc. The majority line and who can
 * reach it are computed, not stated.
 * ------------------------------------------------------------------ */
export function SeatProjection({
  parties,
  totalSeats,
  size = 300,
  className = "",
}: {
  parties: { name: string; seats: number; low?: number; high?: number }[]
  totalSeats: number
  size?: number
  className?: string
}) {
  const majority = Math.floor(totalSeats / 2) + 1
  const sorted = [...parties].sort((a, b) => b.seats - a.seats)
  const largest = sorted[0]
  const alone = largest && largest.seats >= majority

  // Rows are derived from a MINIMUM readable seat width, not fixed at five. A
  // 648-seat chamber over five rows is 130 flex items whose borders alone are
  // wider than the card, so the block overflowed into the next column entirely.
  const seatPx = 5
  const perRow = Math.max(10, Math.floor(size / seatPx))
  const rows = Math.ceil(totalSeats / perRow)
  const seatList: string[] = []
  sorted.forEach((p) => {
    for (let i = 0; i < p.seats; i++) seatList.push(p.name)
  })
  while (seatList.length < totalSeats) seatList.push("")
  // the majority marker belongs on the row that contains seat number `majority`
  const majorityRow = Math.floor((majority - 1) / perRow)
  const majorityCol = (majority - 1) % perRow

  const fills = ["currentColor", "color-mix(in oklch, currentColor 62%, transparent)", "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 4px)", "color-mix(in oklch, currentColor 28%, transparent)", "repeating-linear-gradient(-45deg, currentColor 0 1.5px, transparent 1.5px 4px)", "color-mix(in oklch, currentColor 12%, transparent)"]
  const fillFor = (name: string) => fills[Math.max(0, sorted.findIndex((p) => p.name === name)) % fills.length]

  return (
    <div className={className}>
      <div className="relative mx-auto w-full" style={{ maxWidth: size }}>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="relative mb-[2px] flex gap-px">
            {seatList.slice(r * perRow, (r + 1) * perRow).map((name, i) => (
              <span
                key={i}
                // min-w-0 or a flex item refuses to shrink below its border box
                className="h-2.5 min-w-0 flex-1 rounded-[1px]"
                style={{ background: name ? fillFor(name) : "color-mix(in oklch, currentColor 6%, transparent)" }}
                title={name || "vacant"}
              />
            ))}
            {r === majorityRow && (
              <span
                className="pointer-events-none absolute -inset-y-1 w-0.5 bg-foreground"
                style={{ left: `${((majorityCol + 1) / perRow) * 100}%` }}
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-1">
        {sorted.map((p) => (
          <li key={p.name} className="flex items-center gap-2 text-[11px]">
            <span className="h-3 w-3 shrink-0 rounded-[2px] border border-foreground/35" style={{ background: fillFor(p.name) }} aria-hidden />
            <span className="flex-1 truncate">{p.name}</span>
            <span className="w-10 text-right font-medium tabular-nums">{p.seats}</span>
            {p.low !== undefined && p.high !== undefined && (
              <span className="w-20 text-right text-[10px] tabular-nums text-muted-foreground">
                {p.low}–{p.high}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        {majority} seats for a majority of {totalSeats} ·{" "}
        {alone
          ? `${largest.name} governs alone with ${largest.seats - majority} to spare`
          : `${largest?.name} is ${majority - (largest?.seats ?? 0)} short, so no party can govern alone`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * TurnoutByAge — turnout per cohort against the overall rate, with the
 * share of the electorate weighting each bar so a high-turnout cohort
 * that is small does not read as decisive.
 * ------------------------------------------------------------------ */
export function TurnoutByAge({
  cohorts,
  height = 200,
  className = "",
}: {
  cohorts: { band: string; eligible: number; voted: number }[]
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!cohorts.length) return null

  const totalEligible = cohorts.reduce((a, c) => a + c.eligible, 0)
  const totalVoted = cohorts.reduce((a, c) => a + c.voted, 0)
  const overall = totalVoted / Math.max(1, totalEligible)
  const rows = cohorts.map((c) => ({
    ...c,
    turnout: c.voted / Math.max(1, c.eligible),
    shareOfElectorate: c.eligible / Math.max(1, totalEligible),
    shareOfVoters: c.voted / Math.max(1, totalVoted),
  }))
  const skew = rows.reduce((a, r) => (Math.abs(r.shareOfVoters - r.shareOfElectorate) > Math.abs(a.shareOfVoters - a.shareOfElectorate) ? r : a), rows[0])

  return (
    <div className={className}>
      <div className="relative flex items-end gap-1" style={{ height }}>
        {rows.map((r) => (
          <div key={r.band} className="flex h-full flex-col justify-end" style={{ flex: `${r.shareOfElectorate} 0 0` }}>
            <span className="mb-0.5 text-center text-[9px] tabular-nums text-muted-foreground">{(r.turnout * 100).toFixed(0)}%</span>
            <div
              className="w-full rounded-t-[2px] bg-foreground"
              style={{ height: `${r.turnout * 100}%` }}
              title={`${r.band}: ${r.voted.toLocaleString()} of ${r.eligible.toLocaleString()}`}
            />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground" style={{ bottom: `${overall * 100}%` }} />
      </div>
      <div className="flex gap-1">
        {rows.map((r) => (
          <span key={r.band} className="truncate text-center text-[9px] text-muted-foreground" style={{ flex: `${r.shareOfElectorate} 0 0` }}>
            {r.band}
          </span>
        ))}
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {rows.map((r) => (
          <li key={r.band} className="flex items-center gap-2">
            <span className="w-14 shrink-0">{r.band}</span>
            <span className="text-muted-foreground">
              {(r.shareOfElectorate * 100).toFixed(0)}% of the electorate → {(r.shareOfVoters * 100).toFixed(0)}% of
              those who voted
            </span>
            <span aria-hidden>{r.shareOfVoters > r.shareOfElectorate ? "↑" : "↓"}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Bar WIDTH is each cohort's share of the electorate, height is its turnout — an 80% turnout in a small cohort is
        a small number of votes · overall {(overall * 100).toFixed(1)}% (dashed) · {skew.band} is
        {skew.shareOfVoters > skew.shareOfElectorate ? " over" : " under"}-represented among actual voters by{" "}
        {Math.abs((skew.shareOfVoters - skew.shareOfElectorate) * 100).toFixed(1)} points
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CoalitionSpace — every combination that reaches a majority, ranked by
 * how few partners it needs. The enumeration is the point.
 * ------------------------------------------------------------------ */
export function CoalitionSpace({
  parties,
  totalSeats,
  excluded = [],
  className = "",
}: {
  parties: { name: string; seats: number }[]
  totalSeats: number
  /** pairs that have ruled each other out */
  excluded?: [string, string][]
  className?: string
}) {
  const majority = Math.floor(totalSeats / 2) + 1
  const blocked = new Set(excluded.map(([a, b]) => [a, b].sort().join("|")))
  const viable: { members: string[]; seats: number; surplus: number }[] = []

  const n = parties.length
  for (let mask = 1; mask < 1 << n; mask++) {
    const members = parties.filter((_, i) => mask & (1 << i))
    const seats = members.reduce((a, p) => a + p.seats, 0)
    if (seats < majority) continue
    // minimal winning only: dropping any member must lose the majority
    if (members.some((m) => seats - m.seats >= majority)) continue
    const conflicted = members.some((a, i) => members.slice(i + 1).some((b) => blocked.has([a.name, b.name].sort().join("|"))))
    if (conflicted) continue
    viable.push({ members: members.map((m) => m.name), seats, surplus: seats - majority })
  }
  viable.sort((a, b) => a.members.length - b.members.length || b.surplus - a.surplus)
  const maxSeats = Math.max(majority, ...viable.map((v) => v.seats), ...parties.map((p) => p.seats))

  return (
    <div className={className}>
      {viable.length === 0 ? (
        <p className="text-[11px]">No combination of these parties reaches {majority} seats without a ruled-out pairing.</p>
      ) : (
        <ul className="space-y-1.5">
          {viable.slice(0, 8).map((v) => (
            <li key={v.members.join("+")}>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="truncate">{v.members.join(" + ")}</span>
                <span className="tabular-nums text-muted-foreground">
                  {v.seats} · {v.surplus} over
                </span>
              </div>
              <div className="relative mt-0.5 h-3 rounded-[2px] bg-muted">
                <div className="absolute inset-y-0 rounded-[2px] bg-foreground" style={{ width: `${(v.seats / maxSeats) * 100}%` }} />
                <span className="absolute inset-y-0 w-px bg-foreground/70" style={{ left: `${(majority / maxSeats) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        {viable.length} minimal winning coalition{viable.length === 1 ? "" : "s"} — every member is necessary, so none
        includes a party it could drop and still govern
        {excluded.length ? ` · ${excluded.length} pairing${excluded.length === 1 ? "" : "s"} ruled out and excluded` : ""}
        {viable.length > 8 ? " · showing the eight smallest" : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * VoteTransfer — where an eliminated candidate's preferences went, with
 * the exhaustion rate derived because that is what decides the result.
 * ------------------------------------------------------------------ */
export function VoteTransfer({
  from,
  fromVotes,
  destinations,
  className = "",
}: {
  from: string
  fromVotes: number
  /** votes reaching each continuing candidate; the remainder exhausts */
  destinations: { to: string; votes: number }[]
  className?: string
}) {
  const transferred = destinations.reduce((a, d) => a + d.votes, 0)
  const exhausted = Math.max(0, fromVotes - transferred)
  const rows = [...destinations]
    .sort((a, b) => b.votes - a.votes)
    .map((d) => ({ ...d, share: d.votes / Math.max(1, fromVotes) }))
  const max = Math.max(1, ...rows.map((r) => r.votes), exhausted)

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between text-[11px]">
        <span className="font-medium">{from} eliminated</span>
        <span className="tabular-nums text-muted-foreground">{fromVotes.toLocaleString()} votes to redistribute</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.to} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-[11px]">{r.to}</span>
            <div className="h-4 flex-1 rounded-[2px] bg-muted">
              <div className="h-full rounded-[2px] bg-foreground" style={{ width: `${(r.votes / max) * 100}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {r.votes.toLocaleString()} · {(r.share * 100).toFixed(1)}%
            </span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="w-24 shrink-0 truncate text-[11px]">Exhausted</span>
          <div className="h-4 flex-1 rounded-[2px] bg-muted">
            <div
              className="h-full rounded-[2px] border border-foreground/50"
              style={{ width: `${(exhausted / max) * 100}%`, background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
            {exhausted.toLocaleString()} · {((exhausted / Math.max(1, fromVotes)) * 100).toFixed(1)}%
          </span>
        </li>
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        {((transferred / Math.max(1, fromVotes)) * 100).toFixed(1)}% found a continuing candidate ·{" "}
        {exhausted > 0
          ? `${exhausted.toLocaleString()} ballots exhausted, which lowers the quota everyone else has to beat — an exhausted ballot is not a vote for nobody, it is a vote that stops counting`
          : "every ballot carried a further preference"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Malapportionment — voters per seat across districts, with the Gini
 * coefficient and the worst pair computed.
 * ------------------------------------------------------------------ */
export function Malapportionment({
  districts,
  height = 190,
  className = "",
}: {
  districts: { name: string; electors: number; seats: number }[]
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!districts.length) return null

  const rows = districts
    .map((d) => ({ ...d, perSeat: d.electors / Math.max(1, d.seats) }))
    .sort((a, b) => a.perSeat - b.perSeat)
  const totalElectors = rows.reduce((a, d) => a + d.electors, 0)
  const totalSeats = rows.reduce((a, d) => a + d.seats, 0)
  const quota = totalElectors / Math.max(1, totalSeats)

  // Gini over voters-per-seat, weighted by seats
  const sorted = rows.map((r) => r.perSeat)
  const nD = sorted.length
  const mean = sorted.reduce((a, v) => a + v, 0) / Math.max(1, nD)
  const gini =
    nD < 2
      ? 0
      : sorted.reduce((a, v, i) => a + (2 * (i + 1) - nD - 1) * v, 0) / (nD * nD * mean)

  const smallest = rows[0]
  const largest = rows[rows.length - 1]
  const ratio = largest.perSeat / Math.max(1, smallest.perSeat)
  const max = Math.max(...rows.map((r) => r.perSeat)) * 1.05

  return (
    <div className={className}>
      <div className="relative flex items-end gap-1" style={{ height }}>
        {rows.map((r) => (
          <div key={r.name} className="flex h-full flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t-[2px]"
              style={{
                height: `${(r.perSeat / max) * 100}%`,
                background: Math.abs(r.perSeat - quota) / quota > 0.1 ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 45%, transparent)",
                outline: Math.abs(r.perSeat - quota) / quota > 0.1 ? "1px solid currentColor" : undefined,
                outlineOffset: -1,
              }}
              title={`${r.name}: ${Math.round(r.perSeat).toLocaleString()} electors per seat`}
            />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground" style={{ bottom: `${(quota / max) * 100}%` }} />
      </div>
      <div className="flex gap-1">
        {rows.map((r) => (
          <span key={r.name} className="flex-1 truncate text-center text-[9px] text-muted-foreground">
            {r.name}
          </span>
        ))}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">National quota</dt>
          <dd className="font-medium tabular-nums">{Math.round(quota).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Worst ratio</dt>
          <dd className="font-medium tabular-nums">{ratio.toFixed(2)}:1</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Gini</dt>
          <dd className="font-medium tabular-nums">{gini.toFixed(3)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Hatched districts are more than 10% off the quota · a vote in {smallest.name} is worth{" "}
        {ratio.toFixed(2)} votes in {largest.name}, which is the same statement as the ratio and the one people
        recognise
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DHondtAllocation — seats allocated by highest averages. Every round
 * is COMPUTED and the quotient that won each seat is shown, because
 * "why did they get the last seat" is the only question anybody asks of
 * a proportional system.
 * ------------------------------------------------------------------ */
export function DHondtAllocation({
  parties,
  seats,
  threshold = 0,
  className = "",
}: {
  parties: { name: string; votes: number }[]
  seats: number
  /** votes share below which a party is excluded, as a percentage */
  threshold?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!parties.length) return null

  const totalVotes = parties.reduce((a, p) => a + p.votes, 0)
  const eligible = parties.filter((p) => (p.votes / Math.max(1, totalVotes)) * 100 >= threshold)
  const excluded = parties.filter((p) => !eligible.includes(p))

  const won = new Map(eligible.map((p) => [p.name, 0]))
  const rounds: { seat: number; winner: string; quotient: number }[] = []
  for (let s = 1; s <= seats; s++) {
    let best = eligible[0]
    let bestQ = -Infinity
    eligible.forEach((p) => {
      const q = p.votes / ((won.get(p.name) as number) + 1)
      if (q > bestQ) {
        bestQ = q
        best = p
      }
    })
    if (!best) break
    won.set(best.name, (won.get(best.name) as number) + 1)
    rounds.push({ seat: s, winner: best.name, quotient: bestQ })
  }

  const rows = eligible
    .map((p) => {
      const got = (won.get(p.name) as number) ?? 0
      const voteShare = (p.votes / Math.max(1, totalVotes)) * 100
      const seatShare = (got / Math.max(1, seats)) * 100
      return { ...p, got, voteShare, seatShare, bonus: seatShare - voteShare }
    })
    .sort((a, b) => b.got - a.got || b.votes - a.votes)
  const maxShare = Math.max(...rows.map((r) => Math.max(r.voteShare, r.seatShare)))
  const lastSeat = rounds[rounds.length - 1]
  const biggestBonus = rows.reduce((a, r) => (r.bonus > a.bonus ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.votes.toLocaleString()} votes → {r.got} seat{r.got === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-0.5 space-y-px">
              <div className="h-3 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground/35" style={{ width: `${(r.voteShare / maxShare) * 100}%` }} />
              </div>
              <div className="h-3 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground" style={{ width: `${(r.seatShare / maxShare) * 100}%` }} />
              </div>
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {r.voteShare.toFixed(1)}% of votes, {r.seatShare.toFixed(1)}% of seats ·{" "}
              <span aria-hidden>{r.bonus >= 0 ? "↑" : "↓"}</span> {Math.abs(r.bonus).toFixed(1)} points
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale bar is vote share, solid is seat share · seat {lastSeat?.seat} went to {lastSeat?.winner} on a quotient of{" "}
        {Math.round(lastSeat?.quotient ?? 0).toLocaleString()} · {biggestBonus.name} gains the most from the method, at{" "}
        {biggestBonus.bonus.toFixed(1)} points over its vote share — highest averages always favours the large
        {excluded.length ? ` · ${excluded.map((e) => e.name).join(", ")} excluded below the ${threshold}% threshold` : ""}
      </p>
    </div>
  )
}
