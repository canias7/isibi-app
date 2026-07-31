/** Games and music theory — boards, ratings, wheels and fretboards. */

const TONE = "var(--foreground)";

/* ----------------------------------------------------------------- chess heat */
/**
 * A chessboard heatmap. The board's own light/dark squares stay visible
 * underneath as a thin outline, because without them a reader cannot tell
 * which square is which — the coordinates alone are not enough at a glance.
 */
export function ChessHeat({
  /** counts[rank 8→1][file a→h] */ counts, size = 300, label,
}: {
  counts: number[][]; size?: number; label?: string;
}) {
  if (counts.length !== 8) return null;
  const max = Math.max(...counts.flat()) || 1;
  const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const hottest = (() => {
    let best = { r: 0, f: 0, v: -1 };
    counts.forEach((row, r) => row.forEach((v, f) => { if (v > best.v) best = { r, f, v }; }));
    return best;
  })();

  return (
    <div className="w-full">
      <svg viewBox="-6 -2 108 108" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `busiest square ${FILES[hottest.f]}${8 - hottest.r}`}>
        {counts.map((row, r) => row.map((v, f) => {
          const dark = (r + f) % 2 === 1;
          const k = v / max;
          return (
            <g key={`${r}-${f}`}>
              <rect x={f * 12.5} y={r * 12.5} width={12.5} height={12.5}
                fill={dark ? TONE : "var(--background)"} fillOpacity={dark ? 0.1 : 1}
                stroke="var(--border)" strokeWidth={0.2} />
              <rect x={f * 12.5 + 0.9} y={r * 12.5 + 0.9} width={10.7} height={10.7}
                fill={TONE} fillOpacity={k * 0.92} rx={0.8} />
              {v > 0 ? (
                <text x={f * 12.5 + 6.25} y={r * 12.5 + 7.6} fontSize={3.6} textAnchor="middle"
                  fill={k > 0.5 ? "var(--background)" : "var(--foreground)"}>{v}</text>
              ) : null}
            </g>
          );
        }))}
        {FILES.map((f, i) => <text key={f} x={i * 12.5 + 6.25} y={104.5} fontSize={3.6} textAnchor="middle" className="fill-muted-foreground">{f}</text>)}
        {[8, 7, 6, 5, 4, 3, 2, 1].map((r, i) => <text key={r} x={-1.6} y={i * 12.5 + 7.6} fontSize={3.6} textAnchor="end" className="fill-muted-foreground">{r}</text>)}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Busiest square {FILES[hottest.f]}{8 - hottest.r} with {hottest.v} · the board pattern stays visible underneath
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ dice grid */
/**
 * The 6×6 outcome grid of two dice, shaded by the total, with the
 * distribution of sums counted OFF the grid beside it.
 */
export function DiceGrid({
  highlight, size = 250, label,
}: {
  /** sums to pick out, e.g. [7] */ highlight?: number[]; size?: number; label?: string;
}) {
  const rows = [1, 2, 3, 4, 5, 6];
  const sums = new Map<number, number>();
  rows.forEach((a) => rows.forEach((b) => sums.set(a + b, (sums.get(a + b) ?? 0) + 1)));
  const maxCount = Math.max(...sums.values());
  const picked = new Set(highlight ?? []);
  const pickedWays = [...picked].reduce((s, v) => s + (sums.get(v) ?? 0), 0);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-start gap-4">
        <div style={{ maxWidth: size, flex: "1 1 180px" }}>
          <div className="grid grid-cols-7 gap-px text-[10px]">
            <span />
            {rows.map((b) => <span key={b} className="text-center font-semibold">{b}</span>)}
            {rows.map((a) => (
              <div key={a} className="contents">
                <span className="self-center font-semibold">{a}</span>
                {rows.map((b) => {
                  const on = picked.has(a + b);
                  return (
                    <span key={b} className="flex aspect-square items-center justify-center border tabular-nums"
                      style={{
                        borderColor: "var(--border)",
                        background: on ? TONE : `color-mix(in oklch, ${TONE} ${Math.round(((a + b) / 12) * 22)}%, transparent)`,
                        color: on ? "var(--background)" : "var(--foreground)",
                        fontWeight: on ? 700 : 400,
                      }}>{a + b}</span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1" style={{ minWidth: 130 }}>
          {[...sums.entries()].sort((a, b) => a[0] - b[0]).map(([sum, n]) => (
            <div key={sum} className="flex items-center gap-1.5">
              <span className="w-4 text-right text-[10px] tabular-nums">{sum}</span>
              <span className="h-2.5 rounded-[2px]" style={{
                width: `${(n / maxCount) * 82}%`,
                background: TONE, opacity: picked.has(sum) ? 1 : 0.4,
              }} />
              <span className="text-[9px] text-muted-foreground">{n}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        36 equally likely rolls · {picked.size ? `${[...picked].join(", ")} in ${pickedWays} of them (${Math.round((pickedWays / 36) * 100)}%)` : "7 is the most common because it has the most ways"}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- round robin */
/**
 * The results grid of an all-plays-all, with the table STANDINGS counted from
 * the grid — a league table that disagrees with its own results is the error
 * this shape exists to make impossible.
 */
export function RoundRobin({
  teams, results, points = { win: 3, draw: 1, loss: 0 }, size = 300, label,
}: {
  teams: string[];
  /** results[home][away] = "W" | "D" | "L" from the home team's view, or null */
  results: (("W" | "D" | "L") | null)[][];
  points?: { win: number; draw: number; loss: number };
  size?: number; label?: string;
}) {
  if (!teams.length) return null;
  const table = teams.map((t, i) => {
    let w = 0, d = 0, l = 0;
    results[i]?.forEach((r) => { if (r === "W") w++; else if (r === "D") d++; else if (r === "L") l++; });
    results.forEach((row, j) => {
      const r = row[i];
      if (j === i || !r) return;
      if (r === "W") l++; else if (r === "D") d++; else if (r === "L") w++;
    });
    return { t, w, d, l, pts: w * points.win + d * points.draw + l * points.loss };
  }).sort((a, b) => b.pts - a.pts || a.t.localeCompare(b.t));

  const glyph = { W: "●", D: "◐", L: "○" } as const;
  return (
    <div className="w-full">
      <div className="flex flex-wrap items-start gap-4">
        <div style={{ flex: "0 1 auto", maxWidth: size }}>
          <table className="border-collapse text-[10px]">
            <tbody>
              <tr>
                <td />
                {teams.map((t) => <td key={t} className="px-1 pb-0.5 text-center font-semibold">{t.slice(0, 3)}</td>)}
              </tr>
              {teams.map((home, i) => (
                <tr key={home}>
                  <td className="pr-1.5 font-semibold whitespace-nowrap">{home}</td>
                  {teams.map((_, j) => (
                    <td key={j} className="h-6 w-6 border text-center" style={{ borderColor: "var(--border)", background: i === j ? "var(--muted)" : undefined }}>
                      {i === j ? "" : results[i]?.[j] ? glyph[results[i][j]!] : "·"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex-1" style={{ minWidth: 150 }}>
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-2 text-[10px] tabular-nums">
            <span className="font-semibold">Team</span><span className="font-semibold">W</span><span className="font-semibold">D</span><span className="font-semibold">L</span><span className="font-semibold">Pts</span>
            {table.map((r) => (
              <div key={r.t} className="contents">
                <span className="truncate">{r.t}</span><span>{r.w}</span><span>{r.d}</span><span>{r.l}</span><span className="font-semibold">{r.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Rows are the home side · ● won ◐ drew ○ lost · the table is counted from this grid
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- elo history */
/** Rating over time for several players, with the provisional band shaded. */
export function EloHistory({
  players, provisionalBelow, height = 230, label,
}: {
  players: { name: string; ratings: { period: string; rating: number }[] }[];
  provisionalBelow?: number; height?: number; label?: string;
}) {
  if (!players.length) return null;
  const all = players.flatMap((p) => p.ratings.map((r) => r.rating));
  const lo = Math.min(...all) - 30, hi = Math.max(...all) + 30;
  const n = Math.max(...players.map((p) => p.ratings.length));
  const x = (i: number) => (i / Math.max(1, n - 1)) * 100;
  const y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 100;
  const dashes = ["", "5 3", "2 2", "7 2 2 2"];

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${players.length} players' ratings`}>
        {provisionalBelow ? (
          <rect x={0} y={y(provisionalBelow)} width={100} height={100 - y(provisionalBelow)} fill={TONE} fillOpacity={0.06} />
        ) : null}
        {players.map((p, pi) => (
          <polyline key={p.name} points={p.ratings.map((r, i) => `${x(i)},${y(r.rating)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.8} strokeDasharray={dashes[pi % dashes.length] || undefined}
            strokeOpacity={0.95 - pi * 0.12} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{players[0].ratings[0]?.period}</span>
        <span>{players[0].ratings[players[0].ratings.length - 1]?.period}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {players.map((p, i) => {
          const first = p.ratings[0]?.rating ?? 0, last = p.ratings[p.ratings.length - 1]?.rating ?? 0;
          return (
            <span key={p.name} className="flex items-center gap-1">
              <svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={1.8} strokeDasharray={dashes[i % dashes.length] || undefined} /></svg>
              {p.name} {last} ({last - first >= 0 ? "+" : ""}{last - first})
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- go influence */
/** A Go board with stones and the territory each side's influence covers. */
export function GoInfluence({
  size: boardSize = 9, stones, px = 300, label,
}: {
  size?: number;
  stones: { x: number; y: number; colour: "black" | "white" }[];
  px?: number; label?: string;
}) {
  const step = 100 / (boardSize + 1);
  // Influence falls off with distance, summed per point — the standard
  // radiating estimate, computed here so the shading and the stones agree.
  const field: number[][] = Array.from({ length: boardSize }, (_, r) =>
    Array.from({ length: boardSize }, (_, c) => {
      let v = 0;
      for (const s of stones) {
        const d = Math.abs(s.x - c) + Math.abs(s.y - r);
        v += (s.colour === "black" ? 1 : -1) / Math.pow(2, d);
      }
      return v;
    }));
  const black = field.flat().filter((v) => v > 0.05).length;
  const white = field.flat().filter((v) => v < -0.05).length;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: px }}
        role="img" aria-label={label ?? `black leads ${black} points of influence to ${white}`}>
        {/* White's influence was filled with var(--background) on a near-white
            board, so half the chart was invisible while the caption claimed both
            sides. It is hatched instead — a second texture, not a second colour,
            which is also what keeps this readable in greyscale. */}
        <defs>
          <pattern id="go-white" width={2.6} height={2.6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={2.6} stroke={TONE} strokeWidth={0.9} />
          </pattern>
        </defs>
        <rect x={0} y={0} width={100} height={100} fill="var(--muted)" fillOpacity={0.3} />
        {field.map((row, r) => row.map((v, c) => (
          <rect key={`${r}-${c}`} x={(c + 0.5) * step} y={(r + 0.5) * step} width={step} height={step}
            fill={v > 0 ? TONE : "url(#go-white)"} fillOpacity={Math.min(0.55, Math.abs(v) * 0.9)} />
        )))}
        {Array.from({ length: boardSize }, (_, i) => (
          <g key={i}>
            <line x1={step} y1={(i + 1) * step} x2={boardSize * step} y2={(i + 1) * step} stroke={TONE} strokeWidth={0.3} strokeOpacity={0.5} />
            <line x1={(i + 1) * step} y1={step} x2={(i + 1) * step} y2={boardSize * step} stroke={TONE} strokeWidth={0.3} strokeOpacity={0.5} />
          </g>
        ))}
        {stones.map((s, i) => (
          <circle key={i} cx={(s.x + 1) * step} cy={(s.y + 1) * step} r={step * 0.42}
            fill={s.colour === "black" ? TONE : "var(--background)"} stroke={TONE} strokeWidth={0.6} />
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Solid is black's influence, hatched is white's, halving each point away · black {black} points, white {white}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- circle of fifths */
/** The twelve keys around a circle, with a set of them picked out. */
export function CircleOfFifths({
  highlight = [], size = 280, label,
}: {
  highlight?: string[]; size?: number; label?: string;
}) {
  const MAJOR = ["C", "G", "D", "A", "E", "B", "F♯", "C♯", "G♯", "D♯", "A♯", "F"];
  const MINOR = ["Am", "Em", "Bm", "F♯m", "C♯m", "G♯m", "D♯m", "A♯m", "Fm", "Cm", "Gm", "Dm"];
  const on = new Set(highlight);
  const at = (i: number, r: number) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r };
  };

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? "circle of fifths"}>
        {/* The separator sits BETWEEN the two rings (minors reach 28, majors start
            at 29) — drawn at the old radius it cut straight through the minors. */}
        <circle cx={50} cy={50} r={44} fill="none" stroke={TONE} strokeWidth={0.4} strokeOpacity={0.4} />
        <circle cx={50} cy={50} r={28.6} fill="none" stroke={TONE} strokeWidth={0.4} strokeOpacity={0.4} />
        {MAJOR.map((k, i) => {
          // Twelve circles of radius r round a ring of radius R need
          // 2πR/12 > 2r to clear each other: at R=23, r=5 that is 12.0 > 10.
          const p = at(i, 36), q = at(i, 23);
          const kOn = on.has(k), mOn = on.has(MINOR[i]);
          return (
            <g key={k}>
              <circle cx={p.x} cy={p.y} r={7} fill={kOn ? TONE : "var(--background)"} stroke={TONE} strokeWidth={0.6} />
              <text x={p.x} y={p.y + 1.6} fontSize={4.8} textAnchor="middle" fontWeight={600}
                fill={kOn ? "var(--background)" : "var(--foreground)"}>{k}</text>
              <circle cx={q.x} cy={q.y} r={5} fill={mOn ? TONE : "var(--background)"} stroke={TONE} strokeWidth={0.5} strokeOpacity={0.7} />
              <text x={q.x} y={q.y + 1.2} fontSize={3.4} textAnchor="middle"
                fill={mOn ? "var(--background)" : "var(--muted-foreground)"}>{MINOR[i]}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Clockwise adds a sharp · neighbours share six of seven notes, which is why they sound close
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- fretboard */
/** A chord shape on the neck, with muted and open strings marked at the nut. */
export function FretboardChord({
  name, frets, fingers, size = 220, label,
}: {
  name: string;
  /** per string, low to high: 0 open, -1 muted */ frets: number[];
  fingers?: number[]; size?: number; label?: string;
}) {
  if (!frets.length) return null;
  const played = frets.filter((f) => f > 0);
  // Shapes reachable from the nut are drawn in open position; anything past the
  // fifth fret shifts the window down to where the fingers actually are.
  const start = played.length && Math.max(...played) > 4 ? Math.min(...played) : 1;
  const muted = frets.filter((f) => f === -1).length;
  const open = frets.filter((f) => f === 0).length;
  const rows = 5, cols = frets.length;
  const cw = 80 / (cols - 1), rh = 68 / rows;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${name} chord`}>
        <text x={50} y={7} fontSize={8} textAnchor="middle" fontWeight={700} className="fill-foreground">{name}</text>
        {frets.map((f, i) => (
          <text key={`m${i}`} x={10 + i * cw} y={17} fontSize={5} textAnchor="middle" className="fill-muted-foreground">
            {f === -1 ? "×" : f === 0 ? "○" : ""}
          </text>
        ))}
        <line x1={10} y1={21} x2={10 + (cols - 1) * cw} y2={21}
          stroke={TONE} strokeWidth={start === 1 ? 2.6 : 0.6} />
        {Array.from({ length: rows }, (_, r) => (
          <line key={r} x1={10} y1={21 + (r + 1) * rh} x2={10 + (cols - 1) * cw} y2={21 + (r + 1) * rh} stroke={TONE} strokeWidth={0.6} strokeOpacity={0.6} />
        ))}
        {frets.map((_, i) => (
          <line key={`s${i}`} x1={10 + i * cw} y1={21} x2={10 + i * cw} y2={21 + rows * rh} stroke={TONE} strokeWidth={0.6} strokeOpacity={0.6} />
        ))}
        {start > 1 ? <text x={4} y={21 + rh * 0.7} fontSize={5} textAnchor="middle" className="fill-muted-foreground">{start}</text> : null}
        {frets.map((f, i) => {
          if (f <= 0) return null;
          const r = f - start;
          if (r < 0 || r >= rows) return null;
          return (
            <g key={`d${i}`}>
              <circle cx={10 + i * cw} cy={21 + r * rh + rh / 2} r={5} fill={TONE} />
              {fingers?.[i] ? (
                <text x={10 + i * cw} y={21 + r * rh + rh / 2 + 1.8} fontSize={4.6} textAnchor="middle" fill="var(--background)" fontWeight={700}>{fingers[i]}</text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {muted} muted, {open} played open · {start > 1 ? `starting at fret ${start}` : "open position"}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- scale wheel */
/**
 * A scale as its interval pattern round the twelve semitones — the SHAPE is
 * the scale, so two modes of the same set look identical apart from where
 * the root sits, which is exactly the fact worth seeing.
 */
export function ScaleWheel({
  root, semitones, name, size = 250, label,
}: {
  root: string; /** offsets from the root, 0-11 */ semitones: number[]; name?: string; size?: number; label?: string;
}) {
  const NOTES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const rootIdx = Math.max(0, NOTES.indexOf(root));
  const on = new Set(semitones.map((s) => (rootIdx + s) % 12));
  const at = (i: number, r: number) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r };
  };
  const steps = semitones.slice().sort((a, b) => a - b)
    .map((s, i, arr) => (i === arr.length - 1 ? 12 - s + arr[0] : arr[i + 1] - s));

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${root} ${name ?? "scale"}`}>
        <circle cx={50} cy={50} r={34} fill="none" stroke={TONE} strokeWidth={0.4} strokeOpacity={0.35} />
        <polygon points={[...on].sort((a, b) => a - b).map((i) => { const p = at(i, 34); return `${p.x},${p.y}`; }).join(" ")}
          fill={TONE} fillOpacity={0.12} stroke={TONE} strokeWidth={0.8} />
        {NOTES.map((nt, i) => {
          const p = at(i, 34), isOn = on.has(i), isRoot = i === rootIdx;
          return (
            <g key={nt}>
              <circle cx={p.x} cy={p.y} r={isRoot ? 7 : 6}
                fill={isOn ? TONE : "var(--background)"} stroke={TONE} strokeWidth={isRoot ? 1.6 : 0.6} />
              <text x={p.x} y={p.y + 1.6} fontSize={4.4} textAnchor="middle" fontWeight={isRoot ? 700 : 500}
                fill={isOn ? "var(--background)" : "var(--muted-foreground)"}>{nt}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {root} {name ?? "scale"} · steps {steps.join("–")} · the ringed note is the root
      </p>
    </div>
  );
}
