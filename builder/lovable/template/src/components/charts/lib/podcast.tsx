/**
 * Podcast primitives — listen-through, ad inventory, download windows,
 * chart position, subscriber funnel and ad-break placement.
 *
 * The completion rate and where listeners actually leave, the inventory a
 * back catalogue really has, the share of a download window already spent,
 * the rank a chart position is worth, the conversion at each step and the
 * audience an ad slot delivers are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) =>
  "£" + (Math.abs(v) < 10 ? Math.abs(v).toFixed(2) : Math.round(Math.abs(v)).toLocaleString("en-GB"))

/* ------------------------------------------------------------------ *
 * EpisodeRetention — the listen-through curve, with the DROP RATE
 * derived. A completion percentage is one number at the end; where
 * people leave is the whole editorial signal.
 * ------------------------------------------------------------------ */
export function EpisodeRetention({
  episodes,
  markers,
  height = 200,
  className = "",
}: {
  /** the share still listening at each decile of the episode */
  episodes: { name: string; retained: number[]; minutes: number }[]
  /** anything worth naming on the timeline, as a fraction of the episode */
  markers?: { at: number; label: string }[]
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!episodes.length) return null

  const rows = episodes.map((e) => {
    const drops = e.retained.map((v, i) => (i === 0 ? 0 : e.retained[i - 1] - v))
    const worst = drops.indexOf(Math.max(...drops))
    return {
      ...e,
      drops,
      completion: e.retained[e.retained.length - 1],
      worstAt: worst / Math.max(e.retained.length - 1, 1),
      worstDrop: Math.max(...drops),
      // minutes actually listened, which is what an advertiser buys
      listenedMinutes: (e.retained.reduce((a, v) => a + v, 0) / Math.max(e.retained.length, 1)) * e.minutes,
    }
  })
  const steps = Math.max(...rows.map((r) => r.retained.length))
  const px = (i: number) => (i / Math.max(steps - 1, 1)) * 100
  const py = (v: number) => 100 - v * 94 - 3
  const dashes = ["none", "5 2", "2 2", "6 2 2 2"]
  const best = rows.reduce((a, r) => (r.completion > a.completion ? r : a), rows[0])
  const cliff = rows.reduce((a, r) => (r.worstDrop > a.worstDrop ? r : a), rows[0])

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {markers?.map((m) => (
            <line key={m.label} x1={m.at * 100} y1={0} x2={m.at * 100} y2={100} stroke="currentColor" strokeWidth={0.6} opacity={0.35} />
          ))}
          {rows.map((r, i) => (
            <polyline
              key={r.name}
              points={r.retained.map((v, j) => `${px(j)},${py(v)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray={dashes[i % dashes.length]}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>start</span>
        {markers?.map((m) => <span key={m.label}>{m.label}</span>)}
        <span>end</span>
      </div>
      <ul className="mt-2 space-y-1 text-[10px] tabular-nums">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-2">
            <svg width="22" height="6" className="shrink-0" aria-hidden>
              <line x1={0} y1={3} x2={22} y2={3} stroke="currentColor" strokeWidth={1.5} strokeDasharray={dashes[i % dashes.length]} />
            </svg>
            <span className="w-32 shrink-0 truncate">{r.name}</span>
            <span className="text-muted-foreground">
              {(r.completion * 100).toFixed(0)}% finish · biggest drop at {(r.worstAt * 100).toFixed(0)}% (
              {(r.worstDrop * 100).toFixed(0)} points) · {r.listenedMinutes.toFixed(0)} of {r.minutes} minutes heard
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The curve is where listeners LEAVE, which is editorial information a completion percentage does not carry ·{" "}
        {best.name} finishes best at {(best.completion * 100).toFixed(0)}%, and {cliff.name} loses{" "}
        {(cliff.worstDrop * 100).toFixed(0)} points in one decile at {(cliff.worstAt * 100).toFixed(0)}% — that is a
        segment, not an audience · minutes HEARD is the number an advertiser is buying, and it is the average of this
        curve rather than the episode's length
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AdInventory — impressions available against impressions sold, by
 * slot. A back catalogue keeps producing inventory forever, which is
 * the half nobody counts.
 * ------------------------------------------------------------------ */
export function AdInventory({
  slots,
  cpm,
  className = "",
}: {
  /** each slot's monthly impressions from new episodes and from the back catalogue */
  slots: { name: string; newEpisodes: number; backCatalogue: number; sold: number }[]
  cpm: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!slots.length) return null

  const rows = slots.map((s) => {
    const available = s.newEpisodes + s.backCatalogue
    return {
      ...s,
      available,
      fill: s.sold / Math.max(available, 1),
      unsold: Math.max(0, available - s.sold),
      revenue: (s.sold / 1000) * cpm,
      forgone: (Math.max(0, available - s.sold) / 1000) * cpm,
      backShare: s.backCatalogue / Math.max(available, 1),
    }
  })
  const available = rows.reduce((a, r) => a + r.available, 0)
  const sold = rows.reduce((a, r) => a + r.sold, 0)
  const forgone = rows.reduce((a, r) => a + r.forgone, 0)
  const backShare = rows.reduce((a, r) => a + r.backCatalogue, 0) / Math.max(available, 1)
  const max = Math.max(...rows.map((r) => r.available))
  const emptiest = rows.reduce((a, r) => (r.fill < a.fill ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {(r.available / 1000).toFixed(0)}k available · {(r.fill * 100).toFixed(0)}% sold
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted" style={{ width: `${(r.available / max) * 100}%` }}>
              <div
                className="absolute inset-y-0 left-0 rounded-l-[2px]"
                style={{
                  width: `${(r.newEpisodes / Math.max(r.available, 1)) * 100}%`,
                  background: "color-mix(in oklch, currentColor 20%, transparent)",
                }}
                title={`new episodes: ${(r.newEpisodes / 1000).toFixed(0)}k`}
              />
              <div
                className="absolute inset-y-0 rounded-r-[2px]"
                style={{
                  left: `${(r.newEpisodes / Math.max(r.available, 1)) * 100}%`,
                  right: 0,
                  background: "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)",
                }}
                title={`back catalogue: ${(r.backCatalogue / 1000).toFixed(0)}k`}
              />
              <div className="absolute inset-y-0 left-0 rounded-[2px] bg-foreground" style={{ width: `${clamp(r.fill * 100, 0, 100)}%` }} title={`sold: ${(r.sold / 1000).toFixed(0)}k`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.revenue)} earned · {money(r.forgone)} unsold · {(r.backShare * 100).toFixed(0)}% of the
              inventory is back catalogue
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Solid is SOLD, over a track split into new episodes (pale) and back catalogue (hatched) · the back catalogue is{" "}
        {(backShare * 100).toFixed(0)}% of everything available and keeps producing forever, which is the half a
        rate card built on "downloads in the first week" does not price ·{" "}
        {((sold / Math.max(available, 1)) * 100).toFixed(0)}% fill overall, leaving {money(forgone)} a month on the
        table · {emptiest.name.toLowerCase()} is the emptiest at {(emptiest.fill * 100).toFixed(0)}%
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DownloadWindow — how an episode's downloads accumulate. The
 * industry counts a 30-day window; the derived question is what share
 * of a long tail that window is actually capturing.
 * ------------------------------------------------------------------ */
export function DownloadWindow({
  days,
  windowDays = 30,
  height = 190,
  className = "",
}: {
  /** cumulative downloads at each day after release */
  days: { day: number; cumulative: number }[]
  windowDays?: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!days.length) return null

  const pts = [...days].sort((a, b) => a.day - b.day)
  const total = pts[pts.length - 1].cumulative
  const at = (d: number) => {
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].day >= d) {
        const a = pts[i - 1]
        const b = pts[i]
        return a.cumulative + ((d - a.day) * (b.cumulative - a.cumulative)) / Math.max(b.day - a.day, 1e-9)
      }
    }
    return total
  }
  const inWindow = at(windowDays)
  const dayOne = at(1)
  const daySeven = at(7)
  // the day by which half the eventual downloads have arrived
  let half = pts[pts.length - 1].day
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].cumulative >= total / 2) {
      const a = pts[i - 1]
      const b = pts[i]
      half = a.day + ((total / 2 - a.cumulative) * (b.day - a.day)) / Math.max(b.cumulative - a.cumulative, 1e-9)
      break
    }
  }
  const px = (d: number) => (d / Math.max(pts[pts.length - 1].day, 1e-9)) * 100
  const py = (v: number) => 100 - (v / Math.max(total, 1e-9)) * 94 - 3

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <rect x={0} y={0} width={clamp(px(windowDays), 0, 100)} height={100} fill="currentColor" opacity={0.11} />
          <polyline points={pts.map((p) => `${px(p.day)},${py(p.cumulative)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute inset-y-0 w-px bg-foreground/55" style={{ left: `${clamp(px(windowDays), 0, 100)}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>release</span>
        <span>{windowDays}-day window</span>
        <span>day {pts[pts.length - 1].day}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Day one</dt>
          <dd className="font-medium tabular-nums">{((dayOne / Math.max(total, 1)) * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Week one</dt>
          <dd className="font-medium tabular-nums">{((daySeven / Math.max(total, 1)) * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">In window</dt>
          <dd className="font-medium tabular-nums">{((inWindow / Math.max(total, 1)) * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Half by</dt>
          <dd className="font-medium tabular-nums">day {half.toFixed(0)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The shaded region is the {windowDays}-day counting window, and everything to the right of it is real audience
        that no rate card sells · it captures {((inWindow / Math.max(total, 1)) * 100).toFixed(0)}% of the eventual{" "}
        {total.toLocaleString()} downloads, so a show reporting window figures is understating itself by{" "}
        {(((total - inWindow) / Math.max(total, 1)) * 100).toFixed(0)}% · half arrive by day {half.toFixed(0)}, which
        is the honest answer to "how long before we know"
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ChartRank — position over time, drawn with rank INVERTED so that
 * up means better. A rank plotted on an ordinary axis reads exactly
 * backwards, which is the most common way this chart is wrong.
 * ------------------------------------------------------------------ */
export function ChartRank({
  shows,
  maxRank = 200,
  height = 200,
  className = "",
}: {
  shows: { name: string; ranks: (number | null)[] }[]
  /** the bottom of the chart; a show outside it has no rank at all */
  maxRank?: number
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!shows.length) return null

  const len = Math.max(...shows.map((s) => s.ranks.length))
  const rows = shows.map((s) => {
    const seen = s.ranks.filter((r): r is number => r !== null)
    const best = seen.length ? Math.min(...seen) : null
    return { ...s, best, days: seen.length, off: s.ranks.length - seen.length }
  })
  const px = (i: number) => (i / Math.max(len - 1, 1)) * 100
  // log scale: the difference between 2 and 5 is enormous and between 150
  // and 153 is nothing, which a linear rank axis draws identically
  const py = (r: number) => (Math.log(clamp(r, 1, maxRank)) / Math.log(maxRank)) * 94 + 3
  const dashes = ["none", "5 2", "2 2", "6 2 2 2"]
  const bestShow = rows.reduce((a, r) => (r.best !== null && (a.best === null || r.best < a.best) ? r : a), rows[0])

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {[1, 10, 50, maxRank].map((r) => (
            <line key={r} x1={0} y1={py(r)} x2={100} y2={py(r)} stroke="currentColor" strokeWidth={0.4} opacity={0.25} />
          ))}
          {rows.map((s, i) => {
            // a run of nulls is a gap in the line, not a jump through it
            const segs: string[] = []
            let cur: string[] = []
            s.ranks.forEach((r, j) => {
              if (r === null) {
                if (cur.length > 1) segs.push(cur.join(" "))
                cur = []
              } else cur.push(`${px(j)},${py(r)}`)
            })
            if (cur.length > 1) segs.push(cur.join(" "))
            return segs.map((pts, k) => (
              <polyline
                key={`${s.name}-${k}`}
                points={pts}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeDasharray={dashes[i % dashes.length]}
                vectorEffect="non-scaling-stroke"
              />
            ))
          })}
        </svg>
        {[1, 10, 50].map((r) => (
          <span key={r} className="absolute left-1 -translate-y-1/2 bg-background px-0.5 text-[9px] tabular-nums text-muted-foreground" style={{ top: `${py(r)}%` }}>
            #{r}
          </span>
        ))}
      </div>
      <ul className="mt-2 space-y-1 text-[10px] tabular-nums">
        {rows.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2">
            <svg width="22" height="6" className="shrink-0" aria-hidden>
              <line x1={0} y1={3} x2={22} y2={3} stroke="currentColor" strokeWidth={1.5} strokeDasharray={dashes[i % dashes.length]} />
            </svg>
            <span className="w-32 shrink-0 truncate">{s.name}</span>
            <span className="text-muted-foreground">
              best #{s.best ?? "—"} · charted {s.days} of {s.ranks.length} days
              {s.off > 0 ? ` · off the chart for ${s.off}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Rank is drawn INVERTED so up is better, and on a log scale because the distance from #2 to #5 is enormous and
        from #150 to #153 is nothing — a linear rank axis draws those two the same and points the wrong way · a break
        in a line is a day off the chart entirely, not a jump through it · {bestShow.name} peaked at #{bestShow.best}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SubscriberFunnel — from a click to a regular listener, with the
 * STEP conversion derived. An overall conversion rate cannot say
 * which step is the leak.
 * ------------------------------------------------------------------ */
export function SubscriberFunnel({
  steps,
  costPerClick,
  className = "",
}: {
  steps: { name: string; people: number }[]
  costPerClick?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!steps.length) return null

  const rows = steps.map((s, i) => ({
    ...s,
    step: i === 0 ? 1 : s.people / Math.max(steps[i - 1].people, 1),
    overall: s.people / Math.max(steps[0].people, 1),
    lost: i === 0 ? 0 : steps[i - 1].people - s.people,
  }))
  const worst = rows.slice(1).reduce((a, r) => (r.step < a.step ? r : a), rows[1] ?? rows[0])
  const biggestLoss = rows.slice(1).reduce((a, r) => (r.lost > a.lost ? r : a), rows[1] ?? rows[0])
  const cac = costPerClick === undefined ? null : (steps[0].people * costPerClick) / Math.max(rows[rows.length - 1].people, 1)

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.people.toLocaleString()}
                {i > 0 ? ` · ${(r.step * 100).toFixed(0)}% of the step before` : ""}
              </span>
            </div>
            <div className="mt-0.5 flex h-5 rounded-[2px] bg-muted">
              <div className="rounded-[2px] bg-foreground/70" style={{ width: `${r.overall * 100}%` }} title={`${(r.overall * 100).toFixed(1)}% of the top`} />
              {i > 0 && r.lost > 0 && (
                <div
                  className="rounded-r-[2px]"
                  style={{
                    width: `${(r.lost / Math.max(steps[0].people, 1)) * 100}%`,
                    background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  }}
                  title={`lost here: ${r.lost.toLocaleString()}`}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched is what was lost AT THIS STEP, which is the only view that names a leak — an overall conversion rate of{" "}
        {(rows[rows.length - 1].overall * 100).toFixed(1)}% says a funnel is bad and never says where ·{" "}
        {worst.name === biggestLoss.name
          ? `${worst.name.toLowerCase()} is both the worst conversion at ${(worst.step * 100).toFixed(0)}% and the biggest absolute loss at ${biggestLoss.lost.toLocaleString()} people, which is the unambiguous case and the rare one`
          : `the worst conversion is ${worst.name.toLowerCase()} at ${(worst.step * 100).toFixed(0)}% and the biggest ABSOLUTE loss is ${biggestLoss.name.toLowerCase()} at ${biggestLoss.lost.toLocaleString()} people — different steps, and only one of them is worth a week`}
        {cac !== null ? ` · ${money(cac)} to acquire one regular listener` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AdBreakPlacement — where the breaks sit against the retention
 * curve, with the AUDIENCE each break actually reaches derived. A
 * mid-roll sold at a flat rate is priced on the pre-roll's audience.
 * ------------------------------------------------------------------ */
export function AdBreakPlacement({
  retention,
  breaks,
  episodeMinutes,
  cpm,
  listeners,
  className = "",
}: {
  /** the share still listening at each decile */
  retention: number[]
  /** each break's position as a fraction of the episode */
  breaks: { at: number; label: string; ratePerThousand?: number }[]
  episodeMinutes: number
  cpm: number
  listeners: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!retention.length || !breaks.length) return null

  const at = (f: number) => {
    const x = clamp(f, 0, 1) * (retention.length - 1)
    const i = Math.floor(x)
    const j = Math.min(i + 1, retention.length - 1)
    return retention[i] + (retention[j] - retention[i]) * (x - i)
  }
  const rows = [...breaks]
    .sort((a, b) => a.at - b.at)
    .map((b) => {
      const share = at(b.at)
      const heard = listeners * share
      const rate = b.ratePerThousand ?? cpm
      return {
        ...b,
        share,
        heard,
        revenue: (heard / 1000) * rate,
        // what the slot earns per thousand people who ACTUALLY hear it
        effectiveCpm: rate,
        paidCpm: ((listeners / 1000) * rate) / Math.max(heard / 1000, 1e-9),
      }
    })
  const total = rows.reduce((a, r) => a + r.revenue, 0)
  const flat = rows.reduce((a, r) => a + (listeners / 1000) * (r.ratePerThousand ?? cpm), 0)
  const last = rows[rows.length - 1]
  const maxRev = Math.max(...rows.map((r) => r.revenue))

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height: 150 }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon
            points={`0,100 ${retention.map((v, i) => `${(i / Math.max(retention.length - 1, 1)) * 100},${100 - v * 94 - 3}`).join(" ")} 100,100`}
            fill="currentColor"
            opacity={0.16}
          />
          <polyline
            points={retention.map((v, i) => `${(i / Math.max(retention.length - 1, 1)) * 100},${100 - v * 94 - 3}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {rows.map((r) => (
          <span key={r.label} className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${clamp(r.at * 100, 0, 99.6)}%` }} title={`${r.label}: ${(r.share * 100).toFixed(0)}% still listening`} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 min</span>
        <span>{episodeMinutes} min</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span className="w-24 shrink-0 truncate">{r.label}</span>
            <span className="w-16 shrink-0 text-right text-muted-foreground">{(r.at * episodeMinutes).toFixed(0)} min</span>
            <div className="h-2.5 flex-1 rounded-[1px] bg-muted">
              <div className="h-full rounded-[1px] bg-foreground/65" style={{ width: `${(r.revenue / Math.max(maxRev, 1e-9)) * 100}%` }} />
            </div>
            <span className="w-40 shrink-0 text-right text-muted-foreground">
              {Math.round(r.heard).toLocaleString()} hear it · {money(r.revenue)} · effective{" "}
              {r.paidCpm.toFixed(2)} CPM
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A break's audience is READ OFF the retention curve, not off the download count — {last.label.toLowerCase()} at{" "}
        {(last.at * episodeMinutes).toFixed(0)} minutes reaches {(last.share * 100).toFixed(0)}% of the people the
        pre-roll does · the breaks earn {money(total)} against {money(flat)} if every slot were priced on the full{" "}
        {listeners.toLocaleString()} downloads, so a flat rate card overcharges by{" "}
        {(((flat - total) / Math.max(total, 1e-9)) * 100).toFixed(0)}% on the late slots — which is the complaint an
        advertiser makes once and then stops buying
      </p>
    </div>
  )
}
