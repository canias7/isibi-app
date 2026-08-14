/** Time-use, media and planning charts. */

const TONE = "var(--foreground)";
import { inkOn } from "./_ink";

const SHADE_PCT = (t: number) => Math.round(10 + Math.min(1, Math.max(0, t)) * 78);
const SHADE = (t: number) => `color-mix(in oklch, var(--foreground) ${SHADE_PCT(t)}%, var(--muted))`;

/* ------------------------------------------------------------------ piano roll */
/** Notes as bars: pitch up, time across, the C rows ruled. */
export function PianoRoll({
  notes, height = 220, beats, label,
}: {
  notes: { pitch: number; start: number; duration: number; velocity?: number }[];
  height?: number; beats?: number; label?: string;
}) {
  if (!notes.length) return null;
  const pLo = Math.min(...notes.map((n) => n.pitch)) - 2;
  const pHi = Math.max(...notes.map((n) => n.pitch)) + 2;
  const tHi = beats ?? Math.max(...notes.map((n) => n.start + n.duration));
  const X = (t: number) => (t / (tHi || 1)) * 100;
  const Y = (p: number) => ((pHi - p) / (pHi - pLo || 1)) * 100;
  const rowH = 100 / (pHi - pLo);

  return (
    <div className="w-full" role="img" aria-label={label ?? `${notes.length} notes over ${tHi} beats`}>
      <div className="relative overflow-hidden rounded-[3px] border border-border" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {Array.from({ length: pHi - pLo }, (_, i) => {
            const pitch = pHi - i;
            const black = [1, 3, 6, 8, 10].includes(pitch % 12);
            return (
              <rect key={i} x={0} y={i * rowH} width={100} height={rowH}
                fill={black ? TONE : "transparent"} fillOpacity={black ? 0.05 : 0} />
            );
          })}
          {Array.from({ length: pHi - pLo }, (_, i) => (pHi - i) % 12 === 0 ? (
            <line key={`c${i}`} x1={0} x2={100} y1={i * rowH} y2={i * rowH} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
          ) : null)}
          {Array.from({ length: Math.ceil(tHi) + 1 }, (_, b) => (
            <line key={`b${b}`} x1={X(b)} x2={X(b)} y1={0} y2={100} stroke="var(--border)" strokeOpacity={b % 4 ? 0.3 : 0.8} vectorEffect="non-scaling-stroke" />
          ))}
          {notes.map((n, i) => (
            <rect key={`n${i}`} x={X(n.start)} y={Y(n.pitch)} width={X(n.duration)} height={rowH * 0.86} rx={0.6}
              fill={TONE} fillOpacity={0.35 + (n.velocity ?? 0.8) * 0.6} />
          ))}
        </svg>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Pitch up, beats across · shaded rows are the black keys</p>
    </div>
  );
}

