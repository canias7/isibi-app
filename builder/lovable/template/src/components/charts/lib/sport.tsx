/** Competition and sport charts. */

const TONE = "var(--foreground)";

/* --------------------------------------------------------------- shot chart */
/** Attempts on a half-court: makes solid, misses hollow. */
export function ShotChart({
  shots, width = 280, label,
}: {
  shots: { x: number; y: number; made: boolean }[]; width?: number; label?: string;
}) {
  if (!shots.length) return null;
  const made = shots.filter((s) => s.made).length;
  const H = 66;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 100 ${H}`} width="100%" style={{ maxWidth: width }}
        role="img" aria-label={label ?? `${made} of ${shots.length} made`}>
        <rect x={1} y={1} width={98} height={H - 2} fill="none" stroke={TONE} strokeWidth={1} />
        {/* Hoop, key and the arc — the landmarks that make positions readable. */}
        <circle cx={50} cy={7} r={1.8} fill="none" stroke={TONE} strokeWidth={1} />
        <rect x={38} y={1} width={24} height={22} fill="none" stroke={TONE} strokeWidth={0.8} />
        <circle cx={50} cy={23} r={7} fill="none" stroke={TONE} strokeWidth={0.8} />
        <path d={`M 8 1 L 8 12 A 44 44 0 0 0 92 12 L 92 1`} fill="none" stroke={TONE} strokeWidth={0.8} />
        {shots.map((s, i) => s.made ? (
          <circle key={i} cx={s.x} cy={s.y} r={1.7} fill={TONE} fillOpacity={0.85} />
        ) : (
          <circle key={i} cx={s.x} cy={s.y} r={1.7} fill="none" stroke={TONE} strokeWidth={0.9} strokeOpacity={0.7} />
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Solid made, hollow missed · {made} of {shots.length} ({Math.round((made / shots.length) * 100)}%)
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- win probability */
/** The in-game swing, with lead changes counted off the crossings. */
export function WinProbability({
  points, height = 210, teams = ["Home", "Away"], label,
}: {
  /** 0-1 for the first team, over game time. */ points: number[];
  height?: number; teams?: [string, string] | string[]; label?: string;
}) {
  if (points.length < 2) return null;
  const X = (i: number) => (i / (points.length - 1)) * 100;
  const Y = (p: number) => 100 - p * 96 - 2;
  let swings = 0;
  for (let i = 1; i < points.length; i++) {
    if ((points[i - 1] - 0.5) * (points[i] - 0.5) < 0) swings++;
  }

  return (
    <div className="w-full" role="img" aria-label={label ?? `${swings} lead changes`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} x2={100} y1={Y(0.5)} y2={Y(0.5)} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
          <polygon points={`0,${Y(0.5)} ${points.map((p, i) => `${X(i)},${Y(p)}`).join(" ")} 100,${Y(0.5)}`} fill={TONE} fillOpacity={0.12} />
          <polyline points={points.map((p, i) => `${X(i)},${Y(p)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute top-1 left-1 text-[9px] text-muted-foreground">{teams[0]} winning</span>
        <span className="absolute bottom-1 left-1 text-[9px] text-muted-foreground">{teams[1]} winning</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        The 50% line crossed {swings} times — final {Math.round(points[points.length - 1] * 100)}% {teams[0]}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- race gap */
/** Gap to the leader per lap. The leader is the zero line by construction. */
export function RaceGap({
  drivers, laps, height = 220, label,
}: {
  /** Seconds behind at each lap — the leader's own trace is all zeros. */
  drivers: { label: string; gaps: number[] }[]; laps: number; height?: number; label?: string;
}) {
  if (!drivers.length) return null;
  const worst = Math.max(...drivers.flatMap((d) => d.gaps)) || 1;
  const X = (i: number) => (i / (laps - 1 || 1)) * 100;
  const Y = (g: number) => (g / worst) * 90 + 4;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${drivers.length} drivers over ${laps} laps`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} x2={100} y1={4} y2={4} stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          {drivers.map((d, di) => (
            <polyline key={d.label} points={d.gaps.map((g, i) => `${X(i)},${Y(g)}`).join(" ")}
              fill="none" stroke={TONE} strokeWidth={1.1} strokeOpacity={0.75 - di * 0.14}
              strokeDasharray={di % 2 ? "4 3" : undefined} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {drivers.map((d) => (
          <span key={d.label} className="absolute -translate-y-1/2 pl-1 text-[9px] whitespace-nowrap text-muted-foreground"
            style={{ left: "100%", top: `${Y(d.gaps[d.gaps.length - 1])}%` }}>
            {d.label} +{d.gaps[d.gaps.length - 1].toFixed(1)}s
          </span>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">The leader is the flat top line · down is further behind</p>
    </div>
  );
}

/* ------------------------------------------------------------------ bracket */
/**
 * A knockout bracket where winners are DERIVED from the scores.
 *
 * Passing a winner flag alongside scores is two copies of one fact; the flag
 * is dropped and the higher score advances.
 */
export function Bracket({
  rounds, roundLabels, rowHeight = 30, label,
}: {
  /** rounds[0] is the first round: pairs with scores. */
  rounds: { a: string; b: string; scoreA: number; scoreB: number }[][];
  roundLabels?: string[]; rowHeight?: number; label?: string;
}) {
  if (!rounds.length) return null;
  const cols = rounds.length + 1;
  const colW = 100 / cols;
  const winner = (m: { a: string; b: string; scoreA: number; scoreB: number }) => (m.scoreA >= m.scoreB ? m.a : m.b);
  const H = rounds[0].length * 2 * rowHeight;
  // Centres of n*2 rows spread evenly over H — the first draft divided by
  // n*2 instead of n*4, which pushed half of every round past the container
  // and clipped the bottom of the bracket including the champion.
  const yOf = (round: number, slot: number) => {
    const per = H / (rounds[round].length * 4);
    return per * (slot * 2 + 1);
  };
  const champion = winner(rounds[rounds.length - 1][0]);

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `${champion} wins`}>
      <div className="relative min-w-[440px]" style={{ height: H + 18 }}>
        {(roundLabels ?? []).map((r, i) => (
          <span key={`${r}-${i}`} className="absolute top-0 text-[9px] text-muted-foreground" style={{ left: `${i * colW + 1}%` }}>{r}</span>
        ))}
        {rounds.map((round, ri) =>
          round.map((m, mi) => {
            const y1 = yOf(ri, mi * 2), y2 = yOf(ri, mi * 2 + 1);
            const w = winner(m);
            const row = (name: string, score: number, y: number) => (
              <div className={`absolute flex items-center justify-between rounded-[2px] border px-1.5 text-[9px] ${name === w ? "font-semibold" : "text-muted-foreground"}`}
                style={{ left: `${ri * colW + 0.5}%`, width: `${colW - 3}%`, top: y + 18 - 10, height: 20, borderColor: name === w ? TONE : "var(--border)", background: "var(--background)" }}>
                <span className="truncate">{name}</span><span className="tabular-nums">{score}</span>
              </div>
            );
            return (
              <div key={`${ri}-${mi}`}>
                {row(m.a, m.scoreA, y1)}
                {row(m.b, m.scoreB, y2)}
                <div className="absolute border-t border-r border-border"
                  style={{ left: `${(ri + 1) * colW - 2.5}%`, width: `${1.6}%`, top: y1 + 18, height: y2 - y1 }} />
              </div>
            );
          })
        )}
        <div className="absolute flex items-center rounded-[2px] px-1.5 text-[9px] font-semibold"
          style={{ left: `${rounds.length * colW + 0.5}%`, width: `${colW - 2}%`, top: yOf(rounds.length - 1, 0) + (yOf(rounds.length - 1, 1) - yOf(rounds.length - 1, 0)) / 2 + 8, height: 20, background: TONE, color: "var(--background)" }}>
          <span className="truncate">{champion}</span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- league position */
/** Position by matchday, 1 at the top, with the zones that matter shaded. */
export function LeaguePosition({
  teams, rounds, size, promotion = 2, relegation = 3, highlight, height = 240, label,
}: {
  /** positions[team][round], 1-based. */ teams: { label: string; positions: number[] }[];
  rounds: number; /** Teams in the division. */ size: number;
  promotion?: number; relegation?: number; highlight?: string; height?: number; label?: string;
}) {
  if (!teams.length) return null;
  const X = (i: number) => (i / (rounds - 1 || 1)) * 100;
  const Y = (p: number) => ((p - 1) / (size - 1 || 1)) * 92 + 4;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${teams.length} teams over ${rounds} rounds`}>
      <div className="relative" style={{ height }}>
        <div className="absolute right-0 left-0" style={{ top: 0, height: `${Y(promotion + 0.5)}%`, background: TONE, opacity: 0.06 }} />
        <div className="absolute right-0 bottom-0 left-0" style={{ height: `${100 - Y(size - relegation + 0.5)}%`, background: TONE, opacity: 0.1 }} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {teams.map((t) => {
            const on = highlight === t.label;
            return (
              <polyline key={t.label} points={t.positions.map((p, i) => `${X(i)},${Y(p)}`).join(" ")}
                fill="none" stroke={TONE} strokeWidth={on ? 2.2 : 1} strokeOpacity={on ? 1 : 0.3} vectorEffect="non-scaling-stroke" />
            );
          })}
        </svg>
        {teams.map((t) => (
          <span key={t.label} className={`absolute -translate-y-1/2 pl-1 text-[9px] whitespace-nowrap ${highlight === t.label ? "font-medium" : "text-muted-foreground"}`}
            style={{ left: "100%", top: `${Y(t.positions[t.positions.length - 1])}%` }}>
            {t.positions[t.positions.length - 1]}. {t.label}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        1st at the top · shaded top is promotion, shaded bottom relegation
      </p>
    </div>
  );
}
