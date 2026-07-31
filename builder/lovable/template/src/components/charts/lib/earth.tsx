/** Weather, geography and astronomy charts. Deterministic throughout. */

const TONE = "var(--foreground)";

/* ------------------------------------------------------------ climate chart */
/**
 * The Walter-Lieth form: monthly temperature as a line, precipitation as
 * bars, on the standard 1 °C : 2 mm pairing — which is what lets the eye read
 * "bars under the line" as a dry season without doing any arithmetic.
 */
export function ClimateChart({
  months, tempC, precipMm, height = 230, label,
}: {
  months: string[]; tempC: number[]; precipMm: number[]; height?: number; label?: string;
}) {
  if (!months.length) return null;
  const tHi = Math.max(...tempC, ...precipMm.map((p) => p / 2)) * 1.15;
  const slot = 100 / months.length;
  const dry = months.filter((_, i) => precipMm[i] / 2 < tempC[i]).length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${dry} dry months`}>
      <div className="relative" style={{ height }}>
        {precipMm.map((p, i) => (
          <div key={i} className="absolute rounded-t-[2px]"
            style={{ left: `${i * slot + slot * 0.24}%`, width: `${slot * 0.52}%`, bottom: 0, height: `${(p / 2 / tHi) * 100}%`, background: TONE, opacity: 0.3 }}
            title={`${months[i]}: ${p} mm`} />
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polyline points={tempC.map((t, i) => `${i * slot + slot / 2},${100 - (t / tHi) * 100}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="flex">
        {months.map((m, i) => <div key={`${m}-${i}`} className="text-center text-[9px] text-muted-foreground" style={{ width: `${slot}%` }}>{m}</div>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Line is °C, bars are mm at the 1:2 pairing — bars under the line mean drought
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- tide chart */
/** Two lunar constituents summed over 48 hours, highs and lows marked. */
export function TideChart({
  hours = 48, height = 200, label,
}: {
  hours?: number; height?: number; label?: string;
}) {
  const level = (t: number) => 2 + 1.4 * Math.sin((t / 12.42) * Math.PI * 2) + 0.5 * Math.sin((t / 12) * Math.PI * 2 + 1.1);
  const pts = Array.from({ length: hours * 4 + 1 }, (_, i) => ({ t: i / 4, v: level(i / 4) }));
  const lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
  const X = (t: number) => (t / hours) * 100;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 88 - 6;
  const extremes = pts.filter((p, i) => i > 0 && i < pts.length - 1 &&
    ((pts[i - 1].v < p.v && pts[i + 1].v < p.v) || (pts[i - 1].v > p.v && pts[i + 1].v > p.v)));

  return (
    <div className="w-full" role="img" aria-label={label ?? `${extremes.length} turning points over ${hours} hours`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={`0,100 ${pts.map((p) => `${X(p.t)},${Y(p.v)}`).join(" ")} 100,100`} fill={TONE} fillOpacity={0.12} />
          <polyline points={pts.map((p) => `${X(p.t)},${Y(p.v)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
        {extremes.map((e, i) => (
          <span key={i} className="absolute -translate-x-1/2 text-[8px] tabular-nums text-muted-foreground"
            style={{ left: `${X(e.t)}%`, top: `calc(${Y(e.v)}% - 12px)` }}>
            {e.v.toFixed(1)}m
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>now</span><span>the two-constituent rhythm: two unequal tides a day</span><span>+{hours}h</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ daylight band */
/** Sunrise to sunset across the year, as a band. */
export function DaylightBand({
  latitude = 51.5, height = 220, label,
}: {
  latitude?: number; height?: number; label?: string;
}) {
  const days = Array.from({ length: 53 }, (_, i) => i * 7);
  const hoursOf = (day: number) => {
    const decl = 23.44 * Math.sin(((day - 81) / 365) * Math.PI * 2);
    const lat = (latitude * Math.PI) / 180, d = (decl * Math.PI) / 180;
    const cosH = -Math.tan(lat) * Math.tan(d);
    if (cosH <= -1) return 24;
    if (cosH >= 1) return 0;
    return (2 * (Math.acos(cosH) * 180) / Math.PI) / 15;
  };
  const spans = days.map((d) => { const h = hoursOf(d); return { d, rise: 12 - h / 2, set: 12 + h / 2, h }; });
  const X = (d: number) => (d / 365) * 100;
  const Y = (h: number) => (h / 24) * 100;
  const longest = spans.reduce((a, b) => (a.h >= b.h ? a : b));
  const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

  return (
    <div className="w-full" role="img" aria-label={label ?? `Daylight at ${latitude}° through the year`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon
            points={[...spans.map((s) => `${X(s.d)},${Y(s.rise)}`), ...spans.map((s) => `${X(s.d)},${Y(s.set)}`).reverse()].join(" ")}
            fill={TONE} fillOpacity={0.18} stroke={TONE} strokeOpacity={0.6} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <line x1={0} x2={100} y1={Y(12)} y2={Y(12)} stroke="var(--border)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <line x1={X(longest.d)} y1={0} x2={X(longest.d)} y2={100} stroke="var(--border)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="flex">
        {months.map((m, i) => <div key={`${m}-${i}`} className="flex-1 text-center text-[9px] text-muted-foreground">{m}</div>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {longest.h.toFixed(1)} hours at the solstice · noon dashed
      </p>
    </div>
  );
}

/* ------------------------------------------------------- temperature bands */
/** This year's line inside the normal and record ranges. */
export function TemperatureBands({
  months, record, normal, actual, height = 230, label,
}: {
  months: string[]; record: { lo: number; hi: number }[]; normal: { lo: number; hi: number }[];
  actual: number[]; height?: number; label?: string;
}) {
  if (!months.length) return null;
  const lo = Math.min(...record.map((r) => r.lo)), hi = Math.max(...record.map((r) => r.hi));
  const X = (i: number) => (i / (months.length - 1 || 1)) * 100;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 92 - 4;
  const outside = actual.filter((a, i) => a > normal[i].hi || a < normal[i].lo).length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${outside} months outside the normal range`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={[...record.map((r, i) => `${X(i)},${Y(r.hi)}`), ...record.map((r, i) => `${X(i)},${Y(r.lo)}`).reverse()].join(" ")}
            fill={TONE} fillOpacity={0.08} />
          <polygon points={[...normal.map((r, i) => `${X(i)},${Y(r.hi)}`), ...normal.map((r, i) => `${X(i)},${Y(r.lo)}`).reverse()].join(" ")}
            fill={TONE} fillOpacity={0.16} />
          <polyline points={actual.map((a, i) => `${X(i)},${Y(a)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="flex">
        {months.map((m, i) => <div key={`${m}-${i}`} className="flex-1 text-center text-[9px] text-muted-foreground">{m}</div>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Faint is the record range, mid the normal range, the line this year</p>
    </div>
  );
}

/* -------------------------------------------------------------- hyetograph */
/** Rainfall per interval as bars, the cumulative total as a line. */
export function Hyetograph({
  intervals, rainfall, height = 210, label,
}: {
  intervals: string[]; rainfall: number[]; height?: number; label?: string;
}) {
  if (!intervals.length) return null;
  let run = 0;
  const cum = rainfall.map((r) => (run += r));
  const barHi = Math.max(...rainfall) || 1;
  const total = cum[cum.length - 1];
  const slot = 100 / intervals.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${total.toFixed(0)} mm in total`}>
      <div className="relative" style={{ height }}>
        {rainfall.map((r, i) => (
          <div key={i} className="absolute rounded-t-[2px]"
            style={{ left: `${i * slot + slot * 0.18}%`, width: `${slot * 0.64}%`, bottom: 0, height: `${(r / barHi) * 62}%`, background: TONE, opacity: 0.4 }}
            title={`${intervals[i]}: ${r} mm`} />
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polyline points={cum.map((c, i) => `${i * slot + slot / 2},${100 - (c / total) * 94 - 3}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Bars are per interval · the line is the running total, {total.toFixed(0)} mm</p>
    </div>
  );
}

/* -------------------------------------------------------- elevation profile */
/** Height along a route, with the steep stretches shaded harder. */
export function ElevationProfile({
  points, height = 200, format = (n: number) => Math.round(n) + "m", label,
}: {
  points: { km: number; elevation: number }[]; height?: number;
  format?: (n: number) => string; label?: string;
}) {
  if (points.length < 2) return null;
  const lo = Math.min(...points.map((p) => p.elevation)), hi = Math.max(...points.map((p) => p.elevation));
  const kmHi = points[points.length - 1].km;
  const X = (km: number) => (km / (kmHi || 1)) * 100;
  const Y = (e: number) => 100 - ((e - lo) / (hi - lo || 1)) * 84 - 6;
  const summit = points.reduce((a, b) => (a.elevation >= b.elevation ? a : b));
  let climb = 0;
  for (let i = 1; i < points.length; i++) climb += Math.max(0, points[i].elevation - points[i - 1].elevation);

  return (
    <div className="w-full" role="img" aria-label={label ?? `${format(climb)} of climbing over ${kmHi} km`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {points.slice(1).map((p, i) => {
            const a = points[i];
            const grade = Math.abs(p.elevation - a.elevation) / ((p.km - a.km) * 1000 || 1);
            return (
              <polygon key={i}
                points={`${X(a.km)},100 ${X(a.km)},${Y(a.elevation)} ${X(p.km)},${Y(p.elevation)} ${X(p.km)},100`}
                fill={TONE} fillOpacity={0.12 + Math.min(0.5, grade * 5)} />
            );
          })}
          <polyline points={points.map((p) => `${X(p.km)},${Y(p.elevation)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute -translate-x-1/2 text-[8px] text-muted-foreground"
          style={{ left: `${X(summit.km)}%`, top: `calc(${Y(summit.elevation)}% - 12px)` }}>
          ▲ {format(summit.elevation)}
        </span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Darker fill is steeper · {format(climb)} of total climbing</p>
    </div>
  );
}

/* ----------------------------------------------------------------- sun path */
/** The sun's arc across the sky at the solstices and equinox. */
export function SunPath({
  latitude = 51.5, size = 280, label,
}: {
  latitude?: number; size?: number; label?: string;
}) {
  const lat = (latitude * Math.PI) / 180;
  const arc = (declDeg: number) => {
    const d = (declDeg * Math.PI) / 180;
    const pts: string[] = [];
    for (let h = -6; h <= 6; h += 0.25) {
      const H = (h * 15 * Math.PI) / 180;
      const alt = Math.asin(Math.sin(lat) * Math.sin(d) + Math.cos(lat) * Math.cos(d) * Math.cos(H));
      if (alt < 0) continue;
      const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(d) * Math.cos(lat));
      pts.push(`${50 + ((az * 180) / Math.PI / 130) * 46},${92 - ((alt * 180) / Math.PI / 65) * 84}`);
    }
    return pts.join(" ");
  };

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `Sun paths at ${latitude}°`}>
        <line x1={2} y1={92} x2={98} y2={92} stroke={TONE} strokeWidth={1} />
        {[15, 35, 55].map((a) => (
          <line key={a} x1={4} x2={96} y1={92 - (a / 65) * 84} y2={92 - (a / 65) * 84} stroke="var(--border)" strokeDasharray="2 3" />
        ))}
        <polyline points={arc(23.44)} fill="none" stroke={TONE} strokeWidth={1.8} />
        <polyline points={arc(0)} fill="none" stroke={TONE} strokeWidth={1.2} strokeOpacity={0.6} />
        <polyline points={arc(-23.44)} fill="none" stroke={TONE} strokeWidth={1.2} strokeOpacity={0.6} strokeDasharray="4 3" />
        <text x={50} y={97.5} textAnchor="middle" fontSize={6.5} className="fill-muted-foreground">S</text>
        <text x={6} y={97.5} fontSize={6.5} className="fill-muted-foreground">E</text>
        <text x={92} y={97.5} fontSize={6.5} className="fill-muted-foreground">W</text>
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">Solid is midsummer, faint the equinox, dashed midwinter</p>
    </div>
  );
}

/* -------------------------------------------------------------- moon phases */
/** A month of discs, each lit by where it falls in the cycle. */
export function MoonPhases({
  days = 30, startPhase = 0, cell = 26, columns = 10, label,
}: {
  days?: number; /** 0-1 through the synodic cycle. */ startPhase?: number;
  cell?: number; columns?: number; label?: string;
}) {
  const r = cell * 0.36;
  const disc = (p: number, cx: number, cy: number, key: number) => {
    const c = Math.cos(p * Math.PI * 2);
    const waxing = p < 0.5;
    const rx = Math.abs(c) * r;
    // Lit side outer semicircle, then the terminator ellipse back. The sweep
    // flips as the terminator bulges towards or away from the lit limb — and
    // the waning branch was INVERTED in the first draft, which rendered the
    // second half of the month back to front. Verified against the quarters:
    // p=0 nothing, p=0.25 right half, p=0.5 full, p=0.75 left half.
    const side = waxing ? 1 : 0;
    const term = waxing ? (c > 0 ? 0 : 1) : (c < 0 ? 0 : 1);
    return (
      <g key={key}>
        <circle cx={cx} cy={cy} r={r} fill="var(--muted)" stroke="var(--border)" strokeWidth={0.6} />
        <path d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 ${side} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${term} ${cx} ${cy - r} Z`} fill={TONE} fillOpacity={0.85} />
      </g>
    );
  };
  const rows = Math.ceil(days / columns);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${columns * cell} ${rows * cell}`} width="100%" style={{ maxWidth: columns * cell }}
        role="img" aria-label={label ?? `${days} days of lunar phases`}>
        {Array.from({ length: days }, (_, d) => {
          const p = (startPhase + d / 29.53) % 1;
          return disc(p, (d % columns) * cell + cell / 2, Math.floor(d / columns) * cell + cell / 2, d);
        })}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">One disc per day through the 29.5-day cycle</p>
    </div>
  );
}
