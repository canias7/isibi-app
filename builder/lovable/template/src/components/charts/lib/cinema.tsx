/**
 * Cinema exhibition primitives — showtime grids, admissions decay, screen
 * mix, concessions, film hire and seat heat.
 *
 * The share of a screen's day that is actually selling, how fast a title
 * falls away, what a screen earns per seat-hour, the spend a admission
 * really brings, the distributor's take on a sliding scale and where an
 * auditorium fills are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) => {
  const a = Math.abs(v)
  const s = a >= 1e4 ? `£${(a / 1e3).toFixed(0)}k` : a < 10 ? `£${a.toFixed(2)}` : `£${Math.round(a).toLocaleString("en-GB")}`
  return v < 0 ? `−${s}` : s
}
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/* ------------------------------------------------------------------ *
 * ShowtimeGrid — the day's programme by screen, with the SEAT-HOURS
 * sold derived. A grid of showtimes says a screen is busy; only the
 * occupancy says whether it is earning.
 * ------------------------------------------------------------------ */
export function ShowtimeGrid({
  screens,
  openMinute,
  closeMinute,
  turnaroundMin = 20,
  className = "",
}: {
  screens: {
    name: string
    seats: number
    shows: { title: string; startMinute: number; runtimeMin: number; admissions: number }[]
  }[]
  openMinute: number
  closeMinute: number
  turnaroundMin?: number
  className?: string
}) {
  const span = Math.max(closeMinute - openMinute, 1)
  const px = (m: number) => ((m - openMinute) / span) * 100
  const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`
  const rows = screens.map((s) => {
    const running = s.shows.reduce((a, x) => a + x.runtimeMin, 0)
    const admissions = s.shows.reduce((a, x) => a + x.admissions, 0)
    const capacitySeatHours = (s.seats * span) / 60
    const soldSeatHours = s.shows.reduce((a, x) => a + (x.admissions * x.runtimeMin) / 60, 0)
    // the last show has no turnaround after it inside the day
    const dark = span - running - Math.max(0, s.shows.length - 1) * turnaroundMin
    return {
      ...s,
      running,
      admissions,
      occupancy: admissions / Math.max(s.seats * s.shows.length, 1),
      yieldShare: soldSeatHours / Math.max(capacitySeatHours, 1e-9),
      dark,
    }
  })
  const totalAdmissions = rows.reduce((a, r) => a + r.admissions, 0)
  const best = rows.reduce((a, r) => (r.yieldShare > a.yieldShare ? r : a), rows[0])
  const busiestByShows = rows.reduce((a, r) => (r.shows.length > a.shows.length ? r : a), rows[0])
  const emptiest = rows.reduce((a, r) => (r.yieldShare < a.yieldShare ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">
                {r.name} <span className="text-muted-foreground">· {r.seats} seats</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {r.shows.length} {plural(r.shows.length, "show", "shows")} · {r.admissions} in ·{" "}
                {(r.occupancy * 100).toFixed(0)}% full
              </span>
            </div>
            <div className="relative mt-0.5 h-6 rounded-[2px] bg-muted">
              {r.shows.map((x) => (
                <div
                  key={x.startMinute}
                  className="absolute inset-y-0 overflow-hidden rounded-[2px] border-r border-background"
                  style={{ left: `${clamp(px(x.startMinute), 0, 100)}%`, width: `${clamp(px(x.startMinute + x.runtimeMin) - px(x.startMinute), 0.5, 100)}%` }}
                  title={`${x.title} · ${clock(x.startMinute)} · ${x.admissions} of ${r.seats}`}
                >
                  {/* the FILL of each block is how full that show was, so a
                      packed late show and an empty matinee are not the same bar */}
                  <div
                    className="absolute inset-x-0 bottom-0"
                    style={{ height: `${clamp((x.admissions / Math.max(r.seats, 1)) * 100, 3, 100)}%`, background: "currentColor" }}
                  />
                  <div className="absolute inset-0 border border-foreground/30" />
                </div>
              ))}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {(r.yieldShare * 100).toFixed(0)}% of the screen's seat-hours sold · {Math.round(r.dark)} minutes dark
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{clock(openMinute)}</span>
        <span>block height is how full that show was</span>
        <span>{clock(closeMinute)}</span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Seat-hours SOLD against seat-hours available is the measure a grid of showtimes cannot give — a screen with
        six shows at a fifth full earns less than one with three that are packed ·{" "}
        {busiestByShows.name} runs the most shows and {best.name} sells the most seat-hours,{" "}
        {busiestByShows.name === best.name ? "which is the same screen" : "which are different screens"} ·{" "}
        {totalAdmissions.toLocaleString()} admissions across the day, and {emptiest.name} at{" "}
        {(emptiest.yieldShare * 100).toFixed(0)}% is the one to reprogramme
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AdmissionsDecay — a title's weekly drop, with the DECAY RATE and
 * the remaining run derived. Every film falls; the rate is what
 * decides how many screens it keeps next Friday.
 * ------------------------------------------------------------------ */
export function AdmissionsDecay({
  titles,
  minimumWeekly,
  height = 200,
  className = "",
}: {
  titles: { name: string; weekly: number[] }[]
  /** the weekly admissions below which a title comes off */
  minimumWeekly: number
  height?: number
  className?: string
}) {
  const rows = titles.map((t) => {
    const drops = t.weekly.slice(1).map((v, i) => v / Math.max(t.weekly[i], 1))
    const mean = drops.length ? drops.reduce((a, v) => a + v, 0) / drops.length : 1
    const last = t.weekly[t.weekly.length - 1]
    // weeks left before the run falls under the hold-over line, at this rate
    const weeksLeft =
      mean >= 1 || last <= minimumWeekly ? null : Math.log(minimumWeekly / last) / Math.log(mean)
    return { ...t, drops, mean, last, weeksLeft, total: t.weekly.reduce((a, v) => a + v, 0) }
  })
  const maxWeeks = Math.max(...rows.map((r) => r.weekly.length))
  const maxAdm = Math.max(...rows.flatMap((r) => r.weekly))
  const px = (i: number) => (i / Math.max(maxWeeks - 1, 1)) * 100
  // a log scale, because a constant percentage drop is a straight line on it
  const lo = Math.log(Math.max(minimumWeekly * 0.6, 1))
  const hi = Math.log(maxAdm)
  const py = (v: number) => 100 - ((Math.log(Math.max(v, 1)) - lo) / Math.max(hi - lo, 1e-9)) * 94 - 3
  const dashes = ["none", "5 2", "2 2", "6 2 2 2"]
  const stickiest = rows.reduce((a, r) => (r.mean > a.mean ? r : a), rows[0])
  const steepest = rows.reduce((a, r) => (r.mean < a.mean ? r : a), rows[0])

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={py(minimumWeekly)} x2={100} y2={py(minimumWeekly)} stroke="currentColor" strokeWidth={1} strokeDasharray="4 2" />
          {rows.map((r, i) => (
            <polyline
              key={r.name}
              points={r.weekly.map((v, j) => `${px(j)},${py(v)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray={dashes[i % dashes.length]}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <span className="absolute right-1 -translate-y-1/2 bg-background px-0.5 text-[9px] tabular-nums text-muted-foreground" style={{ top: `${py(minimumWeekly)}%` }}>
          hold-over line
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>week 1</span>
        <span>log scale — a constant drop is a straight line</span>
        <span>week {maxWeeks}</span>
      </div>
      <ul className="mt-2 space-y-1 text-[10px] tabular-nums">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-2">
            <svg width="22" height="6" className="shrink-0" aria-hidden>
              <line x1={0} y1={3} x2={22} y2={3} stroke="currentColor" strokeWidth={1.5} strokeDasharray={dashes[i % dashes.length]} />
            </svg>
            <span className="w-32 shrink-0 truncate">{r.name}</span>
            <span className="text-muted-foreground">
              holds {(r.mean * 100).toFixed(0)}% week to week · {r.total.toLocaleString()} so far ·{" "}
              {r.weeksLeft === null
                ? r.last <= minimumWeekly
                  ? "already under the line"
                  : "not falling"
                : `${r.weeksLeft.toFixed(1)} weeks left at this rate`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The axis is LOGARITHMIC, so a title dropping a constant share each week draws a straight line and the shape
        of a curve is information rather than arithmetic · {stickiest.name} holds{" "}
        {(stickiest.mean * 100).toFixed(0)}% a week and {steepest.name} only{" "}
        {(steepest.mean * 100).toFixed(0)}%, which is the difference between a four-week run and a two-week one ·
        the weeks remaining are EXTRAPOLATED from each title's own decay, not from a rule of thumb
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ScreenMix — earnings per SEAT-HOUR by auditorium. A big screen
 * takes the most money and may be the least efficient use of the
 * building, which a box-office ranking cannot say.
 * ------------------------------------------------------------------ */
export function ScreenMix({
  screens,
  openHours,
  className = "",
}: {
  screens: { name: string; seats: number; admissions: number; boxOffice: number; premium?: boolean }[]
  openHours: number
  className?: string
}) {
  const rows = screens
    .map((s) => ({
      ...s,
      perSeatHour: s.boxOffice / Math.max(s.seats * openHours, 1e-9),
      perAdmission: s.boxOffice / Math.max(s.admissions, 1),
      utilisation: s.admissions / Math.max(s.seats, 1),
    }))
    .sort((a, b) => b.perSeatHour - a.perSeatHour)
  const byBoxOffice = [...rows].sort((a, b) => b.boxOffice - a.boxOffice)
  const total = rows.reduce((a, r) => a + r.boxOffice, 0)
  const seats = rows.reduce((a, r) => a + r.seats, 0)
  const blended = total / Math.max(seats * openHours, 1e-9)
  const max = Math.max(...rows.map((r) => r.perSeatHour))
  const flipped = byBoxOffice[0].name !== rows[0].name

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">
                {r.name}
                {r.premium ? <span className="text-muted-foreground"> · premium</span> : null}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {r.seats} seats · {r.admissions.toLocaleString()} in · {money(r.boxOffice)}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(r.perSeatHour / max) * 100}%`,
                  background: r.premium ? "currentColor" : "color-mix(in oklch, currentColor 50%, transparent)",
                }}
                title={`${money(r.perSeatHour)} a seat-hour`}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${clamp((blended / max) * 100, 0, 100)}%` }} title={`site average ${money(blended)}`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.perSeatHour)} a seat-hour · {money(r.perAdmission)} a ticket ·{" "}
              {r.utilisation.toFixed(1)} admissions a seat across the week
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The bar is box office per SEAT-HOUR, which normalises a 380-seat auditorium against a 62-seat one — that is
        the comparison a box-office ranking cannot make ·{" "}
        {flipped
          ? `${byBoxOffice[0].name} takes the most money and ${rows[0].name} earns the most per seat-hour, which is the argument for the smaller room`
          : `${rows[0].name} leads on both takings and efficiency, which is unusual and worth understanding`}{" "}
        · the site averages {money(blended)} a seat-hour over {openHours} open hours
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * ConcessionSpend — spend per head against the film and the time of
 * day, with the contribution derived. Concessions are the margin and
 * a family matinee behaves nothing like a late-night thriller.
 * ------------------------------------------------------------------ */
