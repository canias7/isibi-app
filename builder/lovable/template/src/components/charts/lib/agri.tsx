/** Farming: rotations, soils, heat units and herds. */

const TONE = "var(--foreground)";

/* --------------------------------------------------------------- crop rotation */
/**
 * Which crop is in which field each year.
 *
 * A rotation's whole purpose is that a crop does not return to a field too
 * soon, so the shortest RETURN INTERVAL is computed and named — the failure it
 * guards against is invisible in the grid itself.
 */
export function CropRotation({
  fields, years, /** grid[field][year] */ grid, minInterval = 3, label,
}: {
  fields: string[]; years: (string | number)[]; grid: string[][]; minInterval?: number; label?: string;
}) {
  if (!fields.length) return null;
  const crops = [...new Set(grid.flat())];
  const tone = (c: string) => `color-mix(in oklch, ${TONE} ${Math.round(14 + (crops.indexOf(c) / Math.max(1, crops.length - 1)) * 78)}%, transparent)`;

  let worst: { field: string; crop: string; gap: number } | null = null;
  grid.forEach((row, fi) => {
    const last = new Map<string, number>();
    row.forEach((c, yi) => {
      if (last.has(c)) {
        const gap = yi - last.get(c)!;
        if (!worst || gap < worst.gap) worst = { field: fields[fi], crop: c, gap };
      }
      last.set(c, yi);
    });
  });
  const tight = worst as { field: string; crop: string; gap: number } | null;

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(${years.length}, minmax(52px, 1fr))` }}>
        <span />
        {years.map((y) => <span key={String(y)} className="pb-0.5 text-center text-[10px] font-semibold">{y}</span>)}
        {fields.map((f, fi) => (
          <div key={f} className="contents">
            <span className="self-center pr-1.5 text-[10px] font-semibold whitespace-nowrap">{f}</span>
            {years.map((y, yi) => {
              const c = grid[fi]?.[yi] ?? "";
              const k = crops.indexOf(c) / Math.max(1, crops.length - 1);
              return (
                <span key={String(y)} className="flex items-center justify-center px-1 py-1.5 text-[9px] leading-tight"
                  style={{ background: tone(c), color: k > 0.55 ? "var(--background)" : "var(--foreground)" }}>
                  {c}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {tight
          ? `Shortest return is ${tight.crop} back in ${tight.field} after ${tight.gap} year${tight.gap === 1 ? "" : "s"}${tight.gap < minInterval ? ` — under the ${minInterval}-year minimum` : ""}`
          : "No crop returns to any field in this window"}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- soil triangle */
/**
 * Sand, silt and clay on the standard texture triangle, with the CLASS derived
 * from the proportions rather than supplied — the class is the answer, and a
 * label that disagrees with its own point is the error worth preventing.
 */
export function SoilTriangle({
  samples, size = 320, label,
}: {
  samples: { name: string; sand: number; silt: number; clay: number }[]; size?: number; label?: string;
}) {
  if (!samples.length) return null;
  const classify = (s: number, si: number, c: number) => {
    if (c >= 40 && s <= 45 && si < 40) return "clay";
    if (c >= 27 && s <= 20) return "silty clay loam";
    if (c >= 35 && s >= 45) return "sandy clay";
    if (c >= 27) return "clay loam";
    if (si >= 80 && c < 12) return "silt";
    if (si >= 50) return "silt loam";
    if (s >= 85) return "sand";
    if (s >= 70) return "loamy sand";
    if (s >= 52) return "sandy loam";
    return "loam";
  };
  // Barycentric on the three vertices: clay at the apex (50,0), sand at the
  // bottom-left (0,100), silt at the bottom-right (100,100). The obvious
  // shorthand collapses to x = 100 - sand, which drops the clay term entirely
  // and puts every sample on the bottom edge.
  const at = (sand: number, clay: number) => {
    const silt = Math.max(0, 100 - sand - clay);
    const x = (clay * 50 + silt * 100) / 100;
    const y = (sand + silt);
    return { x: x * 0.84 + 8, y: y * 0.84 + 6 };
  };

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${samples.length} soil samples`}>
        <polygon points={`${at(100, 0).x},${at(100, 0).y} ${at(0, 0).x},${at(0, 0).y} ${at(0, 100).x},${at(0, 100).y}`}
          fill="var(--muted)" fillOpacity={0.35} stroke={TONE} strokeWidth={0.7} />
        {[20, 40, 60, 80].map((g) => (
          <g key={g} stroke={TONE} strokeWidth={0.25} strokeOpacity={0.3}>
            <line x1={at(100 - g, g).x} y1={at(100 - g, g).y} x2={at(0, g).x} y2={at(0, g).y} />
            <line x1={at(g, 0).x} y1={at(g, 0).y} x2={at(g, 100 - g).x} y2={at(g, 100 - g).y} />
            <line x1={at(0, g).x} y1={at(0, g).y} x2={at(100 - g, 0).x} y2={at(100 - g, 0).y} />
          </g>
        ))}
        {samples.map((s) => {
          const p = at(s.sand, s.clay);
          return (
            <g key={s.name}>
              <circle cx={p.x} cy={p.y} r={2.2} fill={TONE} />
              <text x={p.x + 3} y={p.y + 1} fontSize={3.2} className="fill-muted-foreground">{s.name}</text>
            </g>
          );
        })}
        <text x={at(0, 100).x} y={at(0, 100).y - 2.5} fontSize={3.6} textAnchor="middle" className="fill-foreground">clay</text>
        <text x={at(100, 0).x} y={at(100, 0).y + 5} fontSize={3.6} textAnchor="middle" className="fill-foreground">sand</text>
        <text x={at(0, 0).x} y={at(0, 0).y + 5} fontSize={3.6} textAnchor="middle" className="fill-foreground">silt</text>
      </svg>
      <div className="mt-1 space-y-0.5">
        {samples.map((s) => (
          <p key={s.name} className="text-[10px] text-muted-foreground">
            {s.name} · {s.sand}/{s.silt}/{s.clay} → <span className="text-foreground">{classify(s.sand, s.silt, s.clay)}</span>
          </p>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">Class derived from the proportions, not labelled by hand</p>
    </div>
  );
}

/* -------------------------------------------------------------- growing degree */
/**
 * Accumulated heat units against the crop's stage thresholds.
 *
 * Calendar dates do not predict a harvest; accumulated degree days do, and the
 * date each stage is REACHED is read off the accumulation.
 */
export function GrowingDegreeDays({
  days, base = 10, stages, height = 240, label,
}: {
  days: { date: string; tMin: number; tMax: number }[]; base?: number;
  stages: { name: string; gdd: number }[]; height?: number; label?: string;
}) {
  if (!days.length) return null;
  let acc = 0;
  const cum = days.map((d) => {
    acc += Math.max(0, (d.tMax + d.tMin) / 2 - base);
    return { ...d, acc };
  });
  const total = acc;
  const max = Math.max(total, ...stages.map((s) => s.gdd)) * 1.05;
  const reached = stages.map((s) => ({ ...s, on: cum.find((c) => c.acc >= s.gdd)?.date ?? null }));
  const x = (i: number) => (i / Math.max(1, cum.length - 1)) * 100;
  const y = (v: number) => 100 - (v / max) * 100;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${Math.round(total)} degree days accumulated`}>
        {stages.map((s) => (
          <line key={s.name} x1={0} y1={y(s.gdd)} x2={100} y2={y(s.gdd)}
            stroke={TONE} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.45} vectorEffect="non-scaling-stroke" />
        ))}
        <polygon points={`0,100 ${cum.map((c, i) => `${x(i)},${y(c.acc)}`).join(" ")} 100,100`} fill={TONE} fillOpacity={0.14} />
        <polyline points={cum.map((c, i) => `${x(i)},${y(c.acc)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{days[0].date}</span><span>base {base}°C</span><span>{days[days.length - 1].date}</span>
      </div>
      <div className="mt-1 space-y-0.5">
        {reached.map((s) => (
          <p key={s.name} className="text-[10px] text-muted-foreground">
            {s.name} at {s.gdd} GDD · {s.on ? `reached ${s.on}` : "not reached this season"}
          </p>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- yield map */
/** Yield across a field, with the low patches called out by area. */
export function YieldMap({
  /** grid[row][col] in t/ha */ grid, target, size = 320, label,
}: {
  grid: number[][]; target?: number; size?: number; label?: string;
}) {
  if (!grid.length) return null;
  const flat = grid.flat().filter((v) => v >= 0);
  const lo = Math.min(...flat), hi = Math.max(...flat);
  const mean = flat.reduce((a, b) => a + b, 0) / flat.length;
  const cut = target ?? mean * 0.8;
  const under = flat.filter((v) => v < cut).length;
  const rows = grid.length, cols = grid[0].length;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `mean ${mean.toFixed(1)} t/ha`}>
        {grid.flatMap((row, r) => row.map((v, c) => (
          <rect key={`${r}-${c}`} x={(c / cols) * 100} y={(r / rows) * 100}
            width={100 / cols + 0.3} height={100 / rows + 0.3}
            fill={TONE} fillOpacity={v < 0 ? 0 : 0.08 + ((v - lo) / (hi - lo || 1)) * 0.86} />
        )))}
        {grid.flatMap((row, r) => row.map((v, c) => (
          v >= 0 && v < cut ? (
            <rect key={`u${r}-${c}`} x={(c / cols) * 100 + 0.6} y={(r / rows) * 100 + 0.6}
              width={100 / cols - 1.2} height={100 / rows - 1.2}
              fill="none" stroke="var(--background)" strokeWidth={0.8} strokeDasharray="1.4 1.2" />
          ) : null
        )))}
      </svg>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{lo.toFixed(1)}</span>
        <span className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(to right, color-mix(in oklch, ${TONE} 8%, transparent), ${TONE})` }} />
        <span>{hi.toFixed(1)} t/ha</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Mean {mean.toFixed(1)} t/ha · {Math.round((under / flat.length) * 100)}% of the field below
        {target ? ` the ${target} t/ha target` : " 80% of the mean"}, marked with a dashed outline
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ irrigation window */
/**
 * Soil moisture between field capacity and the wilting point, with irrigation
 * events. The REFILL POINT is what decides when to water, and days below it
 * are counted.
 */
export function IrrigationSchedule({
  days, fieldCapacity, wiltingPoint, refillFraction = 0.5, height = 230, label,
}: {
  days: { date: string; moisture: number; irrigatedMm?: number }[];
  fieldCapacity: number; wiltingPoint: number; refillFraction?: number; height?: number; label?: string;
}) {
  if (!days.length) return null;
  const refill = wiltingPoint + (fieldCapacity - wiltingPoint) * refillFraction;
  const x = (i: number) => (i / Math.max(1, days.length - 1)) * 100;
  const y = (v: number) => 100 - ((v - wiltingPoint * 0.85) / (fieldCapacity * 1.1 - wiltingPoint * 0.85)) * 100;
  const stressed = days.filter((d) => d.moisture < refill).length;
  const applied = days.reduce((s, d) => s + (d.irrigatedMm ?? 0), 0);

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `${stressed} days below the refill point`}>
          <rect x={0} y={y(refill)} width={100} height={Math.max(0, y(wiltingPoint) - y(refill))} fill={TONE} fillOpacity={0.1} />
          <line x1={0} y1={y(fieldCapacity)} x2={100} y2={y(fieldCapacity)} stroke={TONE} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={y(refill)} x2={100} y2={y(refill)} stroke={TONE} strokeWidth={1.4} strokeDasharray="6 3" strokeOpacity={0.7} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={y(wiltingPoint)} x2={100} y2={y(wiltingPoint)} stroke={TONE} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          <polyline points={days.map((d, i) => `${x(i)},${y(d.moisture)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {days.map((d, i) => d.irrigatedMm ? (
          <span key={i} className="absolute bottom-0 w-1 -translate-x-1/2 rounded-t-[1px]"
            style={{ left: `${x(i)}%`, height: `${Math.min(40, d.irrigatedMm * 1.6)}%`, background: TONE }}
            title={`${d.date}: ${d.irrigatedMm} mm`} />
        ) : null)}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{days[0].date}</span><span>{days[days.length - 1].date}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Top dashed is field capacity, the heavier dashed is the refill point, solid is wilting ·
        {stressed} days in the stressed band · {applied} mm applied in {days.filter((d) => d.irrigatedMm).length} events
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- herd structure */
/**
 * Animals by age and class, with the REPLACEMENT RATE computed — a herd that
 * is not rearing enough young stock looks fine this year and shrinks the next.
 */
export function HerdStructure({
  groups, targetReplacementRate, label,
}: {
  groups: { name: string; ageFrom: number; ageTo: number; head: number; breeding?: boolean }[];
  targetReplacementRate?: number; label?: string;
}) {
  if (!groups.length) return null;
  const total = groups.reduce((s, g) => s + g.head, 0);
  const breeding = groups.filter((g) => g.breeding).reduce((s, g) => s + g.head, 0);
  const young = groups.filter((g) => !g.breeding && g.ageTo <= 24).reduce((s, g) => s + g.head, 0);
  const rate = breeding ? young / breeding : 0;
  const max = Math.max(...groups.map((g) => g.head));

  return (
    <div className="w-full">
      <div className="space-y-1">
        {[...groups].sort((a, b) => a.ageFrom - b.ageFrom).map((g) => (
          <div key={g.name} className="flex items-center gap-2">
            <span className="w-[30%] shrink-0 truncate text-[10px]">
              {g.name} <span className="text-muted-foreground">{g.ageFrom}–{g.ageTo}m</span>
            </span>
            <span className="h-3.5 rounded-[2px]" style={{
              width: `${(g.head / max) * 52}%`,
              background: g.breeding ? TONE : "var(--background)",
              border: g.breeding ? undefined : `2px solid ${TONE}`,
            }} />
            <span className="text-[10px] tabular-nums text-muted-foreground">{g.head}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Solid is breeding stock, outlined is young stock coming through · {total} head ·
        replacement rate {Math.round(rate * 100)}%
        {targetReplacementRate != null
          ? rate < targetReplacementRate
            ? ` — below the ${Math.round(targetReplacementRate * 100)}% needed to hold the herd`
            : ` — at or above the ${Math.round(targetReplacementRate * 100)}% needed`
          : ""}
      </p>
    </div>
  );
}