/* ------------------------------------------------------------------ year wheel */
/** The year as a ring, with event spans as arcs at different radii. */
export function YearWheel({
  events, size = 300, label,
}: {
  /** Months are 0-11; spans may wrap. */ events: { label: string; from: number; to: number; ring?: number }[];
  size?: number; label?: string;
}) {
  const cx = 50, cy = 50;
  const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const A = (m: number) => (m / 12) * Math.PI * 2 - Math.PI / 2;
  const pt = (a: number, r: number) => `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${events.length} spans around the year`}>
        <circle cx={cx} cy={cy} r={44} fill="none" stroke="var(--border)" />
        <circle cx={cx} cy={cy} r={16} fill="none" stroke="var(--border)" />
        {months.map((m, i) => (
          <g key={`${m}-${i}`}>
            <line x1={cx + Math.cos(A(i)) * 16} y1={cy + Math.sin(A(i)) * 16}
              x2={cx + Math.cos(A(i)) * 44} y2={cy + Math.sin(A(i)) * 44} stroke="var(--border)" strokeOpacity={0.5} />
            <text x={cx + Math.cos(A(i + 0.5)) * 47.5} y={cy + Math.sin(A(i + 0.5)) * 47.5}
              textAnchor="middle" dominantBaseline="middle" fontSize={5.5} className="fill-muted-foreground">{m}</text>
          </g>
        ))}
        {events.map((e, i) => {
          const ring = 38 - (e.ring ?? i % 3) * 7;
          const to = e.to < e.from ? e.to + 12 : e.to;
          const a0 = A(e.from), a1 = A(to + 1);
          const big = to + 1 - e.from > 6 ? 1 : 0;
          return (
            <g key={`${e.label}-${i}`}>
              <path d={`M ${pt(a0, ring)} A ${ring} ${ring} 0 ${big} 1 ${pt(a1, ring)}`}
                fill="none" stroke={TONE} strokeWidth={3.4} strokeOpacity={0.75} strokeLinecap="round">
                <title>{e.label}</title>
              </path>
              <text x={cx + Math.cos(A((e.from + to + 1) / 2)) * (ring - 4.6)} y={cy + Math.sin(A((e.from + to + 1) / 2)) * (ring - 4.6)}
                textAnchor="middle" dominantBaseline="middle" fontSize={4.6} className="fill-muted-foreground">{e.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------- day strip */
/** One day, 24 hours, banded by what fills each stretch. */
export function DayStrip({
  segments, height = 54, label,
}: {
  segments: { from: number; to: number; label: string; tone?: number }[]; height?: number; label?: string;
}) {
  if (!segments.length) return null;
  const X = (h: number) => (h / 24) * 100;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${segments.length} bands across the day`}>
      <div className="relative w-full overflow-hidden rounded-[3px] bg-muted" style={{ height }}>
        {segments.map((s, i) => (
          <div key={`${s.label}-${i}`} className="absolute top-0 bottom-0 flex items-center justify-center overflow-hidden border-r border-background text-[9px]"
            style={{ left: `${X(s.from)}%`, width: `${X(s.to - s.from)}%`, background: SHADE(s.tone ?? 0.4), color: inkOn(SHADE_PCT(s.tone ?? 0.4)) }}
            title={`${s.label} ${s.from}:00–${s.to}:00`}>
            <span className="truncate px-1">{s.to - s.from >= 2 ? s.label : ""}</span>
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] tabular-nums text-muted-foreground">
        {[0, 6, 12, 18, 24].map((h) => <span key={h}>{h}:00</span>)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ era bands */
/**
 * Overlapping spans packed into lanes.
 *
 * The lane assignment is computed greedily — first free lane wins — so
 * overlaps are visible as stacking rather than as collisions.
 */
export function EraTimeline({
  eras, span, rowHeight = 26, label,
}: {
  eras: { label: string; from: number; to: number }[]; span?: [number, number];
  rowHeight?: number; label?: string;
}) {
  if (!eras.length) return null;
  const lo = span?.[0] ?? Math.min(...eras.map((e) => e.from));
  const hi = span?.[1] ?? Math.max(...eras.map((e) => e.to));
  const X = (v: number) => ((v - lo) / (hi - lo || 1)) * 100;

  const lanes: number[] = [];
  const placed = [...eras].sort((a, b) => a.from - b.from).map((e) => {
    let lane = lanes.findIndex((end) => end <= e.from);
    if (lane < 0) { lane = lanes.length; lanes.push(e.to); } else lanes[lane] = e.to;
    return { ...e, lane };
  });

  return (
    <div className="w-full" role="img" aria-label={label ?? `${eras.length} spans from ${lo} to ${hi}`}>
      <div className="relative" style={{ height: lanes.length * rowHeight }}>
        {placed.map((e) => (
          <div key={e.label} className="absolute flex items-center overflow-hidden rounded-[3px] px-1.5 text-[9px]"
            style={{
              left: `${X(e.from)}%`, width: `${X(e.to) - X(e.from)}%`,
              top: e.lane * rowHeight + 3, height: rowHeight - 6,
              background: SHADE(0.35 + (e.lane % 3) * 0.2), color: "var(--background)",
            }} title={`${e.label}: ${e.from}–${e.to}`}>
            <span className="truncate">{e.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] tabular-nums text-muted-foreground">
        <span>{lo}</span><span>{Math.round((lo + hi) / 2)}</span><span>{hi}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- dynamics */
/** Loudness over time with the programme average and the loud/soft reach. */
export function DynamicsChart({
  lufs, height = 200, label,
}: {
  /** Short-term loudness values, negative dB. */ lufs: number[]; height?: number; label?: string;
}) {
  if (!lufs.length) return null;
  const mean = lufs.reduce((s, v) => s + v, 0) / lufs.length;
  const lo = Math.min(...lufs), hi = Math.max(...lufs);
  const X = (i: number) => (i / (lufs.length - 1)) * 100;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 90 - 5;
  const range = hi - lo;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${range.toFixed(0)} dB of dynamic range`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={`0,100 ${lufs.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} 100,100`} fill={TONE} fillOpacity={0.14} />
          <polyline points={lufs.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          <line x1={0} x2={100} y1={Y(mean)} y2={Y(mean)} stroke={TONE} strokeOpacity={0.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Integrated {mean.toFixed(1)} LUFS dashed · {range.toFixed(0)} dB between the quietest and loudest passages
      </p>
    </div>
  );
}
