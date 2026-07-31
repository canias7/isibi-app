/** Flight, orbits and the two plots astronomers live in. */

const TONE = "var(--foreground)";

/* ------------------------------------------------------------ flight envelope */
/**
 * The V-n diagram: load factor against airspeed.
 *
 * The corner speed — where the stall curve meets the structural limit, and the
 * aircraft can pull maximum g without breaking or stalling — is COMPUTED from
 * where the two boundaries cross, not marked by hand.
 */
export function FlightEnvelope({
  stallSpeed, maxSpeed, positiveLimit, negativeLimit, height = 250, label,
}: {
  /** 1-g stall, in the same unit as maxSpeed */ stallSpeed: number;
  maxSpeed: number; positiveLimit: number; negativeLimit: number;
  height?: number; label?: string;
}) {
  if (stallSpeed <= 0 || maxSpeed <= stallSpeed) return null;
  // Stall boundary is n = (V/Vs)², so corner speed is where that reaches the limit.
  const corner = stallSpeed * Math.sqrt(positiveLimit);
  const cornerNeg = stallSpeed * Math.sqrt(Math.abs(negativeLimit));
  const vHi = maxSpeed * 1.06;
  const nHi = positiveLimit * 1.25, nLo = negativeLimit * 1.35;
  const x = (v: number) => (v / vHi) * 100;
  const y = (n: number) => 100 - ((n - nLo) / (nHi - nLo)) * 100;

  const upper: string[] = [];
  for (let v = 0; v <= corner; v += corner / 40) upper.push(`${x(v)},${y((v / stallSpeed) ** 2)}`);
  upper.push(`${x(corner)},${y(positiveLimit)}`, `${x(maxSpeed)},${y(positiveLimit)}`, `${x(maxSpeed)},${y(negativeLimit)}`);
  const lower: string[] = [];
  for (let v = cornerNeg; v >= 0; v -= cornerNeg / 40) lower.push(`${x(v)},${y(-((v / stallSpeed) ** 2))}`);
  const poly = [...upper, `${x(cornerNeg)},${y(negativeLimit)}`, ...lower].join(" ");

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `corner speed ${Math.round(corner)}`}>
          <polygon points={poly} fill={TONE} fillOpacity={0.12} stroke={TONE} strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <line x1={0} y1={y(0)} x2={100} y2={y(0)} stroke={TONE} strokeWidth={1} strokeOpacity={0.45} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={y(1)} x2={100} y2={y(1)} stroke={TONE} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
          <line x1={x(corner)} y1={0} x2={x(corner)} y2={100} stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${x(corner)}%`, top: `${y(positiveLimit)}%`, background: TONE }} />
        <span className="absolute text-[10px] text-muted-foreground" style={{ left: 2, top: `${y(1)}%`, transform: "translateY(-120%)" }}>1 g</span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0</span><span>{maxSpeed} kt</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Corner speed {Math.round(corner)} kt — below it the wing stalls before it breaks, above it the reverse ·
        limits {positiveLimit > 0 ? "+" : ""}{positiveLimit} to {negativeLimit} g
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- payload-range */
/**
 * How far an aircraft goes with how much load.
 *
 * Three straight segments and two BREAK POINTS, and the point of drawing it is
 * that the trade is not linear: past the first break every extra mile costs
 * payload, past the second it costs payload faster.
 */
export function PayloadRange({
  points, height = 220, label,
}: {
  /** in order of increasing range */ points: { range: number; payload: number; note?: string }[];
  height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const rHi = Math.max(...points.map((p) => p.range)) * 1.04;
  const pHi = Math.max(...points.map((p) => p.payload)) * 1.12;
  const x = (r: number) => (r / rHi) * 100;
  const y = (p: number) => 100 - (p / pHi) * 100;
  const maxPayload = points[0].payload;
  const maxRange = points[points.length - 1].range;
  // The last point still at full payload — points[0] is the y-intercept at
  // zero range, which made the caption say "20.5 t out to 0 nm".
  const fullTo = [...points].filter((p) => p.payload >= maxPayload).pop() ?? points[0];

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `${maxPayload} t to ${points[0].range} nm, ${maxRange} nm with none`}>
          <polygon points={`0,100 ${points.map((p) => `${x(p.range)},${y(p.payload)}`).join(" ")} ${x(maxRange)},100`}
            fill={TONE} fillOpacity={0.12} />
          <polyline points={points.map((p) => `${x(p.range)},${y(p.payload)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {points.map((p, i) => (
          <span key={i} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${x(p.range)}%`, top: `${y(p.payload)}%`, background: TONE }} />
        ))}
      </div>
      <div className="relative mt-1 h-3.5">
        {points.filter((p) => p.note).map((p, i) => (
          <span key={i} className="absolute -translate-x-1/2 text-[9px] text-muted-foreground"
            style={{ left: `${Math.min(88, Math.max(8, x(p.range)))}%` }}>{p.note}</span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {maxPayload} t out to {fullTo.range.toLocaleString()} nm, then every extra mile costs payload · {maxRange.toLocaleString()} nm empty
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- wind triangle */
/**
 * Heading, track and the wind between them.
 *
 * Drift angle and ground speed are SOLVED from the vectors — a navigation
 * diagram whose stated drift disagrees with its own arrows is worse than none.
 */
export function WindTriangle({
  course, trueAirspeed, windFrom, windSpeed, size = 280, label,
}: {
  /** degrees true */ course: number; trueAirspeed: number;
  /** direction the wind blows FROM, degrees */ windFrom: number; windSpeed: number;
  size?: number; label?: string;
}) {
  const rad = Math.PI / 180;
  // Wind correction angle from the sine rule, then ground speed along the course.
  const windTo = (windFrom + 180) % 360;
  const angle = (windTo - course) * rad;
  const cross = windSpeed * Math.sin(angle);
  const wca = Math.asin(Math.max(-1, Math.min(1, -cross / trueAirspeed)));
  const heading = (course + wca / rad + 360) % 360;
  const groundSpeed = trueAirspeed * Math.cos(wca) + windSpeed * Math.cos(angle);

  const vec = (bearing: number, len: number) => {
    const a = (bearing - 90) * rad;
    return { dx: Math.cos(a) * len, dy: Math.sin(a) * len };
  };
  const scale = 34 / Math.max(trueAirspeed, groundSpeed);
  const o = { x: 32, y: 76 };
  const h = vec(heading, trueAirspeed * scale);
  const g = vec(course, groundSpeed * scale);
  const arrow = (x1: number, y1: number, x2: number, y2: number, dash?: string, w = 1.6) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={TONE} strokeWidth={w} strokeDasharray={dash} />
        <polygon points={`${x2},${y2} ${x2 - Math.cos(a - 0.4) * 4},${y2 - Math.sin(a - 0.4) * 4} ${x2 - Math.cos(a + 0.4) * 4},${y2 - Math.sin(a + 0.4) * 4}`} fill={TONE} />
      </g>
    );
  };

  return (
    <div className="w-full">
      <svg viewBox="-6 -6 112 112" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `heading ${Math.round(heading)}, ground speed ${Math.round(groundSpeed)}`}>
        {arrow(o.x, o.y, o.x + h.dx, o.y + h.dy)}
        {arrow(o.x + h.dx, o.y + h.dy, o.x + g.dx, o.y + g.dy, "3 2", 1.2)}
        {arrow(o.x, o.y, o.x + g.dx, o.y + g.dy, undefined, 2.4)}
        <text x={o.x + h.dx / 2 - 5} y={o.y + h.dy / 2} fontSize={4} textAnchor="end" className="fill-muted-foreground">heading</text>
        <text x={o.x + g.dx / 2 + 3} y={o.y + g.dy / 2 + 5} fontSize={4} className="fill-muted-foreground">track</text>
        <text x={o.x + h.dx + (g.dx - h.dx) / 2} y={o.y + h.dy + (g.dy - h.dy) / 2 - 2} fontSize={4} textAnchor="middle" className="fill-muted-foreground">wind</text>
      </svg>
      <div className="mt-1 grid grid-cols-2 gap-x-3 text-[10px] text-muted-foreground">
        <span>Course {Math.round(course)}° · TAS {trueAirspeed} kt</span>
        <span>Wind {Math.round(windFrom)}° / {windSpeed} kt</span>
        <span className="font-medium text-foreground">Heading {Math.round(heading)}°</span>
        <span className="font-medium text-foreground">Ground speed {Math.round(groundSpeed)} kt</span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        Drift {Math.abs(wca / rad).toFixed(1)}° {wca > 0 ? "right" : "left"}, solved from the vectors
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- delta-v map */
/**
 * The cost of getting anywhere, as a ladder of burns.
 *
 * Each rung shows its own cost and the RUNNING TOTAL from the surface, because
 * the total is the number that decides whether a mission closes.
 */
export function DeltaVLadder({
  legs, label,
}: {
  legs: { from: string; to: string; dv: number }[]; label?: string;
}) {
  if (!legs.length) return null;
  const max = Math.max(...legs.map((l) => l.dv));
  let acc = 0;
  const rows = legs.map((l) => { acc += l.dv; return { ...l, total: acc }; });

  return (
    <div className="w-full">
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-[38%] shrink-0 truncate text-[10px]">{r.from} → {r.to}</span>
            <span className="h-3 shrink-0 rounded-[2px]" style={{ width: `${(r.dv / max) * 34}%`, background: TONE }} />
            <span className="shrink-0 text-[10px] tabular-nums">{r.dv.toLocaleString()}</span>
            <span className="ml-auto shrink-0 text-[10px] whitespace-nowrap tabular-nums text-muted-foreground">Σ {r.total.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        m/s of Δv · {acc.toLocaleString()} m/s from {legs[0].from} to {legs[legs.length - 1].to}, running total on the right
      </p>
    </div>
  );
}

/* --------------------------------------------------- Hertzsprung–Russell */
/**
 * Luminosity against temperature, with temperature running BACKWARDS.
 *
 * That reversed axis is not a quirk to be tidied away — it is what puts the
 * main sequence on a diagonal, and every published version has it.
 */
export function HertzsprungRussell({
  stars, height = 280, label,
}: {
  stars: { name?: string; tempK: number; luminosity: number; kind?: string }[];
  height?: number; label?: string;
}) {
  if (!stars.length) return null;
  // Both axes are logarithmic, and temperature descends left to right.
  const tHi = 30000, tLo = 2500;
  const x = (t: number) => ((Math.log10(tHi) - Math.log10(Math.max(tLo, Math.min(tHi, t)))) / (Math.log10(tHi) - Math.log10(tLo))) * 100;
  const lHi = 1e5, lLo = 1e-4;
  const y = (l: number) => 100 - ((Math.log10(Math.max(lLo, l)) - Math.log10(lLo)) / (Math.log10(lHi) - Math.log10(lLo))) * 100;

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
          {[1e-4, 1e-2, 1, 1e2, 1e4].map((l) => (
            <line key={l} x1={0} y1={y(l)} x2={100} y2={y(l)} stroke={TONE} strokeWidth={1} strokeOpacity={0.14} vectorEffect="non-scaling-stroke" />
          ))}
          {[20000, 10000, 6000, 4000, 3000].map((t) => (
            <line key={t} x1={x(t)} y1={0} x2={x(t)} y2={100} stroke={TONE} strokeWidth={1} strokeOpacity={0.14} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {stars.map((s, i) => {
          const r = 3 + Math.min(4, Math.log10(Math.max(1e-4, s.luminosity)) * 0.6 + 2.4);
          return (
            <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${x(s.tempK)}%`, top: `${y(s.luminosity)}%`, width: r, height: r, background: TONE, opacity: 0.85 }}
              title={`${s.name ?? ""} ${s.tempK} K`} />
          );
        })}
        {stars.filter((s) => s.name).map((s, i) => (
          <span key={`l${i}`} className="absolute text-[9px] whitespace-nowrap text-muted-foreground"
            style={{
              ...(x(s.tempK) > 62 ? { right: `${100 - x(s.tempK) + 1.5}%` } : { left: `${x(s.tempK) + 1.5}%` }),
              top: `${y(s.luminosity)}%`, transform: "translateY(-50%)",
            }}>{s.name}</span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>30,000 K</span><span>hotter ← · → cooler</span><span>2,500 K</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Luminosity in suns, both axes logarithmic · temperature runs backwards, which is what makes the main sequence a diagonal
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- light curve */
/** Brightness over time, FOLDED on a period so a repeating dip stacks up. */
export function LightCurve({
  points, period, height = 210, label,
}: {
  points: { time: number; mag: number }[]; /** fold on this, or omit for raw time */ period?: number;
  height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const folded = points.map((p) => ({ phase: period ? (p.time % period) / period : p.time, mag: p.mag }));
  const pHi = period ? 1 : Math.max(...folded.map((f) => f.phase));
  const mLo = Math.min(...folded.map((f) => f.mag)), mHi = Math.max(...folded.map((f) => f.mag));
  const pad = (mHi - mLo) * 0.12 || 0.1;
  const x = (p: number) => (p / pHi) * 100;
  // Magnitude is inverted by convention: a SMALLER number is a brighter star,
  // so brighter has to be higher or the dip reads as a peak.
  const y = (m: number) => ((m - (mLo - pad)) / (mHi - mLo + pad * 2)) * 100;
  const dimmest = folded.reduce((a, b) => (b.mag > a.mag ? b : a));

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `deepest dip ${dimmest.mag.toFixed(2)} mag`}>
          <line x1={0} y1={y(mLo)} x2={100} y2={y(mLo)} stroke={TONE} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.35} vectorEffect="non-scaling-stroke" />
        </svg>
        {folded.map((f, i) => (
          <span key={i} className="absolute h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${x(f.phase)}%`, top: `${y(f.mag)}%`, background: TONE, opacity: 0.75 }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>phase 0</span><span>{period ? `period ${period} d` : "time"}</span><span>phase 1</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Brighter is up — magnitude runs backwards · dip of {(dimmest.mag - mLo).toFixed(2)} mag at phase {dimmest.phase.toFixed(2)}
      </p>
    </div>
  );
}
