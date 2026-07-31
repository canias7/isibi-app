/** Cartographic projections, terrain and the things drawn on top of them. */

const TONE = "var(--foreground)";

/* ---------------------------------------------------------------- graticule */
/**
 * A world graticule under a set of points, in an equirectangular projection.
 *
 * The projection is stated, not implied — a map that does not say what it is
 * cannot be read for distance or area, and equirectangular is the one that
 * looks right at the equator and stretches badly at the poles.
 */
export function Graticule({
  points = [], step = 30, size = 320, label,
}: {
  points?: { lon: number; lat: number; label?: string; weight?: number }[];
  /** degrees between grid lines */ step?: number;
  size?: number; label?: string;
}) {
  const x = (lon: number) => ((lon + 180) / 360) * 100;
  const y = (lat: number) => ((90 - lat) / 180) * 50;
  const meridians: number[] = [];
  for (let l = -180; l <= 180; l += step) meridians.push(l);
  const parallels: number[] = [];
  for (let l = -90; l <= 90; l += step) parallels.push(l);

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 50" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${points.length} places on an equirectangular grid`}>
        <rect x={0} y={0} width={100} height={50} fill="var(--muted)" fillOpacity={0.35} />
        {meridians.map((l) => (
          <line key={`m${l}`} x1={x(l)} y1={0} x2={x(l)} y2={50}
            stroke={TONE} strokeWidth={l === 0 ? 0.5 : 0.2} strokeOpacity={l === 0 ? 0.55 : 0.28} />
        ))}
        {parallels.map((l) => (
          <line key={`p${l}`} x1={0} y1={y(l)} x2={100} y2={y(l)}
            stroke={TONE} strokeWidth={l === 0 ? 0.5 : 0.2} strokeOpacity={l === 0 ? 0.55 : 0.28} />
        ))}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(p.lon)} cy={y(p.lat)} r={1 + (p.weight ?? 0.5) * 1.8} fill={TONE} fillOpacity={0.8} />
            {p.label ? (
              <text x={x(p.lon) + 2} y={y(p.lat) - 1.4} fontSize={2.6}
                textAnchor={x(p.lon) > 78 ? "end" : "start"}
                className="fill-muted-foreground">{p.label}</text>
            ) : null}
          </g>
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Equirectangular · {step}° graticule · areas near the poles are stretched, so do not compare them
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- great circle */
/**
 * Shortest paths between places, drawn as the curves they actually are.
 *
 * On an equirectangular map a straight line is NOT the short way — the
 * great-circle path is sampled and the straight rhumb is drawn faintly
 * beside it, so the difference is visible rather than asserted.
 */