export function ConcessionSpend({
  showings,
  ticketMargin,
  concessionMargin,
  className = "",
}: {
  showings: { name: string; admissions: number; boxOffice: number; concessions: number; slot: string }[]
  /** the share of a ticket the cinema keeps after film hire */
  ticketMargin: number
  /** the gross margin on a pound of popcorn */
  concessionMargin: number
  className?: string
}) {
  const rows = showings
    .map((s) => {
      const spendPerHead = s.concessions / Math.max(s.admissions, 1)
      const ticketPerHead = s.boxOffice / Math.max(s.admissions, 1)
      const contribution = ticketPerHead * ticketMargin + spendPerHead * concessionMargin
      return {
        ...s,
        spendPerHead,
        ticketPerHead,
        contribution,
        concessionShare: (spendPerHead * concessionMargin) / Math.max(contribution, 1e-9),
      }
    })
    .sort((a, b) => b.contribution - a.contribution)
  const max = Math.max(...rows.map((r) => r.contribution))
  const byBoxOffice = [...rows].sort((a, b) => b.ticketPerHead - a.ticketPerHead)
  const admissions = rows.reduce((a, r) => a + r.admissions, 0)
  const totalContribution = rows.reduce((a, r) => a + r.contribution * r.admissions, 0)
  const meanShare = rows.reduce((a, r) => a + r.concessionShare * r.admissions, 0) / Math.max(admissions, 1)
  const bestKiosk = rows.reduce((a, r) => (r.spendPerHead > a.spendPerHead ? r : a), rows[0])

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">
                {r.name} <span className="text-muted-foreground">· {r.slot}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {r.admissions} in · {money(r.ticketPerHead)} ticket · {money(r.spendPerHead)} kiosk
              </span>
            </div>
            {/* the two halves of the contribution, stacked, so which one is
                carrying a showing is visible rather than computed */}
            <div className="mt-0.5 flex h-4 rounded-[2px] bg-muted" style={{ width: `${(r.contribution / max) * 100}%` }}>
              <div
                className="rounded-l-[2px] bg-foreground/40"
                style={{ width: `${(1 - r.concessionShare) * 100}%` }}
                title={`from the ticket: ${money(r.ticketPerHead * ticketMargin)}`}
              />
              <div
                className="rounded-r-[2px] bg-foreground"
                style={{ width: `${r.concessionShare * 100}%` }}
                title={`from the kiosk: ${money(r.spendPerHead * concessionMargin)}`}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.contribution)} a head, {(r.concessionShare * 100).toFixed(0)}% of it from the kiosk
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is what a ticket contributes after film hire and solid is the kiosk — {(meanShare * 100).toFixed(0)}% of
        the {money(totalContribution)} contribution across {admissions.toLocaleString()} admissions comes from the
        second bar, which is why the queue matters as much as the screen ·{" "}
        {byBoxOffice[0].name} has the highest ticket price and {bestKiosk.name} the highest spend per head,{" "}
        {byBoxOffice[0].name === bestKiosk.name ? "which is the same showing" : "which are different showings"} ·{" "}
        {rows[0].name} contributes most overall at {money(rows[0].contribution)} a head
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * FilmHire — the distributor's sliding scale. The rate falls with the
 * week, so the cinema's share of a run is a WEIGHTED number nobody
 * can read off the terms sheet.
 * ------------------------------------------------------------------ */
