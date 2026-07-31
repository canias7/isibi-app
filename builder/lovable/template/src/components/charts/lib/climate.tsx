/** Climate: budgets, wedges, stripes and the things that are actually melting. */

const TONE = "var(--foreground)";

/* ------------------------------------------------------------------ carbon budget */
/**
 * A remaining budget against current emissions, with the YEARS LEFT computed.
 *
 * A budget in gigatonnes means nothing to most people; the same number divided
 * by the current rate is a date, and that is what it is for.
 */
export function CarbonBudget({
  budgetGt, annualGt, scenarios = [], height = 220, label,
}: {
  budgetGt: number; annualGt: number;
  scenarios?: { name: string; annualGt: number }[]; height?: number; label?: string;
}) {
  const rows = [{ name: "Current rate", annualGt }, ...scenarios]
    .map((s) => ({ ...s, years: s.annualGt > 0 ? budgetGt / s.annualGt : Infinity }))
    .sort((a, b) => a.years - b.years);
  const maxYears = Math.max(...rows.filter((r) => Number.isFinite(r.years)).map((r) => r.years), 1);

  return (
    <div className="w-full" style={{ minHeight: height }}>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-medium">{r.name}</span>
              <span className="text-[9px] tabular-nums text-muted-foreground">
                {r.annualGt} Gt a year · {Number.isFinite(r.years) ? `${r.years.toFixed(1)} years` : "never spent"}
              </span>
            </div>
            <div className="mt-0.5 h-4 rounded-[2px]" style={{ background: "var(--muted)" }}>
              <div className="h-full rounded-[2px]" style={{
                width: `${Math.min(100, (r.years / maxYears) * 100)}%`,
                background: TONE, opacity: r.name === "Current rate" ? 1 : 0.45,
              }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {budgetGt} Gt remaining · at today's {annualGt} Gt a year that is {(budgetGt / annualGt).toFixed(1)} years,
        which is the number a tonnage hides
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- stabilisation wedges */
/**
 * Emissions under business-as-usual, and the wedges that close the gap.
 *
 * The point of a wedge diagram is that nothing closes it alone — so the
 * SHORTFALL after every wedge is computed and stated.
 */
export function EmissionsWedge({
  years, businessAsUsual, target, wedges, height = 260, label,
}: {
  years: (string | number)[]; businessAsUsual: number[]; target: number[];
  wedges: { name: string; cut: number[] }[]; height?: number; label?: string;
}) {
  if (!years.length) return null;
  const max = Math.max(...businessAsUsual) * 1.05;
  const x = (i: number) => (i / Math.max(1, years.length - 1)) * 100;
  const y = (v: number) => 100 - (v / max) * 100;
  const lastIdx = years.length - 1;
  const totalCut = wedges.reduce((s, w) => s + (w.cut[lastIdx] ?? 0), 0);
  const gap = businessAsUsual[lastIdx] - target[lastIdx];
  const shortfall = gap - totalCut;

  // Wedges stack down from business-as-usual.
  let stack = businessAsUsual.slice();
  const bands = wedges.map((w) => {
    const top = stack.slice();
    stack = stack.map((v, i) => v - (w.cut[i] ?? 0));
    return { name: w.name, top, bottom: stack.slice() };
  });

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${wedges.length} wedges`}>
        {bands.map((b, i) => (
          <polygon key={b.name}
            points={`${b.top.map((v, j) => `${x(j)},${y(v)}`).join(" ")} ${[...b.bottom].reverse().map((v, j) => `${x(lastIdx - j)},${y(v)}`).join(" ")}`}
            fill={TONE} fillOpacity={0.16 + i * 0.13} stroke="var(--background)" strokeWidth={0.4} />
        ))}
        <polyline points={businessAsUsual.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <polyline points={target.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{years[0]}</span><span>{years[lastIdx]}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {wedges.map((w, i) => (
          <span key={w.name} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: TONE, opacity: 0.16 + i * 0.13 }} />
            {w.name} {w.cut[lastIdx]} Gt
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Gap to close by {years[lastIdx]} is {gap.toFixed(1)} Gt · these wedges deliver {totalCut.toFixed(1)} ·
        {shortfall > 0.05 ? ` still ${shortfall.toFixed(1)} Gt short` : " that closes it"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ warming stripes */
/**
 * A year per stripe, shaded by anomaly against a baseline.
 *
 * In monochrome the ordering has to survive without a red/blue split, so the
 * sign is carried by stripe HEIGHT — full above the baseline, half below — and
 * the magnitude by fill.
 */
export function WarmingStripes({
  years, baselineFrom, baselineTo, height = 130, label,
}: {
  years: { year: number; anomaly: number }[]; baselineFrom?: number; baselineTo?: number;
  height?: number; label?: string;
}) {
  if (!years.length) return null;
  const max = Math.max(...years.map((y) => Math.abs(y.anomaly)));
  const first = years[0], last = years[years.length - 1];
  const decade = (from: number) => {
    const d = years.filter((y) => y.year >= from && y.year < from + 10);
    return d.length ? d.reduce((s, y) => s + y.anomaly, 0) / d.length : 0;
  };
  const early = decade(first.year), recent = decade(last.year - 9);

  return (
    <div className="w-full">
      <div className="flex items-stretch overflow-hidden rounded-[2px]" style={{ height }}>
        {years.map((y) => (
          <span key={y.year} className="flex-1" title={`${y.year}: ${y.anomaly >= 0 ? "+" : ""}${y.anomaly.toFixed(2)}°C`}
            style={{
              // Sign is carried by HEIGHT, magnitude by fill. Hatching was the
              // first attempt and at 125 stripes each one is about four pixels
              // wide, so any hatch fine enough to read filled the stripe solid
              // and the cool half came out darker than the warm half.
              background: `color-mix(in oklch, ${TONE} ${Math.round((Math.abs(y.anomaly) / max) * 94)}%, transparent)`,
              alignSelf: y.anomaly >= 0 ? "stretch" : "flex-end",
              height: y.anomaly >= 0 ? "100%" : "45%",
            }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{first.year}</span><span>{last.year}</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Full-height above the {baselineFrom ?? "baseline"}{baselineTo ? `–${baselineTo}` : ""} average, half-height below ·
        first decade {early >= 0 ? "+" : ""}{early.toFixed(2)}°C against last decade {recent >= 0 ? "+" : ""}{recent.toFixed(2)}°C
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- sea level */
/**
 * Sea level with the CONTRIBUTIONS stacked, because the total alone cannot be
 * argued with or acted on — thermal expansion and ice loss have different
 * timescales and different levers.
 */
export function SeaLevel({
  years, contributions, height = 240, label,
}: {
  years: (string | number)[]; contributions: { name: string; mm: number[] }[]; height?: number; label?: string;
}) {
  if (!contributions.length) return null;
  const totals = years.map((_, i) => contributions.reduce((s, c) => s + (c.mm[i] ?? 0), 0));
  const max = Math.max(...totals) * 1.06;
  const lastIdx = years.length - 1;
  const rate = (totals[lastIdx] - totals[0]) / Math.max(1, lastIdx);
  const biggest = contributions.reduce((a, b) => ((b.mm[lastIdx] ?? 0) > (a.mm[lastIdx] ?? 0) ? b : a));

  return (
    <div className="w-full">
      <div className="flex items-end" style={{ height }}>
        {years.map((y, i) => (
          <div key={String(y)} className="flex h-full flex-1 flex-col justify-end" title={String(y)}>
            {contributions.map((c, ci) => (
              <span key={c.name} style={{
                height: `${((c.mm[i] ?? 0) / max) * 100}%`,
                background: `color-mix(in oklch, ${TONE} ${Math.round(92 - (ci / Math.max(1, contributions.length - 1)) * 66)}%, transparent)`,
              }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{years[0]}</span><span>{years[lastIdx]}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        {contributions.map((c, i) => (
          <span key={c.name} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: `color-mix(in oklch, ${TONE} ${Math.round(92 - (i / Math.max(1, contributions.length - 1)) * 66)}%, transparent)` }} />{c.name}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        {totals[lastIdx].toFixed(0)} mm total, rising {rate.toFixed(1)} mm a year ·
        {biggest.name} is the largest single contribution at {(biggest.mm[lastIdx] ?? 0).toFixed(0)} mm
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- ice extent */
/**
 * Seasonal ice extent by year, with the annual MINIMUM tracked separately.
 *
 * The minimum is the number that matters and it moves independently of the
 * average, which a single yearly figure conflates.
 */
export function IceExtent({
  years, height = 250, label,
}: {
  years: { year: number; monthly: number[] }[]; height?: number; label?: string;
}) {
  if (!years.length) return null;
  const all = years.flatMap((y) => y.monthly);
  const max = Math.max(...all) * 1.04, min = Math.min(...all) * 0.9;
  const x = (m: number) => (m / 11) * 100;
  const y = (v: number) => 100 - ((v - min) / (max - min)) * 100;
  const minima = years.map((yr) => ({ year: yr.year, v: Math.min(...yr.monthly) }));
  const trend = (minima[minima.length - 1].v - minima[0].v) / Math.max(1, minima.length - 1);

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
          {years.map((yr, i) => (
            <polyline key={yr.year} points={yr.monthly.map((v, m) => `${x(m)},${y(v)}`).join(" ")}
              fill="none" stroke={TONE} strokeWidth={i === years.length - 1 ? 2.4 : 1.2}
              strokeOpacity={i === years.length - 1 ? 1 : 0.25 + (i / years.length) * 0.3} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {minima.map((m, i) => {
          const yr = years[i];
          const mi = yr.monthly.indexOf(m.v);
          return (
            <span key={m.year} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${x(mi)}%`, top: `${y(m.v)}%`, background: TONE, opacity: 0.4 + (i / years.length) * 0.6 }}
              title={`${m.year} minimum ${m.v}`} />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>Jan</span><span>Jun</span><span>Dec</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Heaviest line is {years[years.length - 1].year}, dots are each year's minimum ·
        the minimum has moved {trend >= 0 ? "+" : ""}{(trend * (years.length - 1)).toFixed(2)} over
        {" "}{years.length} years, which the annual average does not show
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ emissions intensity */
/**
 * Emissions per unit of output against absolute emissions.
 *
 * Intensity can fall while the total rises, and it usually does — which is the
 * single most common misreading of climate progress, so both are drawn.
 */
export function EmissionsIntensity({
  years, absolute, output, height = 250, label,
}: {
  years: (string | number)[]; absolute: number[]; output: number[]; height?: number; label?: string;
}) {
  if (!years.length) return null;
  const intensity = absolute.map((a, i) => a / (output[i] || 1));
  const maxA = Math.max(...absolute) * 1.06, maxI = Math.max(...intensity) * 1.1;
  const x = (i: number) => (i / Math.max(1, years.length - 1)) * 100;
  const last = years.length - 1;
  const absChange = (absolute[last] - absolute[0]) / absolute[0];
  const intChange = (intensity[last] - intensity[0]) / intensity[0];

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {absolute.map((a, i) => (
            <div key={i} className="flex-1" style={{ height: `${(a / maxA) * 100}%`, background: TONE, opacity: 0.2 }} />
          ))}
        </div>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none" className="absolute inset-0">
          <polyline points={intensity.map((v, i) => `${x(i)},${100 - (v / maxI) * 100}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{years[0]}</span><span>{years[last]}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground" aria-label={label}>
        Bars are absolute emissions, the line is per unit of output ·
        intensity {intChange >= 0 ? "up" : "down"} {Math.abs(Math.round(intChange * 100))}% while the total is
        {" "}{absChange >= 0 ? "UP" : "down"} {Math.abs(Math.round(absChange * 100))}%
        {intChange < 0 && absChange > 0 ? " — which is the misreading this chart exists to prevent" : ""}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- degree of warming */
/**
 * Projected warming under scenarios, with the uncertainty band per pathway.
 *
 * The bands OVERLAP for decades — which is the honest read, and a chart of
 * central lines alone implies a precision nobody has.
 */
export function WarmingPathways({
  years, pathways, height = 260, label,
}: {
  years: (string | number)[];
  pathways: { name: string; central: number[]; low: number[]; high: number[] }[];
  height?: number; label?: string;
}) {
  if (!pathways.length) return null;
  const all = pathways.flatMap((p) => [...p.high, ...p.low]);
  const max = Math.max(...all) * 1.06, min = Math.min(0, ...all);
  const x = (i: number) => (i / Math.max(1, years.length - 1)) * 100;
  const y = (v: number) => 100 - ((v - min) / (max - min)) * 100;
  const last = years.length - 1;
  // Where the bands stop overlapping is where the scenarios become
  // distinguishable at all.
  let separates = -1;
  for (let i = 0; i <= last; i++) {
    const lows = pathways.map((p) => p.low[i]), highs = pathways.map((p) => p.high[i]);
    if (Math.min(...highs) < Math.max(...lows)) { separates = i; break; }
  }

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${pathways.length} pathways`}>
        {pathways.map((p, i) => (
          <polygon key={p.name}
            points={`${p.high.map((v, j) => `${x(j)},${y(v)}`).join(" ")} ${[...p.low].reverse().map((v, j) => `${x(last - j)},${y(v)}`).join(" ")}`}
            fill={TONE} fillOpacity={0.1 + i * 0.06} />
        ))}
        {pathways.map((p, i) => (
          <polyline key={`c${p.name}`} points={p.central.map((v, j) => `${x(j)},${y(v)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2}
            strokeDasharray={["", "5 3", "2 2", "7 2 2 2"][i % 4] || undefined} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{years[0]}</span><span>{years[last]}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        {pathways.map((p, i) => (
          <span key={p.name} className="flex items-center gap-1">
            <svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={2} strokeDasharray={["", "5 3", "2 2", "7 2 2 2"][i % 4] || undefined} /></svg>
            {p.name} {p.central[last].toFixed(1)}°C
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Shaded bands are the ranges, not error bars on a known number ·
        {separates >= 0 ? ` the pathways only separate from ${years[separates]}` : " the pathways never fully separate in this window"}
      </p>
    </div>
  );
}