export function GreatCircle({
  routes, size = 320, samples = 48, label,
}: {
  routes: { from: { lon: number; lat: number; label?: string }; to: { lon: number; lat: number; label?: string }; dash?: boolean }[];
  size?: number; samples?: number; label?: string;
}) {
  if (!routes.length) return null;
  const rad = Math.PI / 180;
  const px = (lon: number) => ((lon + 180) / 360) * 100;
  const py = (lat: number) => ((90 - lat) / 180) * 50;

  // Spherical interpolation, so the drawn curve is the real path rather than
  // a decorative arc bent by an arbitrary amount.
  const arc = (a: { lon: number; lat: number }, b: { lon: number; lat: number }) => {
    const φ1 = a.lat * rad, λ1 = a.lon * rad, φ2 = b.lat * rad, λ2 = b.lon * rad;
    const d = 2 * Math.asin(Math.sqrt(
      Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
    if (!d) return `${px(a.lon)},${py(a.lat)}`;
    const pts: string[] = [];
    for (let i = 0; i <= samples; i++) {
      const f = i / samples;
      const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
      const X = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
      const Y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
      const Z = A * Math.sin(φ1) + B * Math.sin(φ2);
      pts.push(`${px(Math.atan2(Y, X) / rad)},${py(Math.atan2(Z, Math.hypot(X, Y)) / rad)}`);
    }
    return pts.join(" ");
  };
  const km = (a: { lon: number; lat: number }, b: { lon: number; lat: number }) =>
    Math.round(6371 * 2 * Math.asin(Math.sqrt(
      Math.sin((b.lat - a.lat) * rad / 2) ** 2 +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2)));

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 50" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${routes.length} great-circle routes`}>
        <rect x={0} y={0} width={100} height={50} fill="var(--muted)" fillOpacity={0.3} />
        {[-60, -30, 0, 30, 60].map((l) => (
          <line key={l} x1={0} y1={py(l)} x2={100} y2={py(l)} stroke={TONE} strokeWidth={0.2} strokeOpacity={0.25} />
        ))}
        {routes.map((r, i) => (
          <g key={i}>
            <line x1={px(r.from.lon)} y1={py(r.from.lat)} x2={px(r.to.lon)} y2={py(r.to.lat)}
              stroke={TONE} strokeWidth={0.35} strokeOpacity={0.3} strokeDasharray="1.5 1.5" />
            <polyline points={arc(r.from, r.to)} fill="none" stroke={TONE}
              strokeWidth={1} strokeOpacity={0.9} strokeDasharray={r.dash ? "2 1.5" : undefined} />
            {[r.from, r.to].map((p, j) => (
              <g key={j}>
                <circle cx={px(p.lon)} cy={py(p.lat)} r={1.1} fill={TONE} />
                {p.label ? (
                  <text x={px(p.lon)} y={py(p.lat) - 2} fontSize={2.6} textAnchor="middle"
                    className="fill-muted-foreground">{p.label}</text>
                ) : null}
              </g>
            ))}
          </g>
        ))}
      </svg>
      <div className="mt-1 space-y-0.5">
        {routes.map((r, i) => (
          <p key={i} className="text-[10px] text-muted-foreground">
            {r.from.label ?? "from"} → {r.to.label ?? "to"} · {km(r.from, r.to).toLocaleString()} km
          </p>
        ))}
        <p className="text-[10px] text-muted-foreground">Dotted is the straight line on this projection — it is the longer way</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- azimuthal */
/** Range rings and bearings from one origin — what is within reach, and where. */
export function AzimuthalRange({
  origin, places, rings, size = 300, label,
}: {
  origin: string;
  places: { label: string; bearing: number; distance: number }[];
  /** ring distances in the same unit as `distance` */ rings: number[];
  size?: number; label?: string;
}) {
  if (!places.length) return null;
  const max = Math.max(...rings, ...places.map((p) => p.distance)) * 1.05;
  const at = (bearing: number, distance: number) => {
    const a = (bearing - 90) * (Math.PI / 180);
    const r = (distance / max) * 44;
    return { x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r };
  };

  return (
    <div className="w-full">
      {/* Padded viewBox: the compass letters sit OUTSIDE the outermost ring, or
          "W" lands on top of a station label reaching left from a nearby point. */}
      <svg viewBox="-14 -10 128 124" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${places.length} places around ${origin}`}>
        {rings.map((r) => (
          <g key={r}>
            <circle cx={50} cy={50} r={(r / max) * 44} fill="none" stroke={TONE} strokeWidth={0.3} strokeOpacity={0.35} strokeDasharray="1.5 1.5" />
            <text x={50} y={50 - (r / max) * 44 - 0.8} fontSize={3} textAnchor="middle" className="fill-muted-foreground">{r}</text>
          </g>
        ))}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((b) => {
          const e = at(b, max);
          return <line key={b} x1={50} y1={50} x2={e.x} y2={e.y} stroke={TONE} strokeWidth={0.2} strokeOpacity={0.22} />;
        })}
        {["N", "E", "S", "W"].map((d, i) => {
          const a = (i * 90 - 90) * (Math.PI / 180);
          return (
            <text key={d} x={50 + Math.cos(a) * 53} y={50 + Math.sin(a) * 53 + 1.3}
              fontSize={4} textAnchor="middle" fontWeight={600} className="fill-foreground">{d}</text>
          );
        })}
        {places.map((p) => {
          const e = at(p.bearing, p.distance);
          return (
            <g key={p.label}>
              <line x1={50} y1={50} x2={e.x} y2={e.y} stroke={TONE} strokeWidth={0.4} strokeOpacity={0.45} />
              <circle cx={e.x} cy={e.y} r={1.6} fill={TONE} />
              <text x={e.x + (e.x > 50 ? 2.4 : -2.4)} y={e.y + 1} fontSize={3.2}
                textAnchor={e.x > 50 ? "start" : "end"} className="fill-muted-foreground">{p.label}</text>
            </g>
          );
        })}
        <circle cx={50} cy={50} r={2} fill={TONE} />
        <text x={50} y={56} fontSize={3.4} textAnchor="middle" className="fill-foreground">{origin}</text>
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Distance is true from {origin} only · rings at {rings.join(", ")}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- contours */
/**
 * A contour map with the lines LABELLED.
 *
 * An unlabelled contour map is a pattern: you cannot tell a hill from a hollow
 * without a number on the line, and the direction of the slope is the whole
 * question. Every nth line is drawn heavier and carries its height.
 */
export function ContourMap({
  /** field[row][col], row 0 at the top */ field, levels, size = 300, indexEvery = 2, label,
}: {
  field: number[][]; levels: number[]; size?: number; indexEvery?: number; label?: string;
}) {
  if (!field.length) return null;
  const rows = field.length, cols = field[0].length;
  const cw = 100 / (cols - 1), ch = 100 / (rows - 1);

  // Marching squares, linear-interpolated. Segments per level, joined loosely.
  const segsFor = (t: number) => {
    const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const lerp = (a: number, b: number) => (t - a) / (b - a || 1e-9);
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const tl = field[r][c], tr = field[r][c + 1], br = field[r + 1][c + 1], bl = field[r + 1][c];
        const idx = (tl > t ? 8 : 0) | (tr > t ? 4 : 0) | (br > t ? 2 : 0) | (bl > t ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const T = { x: (c + lerp(tl, tr)) * cw, y: r * ch };
        const R = { x: (c + 1) * cw, y: (r + lerp(tr, br)) * ch };
        const B = { x: (c + lerp(bl, br)) * cw, y: (r + 1) * ch };
        const L = { x: c * cw, y: (r + lerp(tl, bl)) * ch };
        const join = (a: { x: number; y: number }, b: { x: number; y: number }) =>
          out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        if (idx === 1 || idx === 14) join(L, B);
        else if (idx === 2 || idx === 13) join(B, R);
        else if (idx === 3 || idx === 12) join(L, R);
        else if (idx === 4 || idx === 11) join(T, R);
        else if (idx === 6 || idx === 9) join(T, B);
        else if (idx === 7 || idx === 8) join(L, T);
        else { join(L, T); join(B, R); }
      }
    }
    return out;
  };

  return (
    <div className="w-full">
      <svg viewBox="-4 -4 108 108" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `contours from ${Math.min(...levels)} to ${Math.max(...levels)}`}>
        <rect x={0} y={0} width={100} height={100} fill="var(--muted)" fillOpacity={0.3} />
        {levels.map((t, li) => {
          const heavy = li % indexEvery === 0;
          const segs = segsFor(t);
          const mark = segs[Math.floor(segs.length / 2)];
          return (
            <g key={t}>
              {segs.map((s, i) => (
                <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                  stroke={TONE} strokeWidth={heavy ? 0.9 : 0.4} strokeOpacity={heavy ? 0.85 : 0.45} strokeLinecap="round" />
              ))}
              {heavy && mark ? (
                <g>
                  <rect x={mark.x1 - 4} y={mark.y1 - 2.4} width={8} height={4.8} rx={0.8} fill="var(--background)" />
                  <text x={mark.x1} y={mark.y1 + 1.4} fontSize={3.6} textAnchor="middle" className="fill-foreground">{t}</text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Heavier lines are labelled · closely spaced lines are steep ground
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- hillshade */
/**
 * Relief shading from a height field, lit from the north-west.
 *
 * North-west is not a style choice: lit from the other side, the brain reads
 * every hill as a hollow — the classic relief inversion — so the light stays
 * up and to the left and the direction is stated.
 */
export function Hillshade({
  field, size = 300, cell = 1, exaggeration = 3, label,
}: {
  field: number[][]; size?: number; cell?: number; exaggeration?: number; label?: string;
}) {
  if (!field.length) return null;
  const rows = field.length, cols = field[0].length;
  const az = 315 * (Math.PI / 180), alt = 45 * (Math.PI / 180);
  const at = (r: number, c: number) => field[Math.max(0, Math.min(rows - 1, r))][Math.max(0, Math.min(cols - 1, c))];

  const shade = (r: number, c: number) => {
    const dzdx = ((at(r - 1, c + 1) + 2 * at(r, c + 1) + at(r + 1, c + 1)) -
      (at(r - 1, c - 1) + 2 * at(r, c - 1) + at(r + 1, c - 1))) / (8 * cell) * exaggeration;
    const dzdy = ((at(r + 1, c - 1) + 2 * at(r + 1, c) + at(r + 1, c + 1)) -
      (at(r - 1, c - 1) + 2 * at(r - 1, c) + at(r - 1, c + 1))) / (8 * cell) * exaggeration;
    const slope = Math.atan(Math.hypot(dzdx, dzdy));
    const aspect = Math.atan2(dzdy, -dzdx);
    const v = Math.cos(alt) * Math.sin(slope) * Math.cos(az - aspect) + Math.sin(alt) * Math.cos(slope);
    return Math.max(0, Math.min(1, v));
  };

  const cw = 100 / cols, chh = 100 / rows;
  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? "relief shading, lit from the north-west"}>
        {field.flatMap((row, r) => row.map((_, c) => (
          <rect key={`${r}-${c}`} x={c * cw} y={r * chh} width={cw + 0.2} height={chh + 0.2}
            fill={TONE} fillOpacity={0.9 - shade(r, c) * 0.85} />
        )))}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Lit from the north-west · lit from the other side every hill reads as a hollow
      </p>
    </div>
  );
}

/* ------------------------------------------------------ bathymetric profile */
/**
 * A cross-section of the sea floor, with the water column above it.
 *
 * Depth grows DOWNWARD from a zero at the surface — a profile drawn with
 * depth as a rising line reads as a mountain range, which is the opposite
 * of what it is.
 */
export function BathymetricProfile({
  points, height = 220, marks = [], label,
}: {
  /** depth positive-down, in metres */ points: { km: number; depth: number }[];
  height?: number; marks?: { km: number; label: string }[]; label?: string;
}) {
  if (points.length < 2) return null;
  const maxKm = Math.max(...points.map((p) => p.km));
  const maxD = Math.max(...points.map((p) => p.depth)) * 1.08;
  const x = (km: number) => (km / maxKm) * 100;
  const y = (d: number) => (d / maxD) * 100;
  const line = points.map((p) => `${x(p.km)},${y(p.depth)}`).join(" ");
  const deepest = points.reduce((a, b) => (b.depth > a.depth ? b : a));

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `deepest ${Math.round(deepest.depth)} m at ${deepest.km} km`}>
        <polygon points={`0,0 100,0 ${[...points].reverse().map((p) => `${x(p.km)},${y(p.depth)}`).join(" ")}`}
          fill={TONE} fillOpacity={0.08} />
        <polygon points={`${line} 100,100 0,100`} fill={TONE} fillOpacity={0.75} />
        <polyline points={line} fill="none" stroke={TONE} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
        <line x1={0} y1={0} x2={100} y2={0} stroke={TONE} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {marks.map((m) => (
          <line key={m.label} x1={x(m.km)} y1={0} x2={x(m.km)} y2={100}
            stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="relative mt-1 h-3">
        {marks.map((m) => (
          <span key={m.label} className="absolute -translate-x-1/2 text-[10px] text-muted-foreground"
            style={{ left: `${x(m.km)}%` }}>{m.label}</span>
        ))}
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        Sea level at the top, depth downward · deepest {Math.round(deepest.depth).toLocaleString()} m at {deepest.km} km
      </p>
    </div>
  );
}