export function FilmHire({
  weeks,
  scale,
  houseNut,
  className = "",
}: {
  /** gross box office by week of the run */
  weeks: { week: number; gross: number }[]
  /** the distributor's percentage in each week */
  scale: number[]
  /** the fixed weekly cost of opening the screen, deducted before the split in some terms */
  houseNut?: number
  className?: string
}) {
  const rows = weeks.map((w, i) => {
    const rate = scale[Math.min(i, scale.length - 1)]
    const base = houseNut === undefined ? w.gross : Math.max(0, w.gross - houseNut)
    const hire = base * rate
    return { ...w, rate, hire, kept: w.gross - hire, keptShare: (w.gross - hire) / Math.max(w.gross, 1) }
  })
  const gross = rows.reduce((a, r) => a + r.gross, 0)
  const hire = rows.reduce((a, r) => a + r.hire, 0)
  const effective = hire / Math.max(gross, 1e-9)
  const max = Math.max(...rows.map((r) => r.gross))
  const firstRate = rows[0].rate
  const lastRate = rows[rows.length - 1].rate

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.week} className="flex items-center gap-2 text-[10px] tabular-nums">
            <span className="w-14 shrink-0">Week {r.week}</span>
            <div className="flex h-4 flex-1 rounded-[2px] bg-muted">
              <div
                className="rounded-l-[2px]"
                style={{
                  width: `${(r.hire / max) * 100}%`,
                  background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: "1px solid currentColor",
                  outlineOffset: -1,
                }}
                title={`film hire ${money(r.hire)}`}
              />
              <div className="rounded-r-[2px] bg-foreground/55" style={{ width: `${(r.kept / max) * 100}%` }} title={`kept ${money(r.kept)}`} />
            </div>
            <span className="w-40 shrink-0 text-right text-muted-foreground">
              {money(r.gross)} · {(r.rate * 100).toFixed(0)}% terms → keeps {(r.keptShare * 100).toFixed(0)}%
              {houseNut !== undefined && r.gross <= houseNut ? " — under the house allowance" : ""}
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Gross</dt>
          <dd className="font-medium tabular-nums">{money(gross)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Film hire</dt>
          <dd className="font-medium tabular-nums">{money(hire)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Effective rate</dt>
          <dd className="font-medium tabular-nums">{(effective * 100).toFixed(1)}%</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched is the distributor's share · the scale runs {(firstRate * 100).toFixed(0)}% down to{" "}
        {(lastRate * 100).toFixed(0)}%, but the effective rate over the run is{" "}
        {(effective * 100).toFixed(1)}% — WEIGHTED by where the money actually came, which is the opening weeks
        where the rate is highest · a terms sheet quotes the scale and the cinema pays the weighted number
        {houseNut !== undefined ? `, here after a ${money(houseNut)} weekly house allowance` : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SeatHeat — where an auditorium fills, with the UNSOLD BLOCK
 * derived. A percentage-full figure hides that the front three rows
 * never sell, which is a pricing question and not a demand one.
 * ------------------------------------------------------------------ */
export function SeatHeat({
  rows: seatRows,
  bookings,
  showings: showingsProp,
  className = "",
}: {
  /** row labels from the screen backwards, and how many seats in each */
  rows: { label: string; seats: number }[]
  /** how many times each seat was sold across the sample */
  bookings: number[][]
  /** how many showings the sample covers — inferring it from the busiest seat
      undercounts whenever nothing sold out, which is most rooms */
  showings?: number
  className?: string
}) {
  const showings = showingsProp ?? Math.max(1, ...bookings.flat())
  const rowRates = seatRows.map((r, ri) => {
    const seats = bookings[ri] ?? []
    return {
      ...r,
      rate: seats.reduce((a, v) => a + v, 0) / Math.max(seats.length * showings, 1),
      seatsCounted: seats.length,
    }
  })
  const overall = rowRates.reduce((a, r) => a + r.rate * r.seatsCounted, 0) / Math.max(rowRates.reduce((a, r) => a + r.seatsCounted, 0), 1)
  // the run of rows at the front that sell far below the room
  const cold = rowRates.filter((r) => r.rate < overall * 0.5)
  const coldSeats = cold.reduce((a, r) => a + r.seatsCounted, 0)
  const best = rowRates.reduce((a, r) => (r.rate > a.rate ? r : a), rowRates[0])
  const maxSeats = Math.max(...seatRows.map((r) => r.seats))

  return (
    <div className={className}>
      <div className="mb-1 text-center text-[9px] tracking-widest text-muted-foreground">SCREEN</div>
      <div className="space-y-px">
        {seatRows.map((r, ri) => (
          <div key={r.label} className="flex items-center gap-1">
            <span className="w-4 shrink-0 text-[8px] tabular-nums text-muted-foreground">{r.label}</span>
            <div className="flex flex-1 justify-center gap-px" style={{ paddingInline: `${((maxSeats - r.seats) / Math.max(maxSeats, 1)) * 20}%` }}>
              {Array.from({ length: r.seats }, (_, si) => {
                const v = (bookings[ri]?.[si] ?? 0) / showings
                return (
                  <span
                    key={si}
                    className="h-2.5 min-w-0 flex-1 rounded-[1px]"
                    style={{ background: `color-mix(in oklch, currentColor ${clamp(v * 88, 4, 88).toFixed(0)}%, transparent)` }}
                    title={`${r.label}${si + 1}: sold in ${((v * 100) || 0).toFixed(0)}% of showings`}
                  />
                )
              })}
            </div>
            <span className="w-9 shrink-0 text-right text-[8px] tabular-nums text-muted-foreground">
              {(rowRates[ri].rate * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Each cell is one SEAT and its shade is how often it sold across {showings}{" "}
        {plural(showings, "showing", "showings")} — a percentage-full figure averages this whole picture into one
        number · the room runs at {(overall * 100).toFixed(0)}% and{" "}
        {cold.length === 0
          ? "no row sells materially below it, which is a well-priced auditorium"
          : `${cold.length} ${plural(cold.length, "row", "rows")} at the front (${coldSeats} seats) sell below half of that, which is a PRICING question rather than a demand one — those seats are not wanted at the same price as row ${best.label}`}
      </p>
    </div>
  )
}
