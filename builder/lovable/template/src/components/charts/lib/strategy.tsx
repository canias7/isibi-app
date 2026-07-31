/** Roadmaps, radars and the graphs transport planners draw. */

const TONE = "var(--foreground)";

/* ---------------------------------------------------------------- tech radar */
/**
 * Technologies by ring (adopt → hold) and quadrant.
 *
 * Blips are placed by a stable HASH of the name, not at random — a radar
 * whose items jump around between renders cannot be compared with last
 * quarter's, which is the only reason to keep one.
 */
export function TechRadar({
  quadrants, rings, blips, size = 340, label,
}: {
  quadrants: string[]; /** innermost first */ rings: string[];
  blips: { name: string; quadrant: number; ring: number; moved?: "in" | "out" }[];
  size?: number; label?: string;
}) {
  if (!blips.length || !rings.length) return null;
  const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 1000) / 1000;
  };
  const R = 46;
  const place = (b: { name: string; quadrant: number; ring: number }) => {
    const inner = (b.ring / rings.length) * R, outer = ((b.ring + 1) / rings.length) * R;
    const r = inner + (outer - inner) * (0.25 + hash(b.name) * 0.5);
    const q0 = (b.quadrant / quadrants.length) * Math.PI * 2;
    const a = q0 + (hash(b.name + "a") * 0.72 + 0.14) * ((Math.PI * 2) / quadrants.length) - Math.PI / 2;
    return { x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r };
  };

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${blips.length} items on the radar`}>
        {rings.map((_, i) => (
          <circle key={i} cx={50} cy={50} r={((i + 1) / rings.length) * R}
            fill={TONE} fillOpacity={i === 0 ? 0.1 : 0} stroke={TONE} strokeWidth={0.4} strokeOpacity={0.4} />
        ))}
        {quadrants.map((_, i) => {
          const a = (i / quadrants.length) * Math.PI * 2 - Math.PI / 2;
          return <line key={i} x1={50} y1={50} x2={50 + Math.cos(a) * R} y2={50 + Math.sin(a) * R} stroke={TONE} strokeWidth={0.4} strokeOpacity={0.4} />;
        })}
        {blips.map((b) => {
          const p = place(b);
          return (
            <g key={b.name}>
              {b.moved === "in" ? (
                <polygon points={`${p.x},${p.y - 2.2} ${p.x + 2},${p.y + 1.6} ${p.x - 2},${p.y + 1.6}`} fill={TONE} />
              ) : b.moved === "out" ? (
                <polygon points={`${p.x},${p.y + 2.2} ${p.x + 2},${p.y - 1.6} ${p.x - 2},${p.y - 1.6}`}
                  fill="var(--background)" stroke={TONE} strokeWidth={0.6} />
              ) : (
                <circle cx={p.x} cy={p.y} r={1.7} fill={TONE} />
              )}
              <text x={p.x + 2.6} y={p.y + 1} fontSize={2.7} className="fill-muted-foreground">{b.name}</text>
            </g>
          );
        })}
        {/* Ring names LAST and on an opaque pill. On the axis with no backing they
            were struck through by every blip label that ran across the centre. */}
        {rings.map((r, i) => {
          const y = 50 - ((i + 0.5) / rings.length) * R;
          return (
            <g key={r}>
              <rect x={50 - r.length * 0.78 - 0.6} y={y - 2} width={r.length * 1.56 + 1.2} height={3.7} rx={0.6} fill="var(--background)" />
              <text x={50} y={y + 1} fontSize={2.8} textAnchor="middle" className="fill-muted-foreground">{r}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        {quadrants.map((q, i) => <span key={q}>{i + 1}. {q}</span>)}
      </div>
      <p className="text-[10px] text-muted-foreground">
        ▲ moved inward · ▽ moved outward · positions are fixed by name, so this compares with last quarter's
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ now next later */
/**
 * A roadmap WITHOUT dates — three horizons, no commitments implied.
 *
 * The counts per column are shown because the failure mode of this format is
 * a "Now" column with fourteen things in it, which is not a plan.
 */
export function NowNextLater({
  now, next, later, label,
}: {
  now: string[]; next: string[]; later: string[]; label?: string;
}) {
  const cols = [
    { title: "Now", items: now, weight: 1 },
    { title: "Next", items: next, weight: 0.55 },
    { title: "Later", items: later, weight: 0.25 },
  ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-3 gap-2">
        {cols.map((c) => (
          <div key={c.title}>
            <div className="flex items-baseline justify-between rounded-t-[4px] px-2 py-1"
              style={{ background: TONE, color: "var(--background)", opacity: c.weight }}>
              <span className="text-[11px] font-semibold">{c.title}</span>
              <span className="text-[10px] tabular-nums">{c.items.length}</span>
            </div>
            <div className="space-y-1 rounded-b-[4px] p-1.5" style={{ background: "var(--muted)" }}>
              {c.items.map((it) => (
                <div key={it} className="rounded-[3px] bg-background px-1.5 py-1 text-[10px] leading-tight">{it}</div>
              ))}
              {!c.items.length ? <div className="py-2 text-center text-[9px] text-muted-foreground">nothing here</div> : null}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        No dates on purpose · {now.length > 5 ? `${now.length} things in Now is more than one team can hold` : "confidence falls left to right"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ story map */
/** Activities across the top, releases as horizontal slices beneath them. */
export function StoryMap({
  activities, releases, label,
}: {
  activities: { name: string; stories: { title: string; release: number }[] }[];
  releases: string[]; label?: string;
}) {
  if (!activities.length) return null;

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-2" style={{ minWidth: activities.length * 96 }}>
        {activities.map((a) => (
          <div key={a.name} className="flex-1" style={{ minWidth: 88 }}>
            <div className="rounded-[3px] px-1.5 py-1 text-[10px] font-semibold"
              style={{ background: TONE, color: "var(--background)" }}>{a.name}</div>
            {releases.map((_, ri) => (
              <div key={ri} className="mt-1 space-y-1 border-t pt-1" style={{ borderColor: "var(--border)" }}>
                {a.stories.filter((s) => s.release === ri).map((s) => (
                  <div key={s.title} className="rounded-[3px] px-1.5 py-1 text-[9px] leading-tight"
                    style={{ background: "var(--muted)" }}>{s.title}</div>
                ))}
                {!a.stories.some((s) => s.release === ri) ? <div className="h-3" /> : null}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground" aria-label={label}>
        {releases.map((r, i) => <span key={r}>slice {i + 1} · {r}</span>)}
      </div>
      <p className="text-[10px] text-muted-foreground">Read across a slice for one release; read down a column for one activity</p>
    </div>
  );
}

/* -------------------------------------------------------------- maturity ladder */
/** Where a set of practices sit on a levelled scale, with the target marked. */
export function MaturityLadder({
  levels, practices, label,
}: {
  levels: string[]; practices: { name: string; level: number; target?: number }[]; label?: string;
}) {
  if (!practices.length || !levels.length) return null;
  const n = levels.length;
  const behind = practices.filter((p) => p.target != null && p.level < p.target);

  return (
    <div className="w-full">
      <div className="space-y-1.5">
        {practices.map((p) => (
          <div key={p.name}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[10px]">{p.name}</span>
              <span className="text-[10px] text-muted-foreground">{levels[Math.min(n - 1, p.level)]}</span>
            </div>
            <div className="relative mt-0.5 flex gap-px">
              {levels.map((_, i) => (
                <span key={i} className="h-3 flex-1 rounded-[1px]"
                  style={{ background: i <= p.level ? TONE : "var(--muted)", opacity: i <= p.level ? 1 : 1 }} />
              ))}
              {p.target != null ? (
                // Centred on the target segment. At its right edge a target of the
                // TOP level lands at 100% and is clipped away entirely — so the two
                // practices already at target showed no tick at all.
                <span className="absolute top-[-2px] bottom-[-2px] w-0.5"
                  style={{ left: `${((p.target + 0.5) / n) * 100}%`, background: TONE, transform: "translateX(-1px)" }}
                  title={`target ${levels[Math.min(n - 1, p.target)]}`} />
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
        {levels.map((l) => <span key={l} className="flex-1 truncate">{l}</span>)}
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground" aria-label={label}>
        The vertical tick is the target · {behind.length ? `${behind.length} short of it` : "all at or above target"}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- dependency wheel */
/**
 * Who depends on whom, as a circle of chords.
 *
 * Arcs are sized by total traffic through each node, so the busiest module
 * takes the most arc — the thing you are looking for when you draw this is
 * the one everybody depends on.
 */
export function DependencyWheel({
  nodes, links, size = 320, label,
}: {
  nodes: string[]; links: { from: string; to: string; weight?: number }[]; size?: number; label?: string;
}) {
  if (!nodes.length || !links.length) return null;
  const traffic = new Map(nodes.map((n) => [n, 0]));
  links.forEach((l) => {
    traffic.set(l.from, (traffic.get(l.from) ?? 0) + (l.weight ?? 1));
    traffic.set(l.to, (traffic.get(l.to) ?? 0) + (l.weight ?? 1));
  });
  const total = [...traffic.values()].reduce((s, v) => s + v, 0) || 1;
  const GAP = 0.03;
  let acc = -Math.PI / 2;
  const arcs = new Map<string, { a0: number; a1: number; mid: number }>();
  nodes.forEach((n) => {
    const span = ((traffic.get(n) ?? 0) / total) * (Math.PI * 2 - GAP * nodes.length);
    arcs.set(n, { a0: acc, a1: acc + span, mid: acc + span / 2 });
    acc += span + GAP;
  });
  const R = 40;
  const pt = (a: number, r: number) => ({ x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r });
  const busiest = [...traffic.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="w-full">
      {/* Padded viewBox — labels sit outside the ring at radius 44 and a
          left-hand one ran off the edge, so "publish" rendered as "olish". */}
      <svg viewBox="-22 -8 144 116" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${busiest[0]} is involved in the most links`}>
        {links.map((l, i) => {
          const a = arcs.get(l.from), b = arcs.get(l.to);
          if (!a || !b) return null;
          const p = pt(a.mid, R - 1), q = pt(b.mid, R - 1);
          return (
            <path key={i} d={`M ${p.x},${p.y} Q 50,50 ${q.x},${q.y}`} fill="none" stroke={TONE}
              strokeWidth={0.5 + (l.weight ?? 1) * 0.5} strokeOpacity={0.32} />
          );
        })}
        {nodes.map((n, i) => {
          const a = arcs.get(n)!;
          const p0 = pt(a.a0, R), p1 = pt(a.a1, R);
          const lp = pt(a.mid, R + 4);
          const right = Math.cos(a.mid) > 0;
          return (
            <g key={n}>
              <path d={`M ${p0.x},${p0.y} A ${R} ${R} 0 ${a.a1 - a.a0 > Math.PI ? 1 : 0} 1 ${p1.x},${p1.y}`}
                fill="none" stroke={TONE} strokeWidth={3} strokeOpacity={0.95 - (i / nodes.length) * 0.5} strokeLinecap="butt" />
              <text x={lp.x} y={lp.y + 1} fontSize={3.2} textAnchor={right ? "start" : "end"} className="fill-muted-foreground">{n}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {/* Both numbers are WEIGHTED. Against `links.length * 2` this read as a
            count of link ends and quietly compared two different units. */}
        Arc length is how much passes through · {busiest[0]} carries {busiest[1]} of {total}, the most of any module
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ marey diagram */
/**
 * The train graph: distance up the side, time across, one line per service.
 *
 * A steeper line is a faster train and a CROSSING is two trains meeting —
 * facts that are legible here and in no timetable.
 */
export function MareyGraph({
  stations, services, height = 260, label,
}: {
  /** name and distance along the line */ stations: { name: string; km: number }[];
  services: { label?: string; calls: { station: string; minutes: number }[]; dash?: boolean }[];
  height?: number; label?: string;
}) {
  if (stations.length < 2 || !services.length) return null;
  const maxKm = Math.max(...stations.map((s) => s.km));
  const at = new Map(stations.map((s) => [s.name, s.km]));
  const allMin = services.flatMap((s) => s.calls.map((c) => c.minutes));
  const t0 = Math.min(...allMin), t1 = Math.max(...allMin);
  const x = (m: number) => ((m - t0) / (t1 - t0 || 1)) * 100;
  const y = (km: number) => 100 - (km / maxKm) * 100;

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `${services.length} services over ${stations.length} stations`}>
          {stations.map((s) => (
            <line key={s.name} x1={0} y1={y(s.km)} x2={100} y2={y(s.km)}
              stroke={TONE} strokeWidth={1} strokeOpacity={0.18} vectorEffect="non-scaling-stroke" />
          ))}
          {services.map((sv, i) => (
            <polyline key={i} points={sv.calls.map((c) => `${x(c.minutes)},${y(at.get(c.station) ?? 0)}`).join(" ")}
              fill="none" stroke={TONE} strokeWidth={1.6} strokeDasharray={sv.dash ? "5 3" : undefined}
              strokeOpacity={0.9} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          ))}
        </svg>
        {stations.map((s) => (
          <span key={s.name} className="absolute left-0 text-[9px] text-muted-foreground"
            style={{ top: `${y(s.km)}%`, transform: "translateY(-115%)" }}>{s.name}</span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{Math.floor(t0 / 60)}:{String(t0 % 60).padStart(2, "0")}</span>
        <span>{Math.floor(t1 / 60)}:{String(t1 % 60).padStart(2, "0")}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Steeper is faster · dashed is the opposite direction, and a crossing is two trains passing
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- headway chart */
/**
 * Gaps between departures against the scheduled gap.
 *
 * BUNCHING is what this is for — two buses arriving together after a long
 * wait — and it is counted, not left for the reader to spot.
 */
export function HeadwayChart({
  departures, scheduled, height = 210, label,
}: {
  /** minutes past the hour */ departures: number[]; scheduled: number; height?: number; label?: string;
}) {
  if (departures.length < 2) return null;
  const sorted = [...departures].sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((d, i) => d - sorted[i]);
  const max = Math.max(scheduled, ...gaps) * 1.15;
  const bunched = gaps.filter((g) => g < scheduled * 0.5).length;
  const long = gaps.filter((g) => g > scheduled * 1.5).length;

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-1" style={{ height }}>
        {gaps.map((g, i) => {
          const bunch = g < scheduled * 0.5, gap = g > scheduled * 1.5;
          return (
            <div key={i} className="flex-1" title={`${g} min`}
              style={{
                height: `${(g / max) * 100}%`,
                background: gap ? "var(--background)" : TONE,
                opacity: bunch ? 0.35 : 1,
                border: gap ? `2px solid ${TONE}` : undefined,
              }} />
          );
        })}
        <div className="absolute right-0 left-0 border-t-2 border-dashed border-foreground" style={{ bottom: `${(scheduled / max) * 100}%` }}>
          <span className="absolute -top-3.5 right-0 text-[9px] text-muted-foreground">every {scheduled} min</span>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        {bunched} bunched {bunched === 1 ? "gap" : "gaps"} under half the headway, {long} over half again ·
        pale bars are bunching, outlined bars are the long waits it causes
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- trajectory */
/**
 * Position over time as a path, with speed shown by the SPACING of the
 * time marks — evenly spaced dots mean steady, bunched dots mean slow.
 */
export function Trajectory({
  points, markEvery = 5, size = 300, label,
}: {
  points: { x: number; y: number; t: number }[]; markEvery?: number; size?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const px = (v: number) => ((v - x0) / (x1 - x0 || 1)) * 92 + 4;
  const py = (v: number) => 96 - ((v - y0) / (y1 - y0 || 1)) * 92;
  let dist = 0;
  for (let i = 1; i < points.length; i++) dist += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  const span = points[points.length - 1].t - points[0].t;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${dist.toFixed(1)} units over ${span} of time`}>
        <polyline points={points.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={1.2} strokeOpacity={0.55} strokeLinejoin="round" />
        {points.filter((_, i) => i % markEvery === 0).map((p, i) => (
          <circle key={i} cx={px(p.x)} cy={py(p.y)} r={1.3} fill={TONE} />
        ))}
        <circle cx={px(points[0].x)} cy={py(points[0].y)} r={2.6} fill="var(--background)" stroke={TONE} strokeWidth={1.2} />
        <circle cx={px(points[points.length - 1].x)} cy={py(points[points.length - 1].y)} r={2.6} fill={TONE} />
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Hollow start, filled end · dots every {markEvery} steps, so bunched dots are slow going ·
        {dist.toFixed(1)} units travelled
      </p>
    </div>
  );
}
