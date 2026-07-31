/** Meteorology: the diagrams forecasters actually read. */

const TONE = "var(--foreground)";

/* ------------------------------------------------------------------- skew-T */
/**
 * Temperature and dew point against pressure, with the SKEW that gives the
 * plot its name — isotherms run diagonally so the two traces separate.
 *
 * The gap between them is humidity, and where they touch is cloud base, which
 * is computed here rather than annotated.
 */
export function SkewT({
  levels, height = 300, label,
}: {
  /** ordered from the surface upward */ levels: { hPa: number; tempC: number; dewC: number }[];
  height?: number; label?: string;
}) {
  if (levels.length < 2) return null;
  const pLo = 1000, pHi = Math.min(...levels.map((l) => l.hPa));
  const tLo = -40, tHi = 40;
  // Pressure is logarithmic and inverted; temperature is skewed by height.
  const py = (p: number) => ((Math.log(pLo) - Math.log(p)) / (Math.log(pLo) - Math.log(pHi))) * 100;
  const px = (t: number, p: number) => ((t - tLo) / (tHi - tLo)) * 100 + py(p) * 0.42;

  const trace = (get: (l: { tempC: number; dewC: number }) => number) =>
    levels.map((l) => `${px(get(l), l.hPa)},${100 - py(l.hPa)}`).join(" ");

  // Cloud base: the first level where the spread closes to under 2 °C.
  const base = levels.find((l) => l.tempC - l.dewC < 2);
  const surface = levels[0];

  return (
    <div className="w-full">
      <svg viewBox="0 0 145 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `surface ${surface.tempC}°C, dew point ${surface.dewC}°C`}>
        {[-40, -20, 0, 20, 40].map((t) => (
          <line key={t} x1={px(t, pLo)} y1={100} x2={px(t, pHi)} y2={0}
            stroke={TONE} strokeWidth={1} strokeOpacity={t === 0 ? 0.4 : 0.16} vectorEffect="non-scaling-stroke" />
        ))}
        {[1000, 850, 700, 500, 300].filter((p) => p >= pHi).map((p) => (
          <line key={p} x1={0} y1={100 - py(p)} x2={145} y2={100 - py(p)}
            stroke={TONE} strokeWidth={1} strokeOpacity={0.18} vectorEffect="non-scaling-stroke" />
        ))}
        <polyline points={trace((l) => l.dewC)} fill="none" stroke={TONE} strokeWidth={2}
          strokeDasharray="5 3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <polyline points={trace((l) => l.tempC)} fill="none" stroke={TONE} strokeWidth={2.4}
          vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={2.4} /></svg>temperature
        </span>
        <span className="flex items-center gap-1">
          <svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={2} strokeDasharray="5 3" /></svg>dew point
        </span>
        <span>1000 hPa at the base, {pHi} hPa at the top</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Isotherms are skewed so the two traces separate · {base ? `they close at ${base.hPa} hPa — cloud base` : "they never close, so no cloud in this sounding"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ station model */
/**
 * The observation plotted the way a synoptic chart plots it: temperature upper
 * left, dew point lower left, pressure upper right, cloud cover as the fill of
 * the centre circle, and a wind barb whose feathers ARE the speed.
 */
export function StationModel({
  tempC, dewC, pressureHpa, cloudEighths, windFrom, windKt, size = 170, label,
}: {
  tempC: number; dewC: number; pressureHpa: number;
  /** oktas, 0-8 */ cloudEighths: number; windFrom: number; windKt: number;
  size?: number; label?: string;
}) {
  const rad = Math.PI / 180;
  // The shaft points TOWARDS the station from the direction the wind comes from.
  const a = (windFrom - 90) * rad;
  const cx = 50, cy = 50, R = 9, L = 30;
  const ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L;

  // Barbs: a pennant is 50 kt, a full feather 10, a half 5.
  const feathers: { at: number; kind: "pennant" | "full" | "half" }[] = [];
  let left = Math.round(windKt / 5) * 5, at = 0;
  while (left >= 50) { feathers.push({ at, kind: "pennant" }); at += 7; left -= 50; }
  while (left >= 10) { feathers.push({ at, kind: "full" }); at += 5; left -= 10; }
  if (left >= 5) feathers.push({ at: at === 0 ? 5 : at, kind: "half" });

  const along = (d: number) => ({ x: ex - Math.cos(a) * d, y: ey - Math.sin(a) * d });
  const perp = (p: { x: number; y: number }, len: number) => ({
    x: p.x + Math.cos(a - Math.PI / 2) * len, y: p.y + Math.sin(a - Math.PI / 2) * len,
  });
  // Pressure is reported as the last three digits, tenths implied.
  const coded = String(Math.round(pressureHpa * 10) % 1000).padStart(3, "0");

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${tempC}°C, ${windKt} kt from ${windFrom}°, ${cloudEighths} oktas`}>
        <defs>
          <clipPath id="sm-half"><rect x={cx - R} y={cy - R} width={R} height={R * 2} /></clipPath>
          <clipPath id="sm-quarter"><rect x={cx - R} y={cy - R} width={R} height={R} /></clipPath>
          <clipPath id="sm-three"><path d={`M ${cx - R} ${cy - R} h ${R * 2} v ${R} h ${-R} v ${R} h ${-R} Z`} /></clipPath>
        </defs>
        <circle cx={cx} cy={cy} r={R} fill="var(--background)" stroke={TONE} strokeWidth={1.4} />
        {cloudEighths >= 8 ? <circle cx={cx} cy={cy} r={R} fill={TONE} /> : null}
        {cloudEighths >= 6 && cloudEighths < 8 ? <circle cx={cx} cy={cy} r={R} fill={TONE} clipPath="url(#sm-three)" /> : null}
        {cloudEighths >= 4 && cloudEighths < 6 ? <circle cx={cx} cy={cy} r={R} fill={TONE} clipPath="url(#sm-half)" /> : null}
        {cloudEighths >= 2 && cloudEighths < 4 ? <circle cx={cx} cy={cy} r={R} fill={TONE} clipPath="url(#sm-quarter)" /> : null}
        {cloudEighths > 0 && cloudEighths < 8 ? <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke={TONE} strokeWidth={1.2} /> : null}
        {windKt >= 3 ? (
          <g>
            <line x1={cx + Math.cos(a) * R} y1={cy + Math.sin(a) * R} x2={ex} y2={ey} stroke={TONE} strokeWidth={1.6} />
            {feathers.map((f, i) => {
              const p = along(f.at);
              const q = perp(p, f.kind === "half" ? 4 : 8);
              if (f.kind === "pennant") {
                const p2 = along(f.at + 5);
                return <polygon key={i} points={`${p.x},${p.y} ${q.x},${q.y} ${p2.x},${p2.y}`} fill={TONE} />;
              }
              return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={TONE} strokeWidth={1.6} />;
            })}
          </g>
        ) : <circle cx={cx} cy={cy} r={R + 3.5} fill="none" stroke={TONE} strokeWidth={1} />}
        <text x={cx - R - 3} y={cy - 3} fontSize={8} textAnchor="end" fontWeight={600} className="fill-foreground">{Math.round(tempC)}</text>
        <text x={cx - R - 3} y={cy + 9} fontSize={8} textAnchor="end" className="fill-foreground">{Math.round(dewC)}</text>
        <text x={cx + R + 3} y={cy - 3} fontSize={8} className="fill-foreground">{coded}</text>
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {Math.round(tempC)}°C over {Math.round(dewC)}°C dew point · {pressureHpa.toFixed(1)} hPa coded {coded} ·
        {cloudEighths}/8 cloud · {windKt} kt from {windFrom}° · a pennant is 50 kt, a feather 10, a half 5
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- storm cone */
/**
 * A track forecast with its uncertainty cone.
 *
 * The cone is the ERROR in the centre's position, not the extent of the storm —
 * the single most misread graphic in public forecasting, so it says so.
 */
export function StormCone({
  track, size = 320, label,
}: {
  track: { x: number; y: number; hour: number; errorRadius: number; category?: string }[];
  size?: number; label?: string;
}) {
  if (track.length < 2) return null;
  // Cone outline: offset each side of the path by that point's error radius.
  const side = (sign: number) =>
    track.map((p, i) => {
      const prev = track[Math.max(0, i - 1)], next = track[Math.min(track.length - 1, i + 1)];
      const dx = next.x - prev.x, dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: p.x + (-dy / len) * p.errorRadius * sign, y: p.y + (dx / len) * p.errorRadius * sign };
    });
  const cone = [...side(1), ...side(-1).reverse()].map((p) => `${p.x},${p.y}`).join(" ");
  const last = track[track.length - 1];

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `forecast to ${last.hour} hours`}>
        <rect x={0} y={0} width={100} height={100} fill="var(--muted)" fillOpacity={0.3} />
        <polygon points={cone} fill={TONE} fillOpacity={0.12} stroke={TONE} strokeWidth={0.4} strokeDasharray="2 1.5" />
        <polyline points={track.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.4} />
        {track.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={2.4} fill={i === 0 ? TONE : "var(--background)"} stroke={TONE} strokeWidth={1.1} />
            <text x={p.x} y={p.y - 4} fontSize={3.2} textAnchor="middle" className="fill-muted-foreground">
              {p.hour ? `+${p.hour}h` : "now"}
            </text>
            {p.category ? (
              <text x={p.x} y={p.y + 6.5} fontSize={3} textAnchor="middle" fontWeight={600} className="fill-foreground">{p.category}</text>
            ) : null}
          </g>
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        The cone is where the CENTRE might be, not how big the storm is — effects reach well outside it ·
        forecast to +{last.hour} h
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- Beaufort scale */
/** The twelve forces, each with the sea state that defines it. */
export function BeaufortScale({
  observed, label,
}: {
  /** wind speed in knots */ observed?: number; label?: string;
}) {
  const FORCES = [
    { f: 0, kt: [0, 1], name: "Calm", sea: "mirror" },
    { f: 1, kt: [1, 3], name: "Light air", sea: "ripples" },
    { f: 2, kt: [4, 6], name: "Light breeze", sea: "small wavelets" },
    { f: 3, kt: [7, 10], name: "Gentle breeze", sea: "crests begin to break" },
    { f: 4, kt: [11, 16], name: "Moderate", sea: "frequent white horses" },
    { f: 5, kt: [17, 21], name: "Fresh", sea: "moderate waves" },
    { f: 6, kt: [22, 27], name: "Strong", sea: "large waves, spray" },
    { f: 7, kt: [28, 33], name: "Near gale", sea: "foam blown in streaks" },
    { f: 8, kt: [34, 40], name: "Gale", sea: "crests break into spindrift" },
    { f: 9, kt: [41, 47], name: "Severe gale", sea: "high waves, rolling sea" },
    { f: 10, kt: [48, 55], name: "Storm", sea: "sea surface white" },
    { f: 11, kt: [56, 63], name: "Violent storm", sea: "visibility reduced" },
    { f: 12, kt: [64, 80], name: "Hurricane", sea: "air filled with spray" },
  ];
  const now = observed == null ? null : FORCES.find((f) => observed >= f.kt[0] && observed <= f.kt[1]) ?? FORCES[FORCES.length - 1];

  return (
    <div className="w-full">
      <div className="space-y-[3px]">
        {FORCES.map((f) => {
          const on = now?.f === f.f;
          return (
            <div key={f.f} className="flex items-center gap-2">
              <span className="w-4 text-right text-[10px] font-semibold tabular-nums">{f.f}</span>
              <span className="h-3 rounded-[2px]" style={{
                width: `${(f.kt[1] / 80) * 46}%`,
                background: `color-mix(in oklch, ${TONE} ${Math.round(18 + (f.f / 12) * 78)}%, transparent)`,
              }} />
              <span className={`text-[10px] ${on ? "font-semibold" : "text-muted-foreground"}`}>
                {f.name} · {f.sea}
              </span>
              {on ? <span className="ml-auto rounded-[3px] px-1.5 text-[10px] font-semibold"
                style={{ background: TONE, color: "var(--background)" }}>{observed} kt</span> : null}
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Defined by what the SEA does, not by an anemometer — which is why it still works from a deck
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- degree days */
/**
 * Heating and cooling degree days against a base temperature.
 *
 * Both are computed from the daily means and the base, so the two totals are
 * always the ones the bars add up to.
 */
export function DegreeDays({
  days, base = 15.5, height = 220, label,
}: {
  days: { label: string; meanC: number }[]; base?: number; height?: number; label?: string;
}) {
  if (!days.length) return null;
  const hdd = days.map((d) => Math.max(0, base - d.meanC));
  const cdd = days.map((d) => Math.max(0, d.meanC - base));
  const max = Math.max(...hdd, ...cdd) || 1;
  const totalH = Math.round(hdd.reduce((s, v) => s + v, 0));
  const totalC = Math.round(cdd.reduce((s, v) => s + v, 0));

  return (
    <div className="w-full">
      <div className="relative flex items-center gap-1" style={{ height }}>
        {days.map((d, i) => (
          <div key={d.label} className="flex h-full flex-1 flex-col justify-center" title={`${d.label} · mean ${d.meanC}°C`}>
            <div className="flex flex-1 items-end">
              <span className="w-full" style={{ height: `${(hdd[i] / max) * 100}%`, background: TONE }} />
            </div>
            <div className="flex flex-1 items-start">
              <span className="w-full" style={{
                height: `${(cdd[i] / max) * 100}%`, background: TONE,
                backgroundImage: "repeating-linear-gradient(45deg, transparent 0 2px, var(--background) 2px 3px)",
              }} />
            </div>
          </div>
        ))}
        <div className="pointer-events-none absolute right-0 left-0 top-1/2 border-t border-foreground" />
      </div>
      <div className="flex gap-1">
        {days.map((d) => <span key={d.label} className="flex-1 text-center text-[9px] text-muted-foreground">{d.label}</span>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Base {base}°C · solid above the line is heating ({totalH} degree days), hatched below is cooling ({totalC})
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ drought monitor */
/** Share of an area in each drought class over time, stacked to 100%. */
export function DroughtMonitor({
  weeks, height = 220, label,
}: {
  /** each entry: fraction of area in D0..D4, plus none */
  weeks: { label: string; classes: number[] }[]; height?: number; label?: string;
}) {
  if (!weeks.length) return null;
  const NAMES = ["D0 abnormal", "D1 moderate", "D2 severe", "D3 extreme", "D4 exceptional"];
  const worst = weeks.reduce((a, w) => Math.max(a, w.classes[4] ?? 0), 0);
  const latest = weeks[weeks.length - 1];
  const anyNow = latest.classes.reduce((s, v) => s + v, 0);

  return (
    <div className="w-full">
      <div className="flex items-end" style={{ height }}>
        {weeks.map((w) => (
          <div key={w.label} className="flex h-full flex-1 flex-col justify-end" title={w.label}>
            {[...w.classes].map((v, ci) => (
              <span key={ci} style={{
                height: `${v * 100}%`,
                // Worst class darkest, and drawn at the BOTTOM so the severe
                // band sits under the milder ones the way the published one does.
                background: `color-mix(in oklch, ${TONE} ${Math.round(16 + ci * 21)}%, transparent)`,
                order: ci,
              }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{weeks[0].label}</span><span>{latest.label}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {NAMES.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: `color-mix(in oklch, ${TONE} ${Math.round(16 + i * 21)}%, transparent)` }} />{n}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        {Math.round(anyNow * 100)}% of the area in drought this week · worst exceptional coverage was {Math.round(worst * 100)}%
      </p>
    </div>
  );
}
