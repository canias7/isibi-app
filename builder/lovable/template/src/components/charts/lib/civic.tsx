/** Elections and the arithmetic of representation. */

const TONE = "var(--foreground)";

/* ------------------------------------------------------------ parliament arc */
/**
 * Seats as an arc of individual seats, and a MAJORITY line computed from the
 * total — a chamber drawn without one hides the only fact anybody wants.
 */
export function ParliamentSeats({
  parties, size = 340, rows = 5, label,
}: {
  /** left to right, as they sit */ parties: { name: string; seats: number }[];
  size?: number; rows?: number; label?: string;
}) {
  if (!parties.length) return null;
  const total = parties.reduce((s, p) => s + p.seats, 0);
  const majority = Math.floor(total / 2) + 1;
  const largest = [...parties].sort((a, b) => b.seats - a.seats)[0];

  // Seats laid out ring by ring, each ring holding a share proportional to its
  // circumference, so the arc reads as evenly filled.
  const rowRadius = Array.from({ length: rows }, (_, i) => 22 + (i / Math.max(1, rows - 1)) * 22);
  const weight = rowRadius.reduce((s, r) => s + r, 0);
  const perRow = rowRadius.map((r) => Math.max(1, Math.round((r / weight) * total)));
  let drift = total - perRow.reduce((s, v) => s + v, 0);
  for (let i = perRow.length - 1; drift !== 0 && i >= 0; i--) {
    const step = drift > 0 ? 1 : -1;
    perRow[i] += step; drift -= step;
  }

  const slots: { x: number; y: number }[] = [];
  for (let col = 0; col < Math.max(...perRow); col++) {
    for (let r = 0; r < rows; r++) {
      if (col >= perRow[r]) continue;
      const a = Math.PI - ((col + 0.5) / perRow[r]) * Math.PI;
      slots.push({ x: 50 + Math.cos(a) * rowRadius[r], y: 50 - Math.sin(a) * rowRadius[r] });
    }
  }
  slots.sort((p, q) => Math.atan2(50 - q.y, q.x - 50) - Math.atan2(50 - p.y, p.x - 50));

  let taken = 0;
  const assigned = parties.flatMap((p, pi) =>
    Array.from({ length: p.seats }, () => ({ party: pi, name: p.name, slot: slots[taken++] })).filter((s) => s.slot));

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 58" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${largest.name} largest with ${largest.seats} of ${total}`}>
        {assigned.map((s, i) => (
          <circle key={i} cx={s.slot.x} cy={s.slot.y} r={1.5}
            fill={TONE} fillOpacity={1 - (s.party / Math.max(1, parties.length)) * 0.55}>
            <title>{s.name}</title>
          </circle>
        ))}
        <text x={50} y={54} fontSize={7} textAnchor="middle" fontWeight={700} className="fill-foreground">{total}</text>
      </svg>
      <div className="mt-1 space-y-0.5">
        {parties.map((p, i) => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONE, opacity: 1 - (i / Math.max(1, parties.length)) * 0.55 }} />
            <span className="flex-1 truncate text-[10px]">{p.name}</span>
            <span className="text-[10px] font-semibold tabular-nums">{p.seats}</span>
            {p.seats >= majority ? <span className="text-[9px] text-muted-foreground">majority</span> : null}
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {majority} seats for a majority of {total} ·
        {parties.some((p) => p.seats >= majority) ? " one party has it" : " no party has it on its own"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- swingometer */
/**
 * The swing needed to change hands, seat by seat.
 *
 * Each seat's required swing is COMPUTED from its margin (half the margin, the
 * standard two-party definition) rather than supplied, and the seats are
 * ordered by it so the reader can count off a given swing.
 */
export function Swingometer({
  seats, swing = 0, height = 230, label,
}: {
  /** margin as a share of the vote, positive = held by the incumbent */
  seats: { name: string; margin: number }[];
  /** the swing being tested, as a share */ swing?: number; height?: number; label?: string;
}) {
  if (!seats.length) return null;
  const ranked = [...seats].map((s) => ({ ...s, needs: s.margin / 2 })).sort((a, b) => a.needs - b.needs);
  const flipped = ranked.filter((s) => swing >= s.needs);
  const max = Math.max(...ranked.map((s) => s.needs), swing) * 1.1;

  return (
    <div className="w-full">
      <div className="relative" style={{ height, overflowY: "auto" }}>
        {ranked.map((s) => {
          const gone = swing >= s.needs;
          return (
            <div key={s.name} className="flex items-center gap-2 py-[1px]">
              <span className="w-24 shrink-0 truncate text-[10px]">{s.name}</span>
              <div className="relative h-2.5 flex-1 rounded-[2px]" style={{ background: "var(--muted)" }}>
                <span className="absolute top-0 bottom-0 left-0 rounded-[2px]"
                  style={{ width: `${(s.needs / max) * 100}%`, background: TONE, opacity: gone ? 1 : 0.32 }} />
              </div>
              <span className="w-10 text-right text-[9px] tabular-nums text-muted-foreground">{(s.needs * 100).toFixed(1)}%</span>
            </div>
          );
        })}
        <div className="pointer-events-none absolute top-0 bottom-0 border-l-2 border-dashed border-foreground"
          style={{ left: `calc(6rem + 0.5rem + ${(swing / max) * 100}% * (100% - 9.5rem) / 100%)` }} />
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        A seat needs half its margin to change hands · at a {(swing * 100).toFixed(1)}% swing,
        {" "}{flipped.length} of {seats.length} change (solid bars)
      </p>
    </div>
  );
}

/* ------------------------------------------------------- preference transfer */
/**
 * Single transferable vote, round by round: who is eliminated and where their
 * votes go. The QUOTA is computed (Droop), because a race is decided by
 * reaching it, not by leading.
 */
export function PreferenceTransfer({
  rounds, seats = 1, height = 250, label,
}: {
  /** each round: the standing tallies */ rounds: { candidate: string; votes: number }[][];
  seats?: number; height?: number; label?: string;
}) {
  if (!rounds.length) return null;
  const cast = rounds[0].reduce((s, c) => s + c.votes, 0);
  const quota = Math.floor(cast / (seats + 1)) + 1;
  const names = rounds[0].map((c) => c.candidate);
  const max = Math.max(...rounds.flat().map((c) => c.votes), quota) * 1.06;
  const final = rounds[rounds.length - 1];
  const winner = [...final].sort((a, b) => b.votes - a.votes)[0];

  return (
    <div className="w-full">
      {/* No scroll box: the last round is the result, and a fixed height hid it. */}
      <div className="space-y-2" style={{ minHeight: height }}>
        {rounds.map((round, ri) => {
          const present = new Set(round.map((c) => c.candidate));
          return (
            <div key={ri}>
              <div className="mb-0.5 text-[9px] font-medium text-muted-foreground">
                Round {ri + 1}
                {ri > 0 ? ` · ${names.filter((n) => !present.has(n)).join(", ")} out` : ""}
              </div>
              {round.map((c) => (
                <div key={c.candidate} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 truncate text-[10px]">{c.candidate}</span>
                  <span className="h-3 rounded-[2px]" style={{
                    width: `${(c.votes / max) * 68}%`,
                    background: TONE, opacity: c.votes >= quota ? 1 : 0.55,
                  }} />
                  <span className="text-[9px] tabular-nums text-muted-foreground">{c.votes.toLocaleString()}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Droop quota {quota.toLocaleString()} of {cast.toLocaleString()} cast for {seats} seat{seats > 1 ? "s" : ""} ·
        {winner.votes >= quota ? ` ${winner.candidate} reaches it` : ` nobody reaches it — ${winner.candidate} leads`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ referendum split */
/**
 * A yes/no result as one bar, with turnout underneath.
 *
 * Both denominators are shown, because "62% voted yes" and "62% of the
 * electorate voted yes" are different claims and the second is usually false.
 */
export function ReferendumSplit({
  yes, no, electorate, label,
}: {
  yes: number; no: number; electorate: number; label?: string;
}) {
  const cast = yes + no;
  if (!cast) return null;
  const share = yes / cast;
  const turnout = electorate > 0 ? cast / electorate : 0;
  const ofAll = electorate > 0 ? yes / electorate : 0;

  return (
    <div className="w-full">
      <div className="relative flex h-9 overflow-hidden rounded-[3px]">
        <span className="flex items-center justify-start pl-2 text-[11px] font-semibold"
          style={{ width: `${share * 100}%`, background: TONE, color: "var(--background)" }}>
          Yes {(share * 100).toFixed(1)}%
        </span>
        <span className="flex items-center justify-end pr-2 text-[11px] font-semibold"
          style={{
            width: `${(1 - share) * 100}%`,
            background: "var(--background)", border: `1px solid ${TONE}`, borderLeft: "none",
          }}>
          No {((1 - share) * 100).toFixed(1)}%
        </span>
      </div>
      <div className="relative h-2">
        <span className="absolute top-0 h-2 w-0.5 -translate-x-1/2" style={{ left: "50%", background: TONE }} />
        <span className="absolute top-0 -translate-x-1/2 text-[9px] text-muted-foreground" style={{ left: "50%", marginTop: 8 }}>half</span>
      </div>
      <div className="mt-2 h-3 rounded-[2px]" style={{ background: "var(--muted)" }}>
        <div className="h-full rounded-[2px]" style={{ width: `${turnout * 100}%`, background: TONE, opacity: 0.5 }} />
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 text-[10px] text-muted-foreground">
        <span>{cast.toLocaleString()} votes cast</span>
        <span>Turnout {(turnout * 100).toFixed(1)}%</span>
        <span>Yes {yes.toLocaleString()} · No {no.toLocaleString()}</span>
        <span>Electorate {electorate.toLocaleString()}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground" aria-label={label}>
        {(share * 100).toFixed(1)}% of those who voted, which is {(ofAll * 100).toFixed(1)}% of the electorate — the tick marks the half
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- apportionment */
/**
 * Seats allocated by population, showing the QUOTA each region earns and the
 * whole seats it actually gets.
 *
 * The gap between them is the whole subject: the highest-averages allocation is
 * computed here, so nobody has to trust a supplied number.
 */
export function Apportionment({
  regions, seats, label,
}: {
  regions: { name: string; population: number }[]; seats: number; label?: string;
}) {
  if (!regions.length || seats <= 0) return null;
  const total = regions.reduce((s, r) => s + r.population, 0);
  // D'Hondt: repeatedly give the next seat to the largest population/(1+seats).
  const got = new Map(regions.map((r) => [r.name, 0]));
  for (let i = 0; i < seats; i++) {
    let best = regions[0];
    let bestQ = -Infinity;
    for (const r of regions) {
      const q = r.population / (1 + (got.get(r.name) ?? 0));
      if (q > bestQ) { bestQ = q; best = r; }
    }
    got.set(best.name, (got.get(best.name) ?? 0) + 1);
  }
  const rows = regions.map((r) => {
    const quota = (r.population / total) * seats;
    const seatsGot = got.get(r.name) ?? 0;
    return { ...r, quota, seatsGot, diff: seatsGot - quota };
  });
  const maxQ = Math.max(...rows.map((r) => Math.max(r.quota, r.seatsGot)));
  const over = rows.reduce((a, b) => (b.diff > a.diff ? b : a));

  return (
    <div className="w-full">
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[10px]">{r.name}</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                earns {r.quota.toFixed(2)} · gets {r.seatsGot}
              </span>
            </div>
            <div className="relative mt-0.5 h-3">
              <span className="absolute top-0 bottom-0 left-0 rounded-[2px]"
                style={{ width: `${(r.seatsGot / maxQ) * 100}%`, background: TONE }} />
              <span className="absolute top-[-2px] bottom-[-2px] w-0.5"
                style={{ left: `${(r.quota / maxQ) * 100}%`, background: TONE }}
                title={`exact quota ${r.quota.toFixed(2)}`} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {seats} seats by highest averages · the tick is the exact quota, the bar what rounding gives ·
        {over.name} gains most from it ({over.diff > 0 ? "+" : ""}{over.diff.toFixed(2)} of a seat)
      </p>
    </div>
  );
}
