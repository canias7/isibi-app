/** Uncertainty, risk communication and decision charts. */

const TONE = "var(--foreground)";

/* ------------------------------------------------------- quantile dot plot */
/**
 * A distribution as a countable number of dots.
 *
 * The point is that people reason far better about "7 of these 20 outcomes"
 * than about a shaded interval. Each dot is one equally-likely outcome, so
 * the answer is arrived at by counting rather than by estimating an area.
 */
export function QuantileDotPlot({
  quantiles, dots = 20, threshold, height = 200, format = (n: number) => String(Math.round(n)), label,
}: {
  /** Sorted sample or quantile values. */ quantiles: number[];
  dots?: number; threshold?: number; height?: number;
  format?: (n: number) => string; label?: string;
}) {
  if (!quantiles.length) return null;
  const s = [...quantiles].sort((a, b) => a - b);
  const picks = Array.from({ length: dots }, (_, i) => s[Math.floor(((i + 0.5) / dots) * s.length)]);
  const lo = picks[0], hi = picks[picks.length - 1];
  const cols = dots;
  const stacks = new Map<number, number>();
  const placed = picks.map((v) => {
    const col = Math.round(((v - lo) / (hi - lo || 1)) * (cols - 1));
    const k = stacks.get(col) ?? 0;
    stacks.set(col, k + 1);
    return { col, k, v };
  });
  const tallest = Math.max(...stacks.values());
  const d = Math.min(height / tallest, 100 / cols * 2.4);
  const below = threshold !== undefined ? picks.filter((v) => v <= threshold).length : 0;

  return (
    <div className="w-full" role="img"
      aria-label={label ?? (threshold !== undefined ? `${below} of ${dots} outcomes at or below ${format(threshold)}` : `${dots} equally likely outcomes`)}>
      <div className="relative" style={{ height }}>
        {threshold !== undefined ? (
          <div className="absolute top-0 bottom-0 border-l border-dashed border-foreground"
            style={{ left: `${((threshold - lo) / (hi - lo || 1)) * 100}%` }} />
        ) : null}
        {placed.map((p, i) => (
          <span key={i} className="absolute rounded-full"
            style={{
              left: `${(p.col / (cols - 1)) * 96 + 2}%`, bottom: p.k * d,
              width: d * 0.78, height: d * 0.78, marginLeft: -(d * 0.39),
              background: TONE, opacity: threshold !== undefined && p.v <= threshold ? 0.35 : 0.85,
            }} />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Each dot is one of {dots} equally likely outcomes
        {threshold !== undefined ? ` · ${below} fall at or below ${format(threshold)}` : ""}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- icon array */
/** N of 100 figures filled. The standard way to state a risk honestly. */
export function IconArray({
  affected, total = 100, columns = 10, size = 15, glyph = "●", label,
}: {
  affected: number; total?: number; columns?: number; size?: number; glyph?: string; label?: string;
}) {
  return (
    <div className="w-full" role="img" aria-label={label ?? `${affected} in ${total}`}>
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, ${size}px)` }}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className="text-center leading-none"
            style={{ fontSize: size, color: TONE, opacity: i < affected ? 1 : 0.16 }}>{glyph}</span>
        ))}
      </div>
      <p className="mt-3 text-[11px]">
        <span className="font-medium">{affected} in {total}</span>
        <span className="text-muted-foreground"> — {Math.round((affected / total) * 100)}%</span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------- survival + band */
/** A survival curve with its confidence band. */
export function SurvivalBand({
  points, height = 220, xLabel = "Months", label,
}: {
  points: { t: number; surviving: number; low: number; high: number }[];
  height?: number; xLabel?: string; label?: string;
}) {
  if (!points.length) return null;
  const tMax = Math.max(...points.map((p) => p.t)) || 1;
  const X = (t: number) => (t / tMax) * 100;
  const Y = (s: number) => 100 - s * 96 - 2;
  const stepPath = (key: "surviving" | "low" | "high") => {
    const d: string[] = [];
    points.forEach((p, i) => {
      if (i === 0) d.push(`${X(p.t)},${Y(p[key])}`);
      else { d.push(`${X(p.t)},${Y(points[i - 1][key])}`); d.push(`${X(p.t)},${Y(p[key])}`); }
    });
    return d;
  };

  return (
    <div className="w-full" role="img" aria-label={label ?? "Survival with confidence band"}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={[...stepPath("high"), ...stepPath("low").reverse()].join(" ")} fill={TONE} fillOpacity={0.12} />
          <polyline points={stepPath("surviving").join(" ")} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0 {xLabel.toLowerCase()}</span><span>shaded is the 95% band</span><span>{tMax}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------- cumulative incidence */
/**
 * Competing outcomes stacked, each rising to its own final share.
 *
 * The complement of a survival curve, and the honest one when people can
 * leave for more than one reason: plotting each separately lets the shares
 * sum past 100%.
 */
export function CumulativeIncidence({
  outcomes, periods, height = 220, label,
}: {
  outcomes: { label: string; values: number[] }[]; periods: string[]; height?: number; label?: string;
}) {
  if (!outcomes.length) return null;
  const n = periods.length;
  const X = (i: number) => (i / (n - 1 || 1)) * 100;
  let base = Array(n).fill(0) as number[];
  const bands = outcomes.map((o, oi) => {
    const top = base.map((b, i) => b + o.values[i]);
    const poly = [...top.map((v, i) => `${X(i)},${100 - v * 96 - 2}`), ...base.map((v, i) => `${X(i)},${100 - v * 96 - 2}`).reverse()].join(" ");
    base = top;
    return { label: o.label, poly, tone: `color-mix(in oklch, var(--foreground) ${Math.round(84 - (oi / Math.max(1, outcomes.length - 1)) * 62)}%, transparent)` };
  });

  return (
    <div className="w-full" role="img" aria-label={label ?? `${outcomes.length} competing outcomes`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {bands.map((b) => <polygon key={b.label} points={b.poly} fill={b.tone} />)}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {bands.map((b) => (
          <span key={b.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: b.tone }} />{b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- subgroup forest */
/** A forest plot grouped into sections, with an overall estimate. */
export function SubgroupForest({
  groups, overall, centre = 1, rowHeight = 26, format = (n: number) => n.toFixed(2), label,
}: {
  groups: { label: string; rows: { label: string; estimate: number; low: number; high: number }[] }[];
  overall?: { estimate: number; low: number; high: number };
  centre?: number; rowHeight?: number; format?: (n: number) => string; label?: string;
}) {
  const all = groups.flatMap((g) => g.rows);
  if (!all.length) return null;
  const lo = Math.min(centre, ...all.map((r) => r.low), overall?.low ?? centre);
  const hi = Math.max(centre, ...all.map((r) => r.high), overall?.high ?? centre);
  const pad = (hi - lo) * 0.08 || 1;
  const X = (v: number) => ((v - lo + pad) / (hi - lo + pad * 2)) * 100;

  const line = (r: { label: string; estimate: number; low: number; high: number }, diamond = false) => (
    <div className="flex items-center gap-2" style={{ height: rowHeight }}>
      <span className="w-24 shrink-0 truncate text-right text-[10px] text-muted-foreground">{r.label}</span>
      <div className="relative h-full flex-1">
        <div className="absolute top-0 bottom-0 border-l border-dashed border-border" style={{ left: `${X(centre)}%` }} />
        <div className="absolute top-1/2 h-px" style={{ left: `${X(r.low)}%`, width: `${X(r.high) - X(r.low)}%`, background: TONE }} />
        {diamond ? (
          <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45" style={{ left: `${X(r.estimate)}%`, background: TONE }} />
        ) : (
          <span className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-[1px]" style={{ left: `${X(r.estimate)}%`, background: TONE }} />
        )}
      </div>
      <span className="w-24 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
        {format(r.estimate)} ({format(r.low)}–{format(r.high)})
      </span>
    </div>
  );

  return (
    <div className="w-full" role="img" aria-label={label ?? `${all.length} subgroups`}>
      {groups.map((g) => (
        <div key={g.label}>
          <div className="pt-1 pb-0.5 text-[10px] font-medium">{g.label}</div>
          {g.rows.map((r) => <div key={r.label}>{line(r)}</div>)}
        </div>
      ))}
      {overall ? (
        <div className="mt-1 border-t border-border pt-1">{line({ label: "Overall", ...overall }, true)}</div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------- decision curve */
/**
 * Net benefit against the threshold probability you would act at.
 *
 * The two reference strategies are always drawn: treat everybody, and treat
 * nobody. A model is only worth using where it sits above both, and without
 * them the curve looks useful everywhere.
 */
export function DecisionCurve({
  model, prevalence, height = 220, label,
}: {
  model: { threshold: number; netBenefit: number }[]; prevalence: number;
  height?: number; label?: string;
}) {
  if (!model.length) return null;
  const all = model.map((m) => m.netBenefit);
  const hi = Math.max(...all, prevalence);
  const lo = Math.min(...all, 0);
  const X = (t: number) => t * 100;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 94 - 3;
  const treatAll = model.map((m) => ({ t: m.threshold, v: prevalence - (1 - prevalence) * (m.threshold / (1 - m.threshold || 1e-6)) }));

  return (
    <div className="w-full" role="img" aria-label={label ?? "Net benefit against threshold"}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} x2={100} y1={Y(0)} y2={Y(0)} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
          <polyline points={treatAll.map((p) => `${X(p.t)},${Y(Math.max(lo, p.v))}`).join(" ")}
            fill="none" stroke={TONE} strokeOpacity={0.4} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          <polyline points={model.map((m) => `${X(m.threshold)},${Y(m.netBenefit)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Solid is the model · dashed is act on everyone · the flat line is act on nobody
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- uplift curve */
/** Incremental effect from targeting the top slice, against random. */
export function UpliftCurve({
  points, height = 220, label,
}: {
  points: { population: number; uplift: number }[]; height?: number; label?: string;
}) {
  if (!points.length) return null;
  const hi = Math.max(...points.map((p) => p.uplift));
  const lo = Math.min(0, ...points.map((p) => p.uplift));
  const best = points.reduce((a, b) => (a.uplift >= b.uplift ? a : b));
  const X = (p: number) => p * 100;
  const Y = (v: number) => 100 - ((v - lo) / (hi - lo || 1)) * 94 - 3;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Best at the top ${Math.round(best.population * 100)}%`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} y1={Y(0)} x2={100} y2={Y(points[points.length - 1].uplift)} stroke="var(--border)" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          <polyline points={points.map((p) => `${X(p.population)},${Y(p.uplift)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="absolute top-0 bottom-0 border-l border-dashed border-foreground" style={{ left: `${X(best.population)}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Peaks at the top {Math.round(best.population * 100)}% — targeting more than that gives it back
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- power curve */
/** Power against sample size, with the size needed for the target marked. */
export function PowerCurve({
  points, target = 0.8, height = 220, label,
}: {
  points: { n: number; power: number }[]; target?: number; height?: number; label?: string;
}) {
  if (!points.length) return null;
  const nLo = points[0].n, nHi = points[points.length - 1].n;
  const X = (n: number) => ((n - nLo) / (nHi - nLo || 1)) * 100;
  const Y = (p: number) => 100 - p * 94 - 3;
  const hit = points.find((p) => p.power >= target);

  return (
    <div className="w-full" role="img" aria-label={label ?? (hit ? `${hit.n} per arm for ${Math.round(target * 100)}% power` : "Target power not reached")}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <line x1={0} x2={100} y1={Y(target)} y2={Y(target)} stroke="var(--border)" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          <polyline points={points.map((p) => `${X(p.n)},${Y(p.power)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {hit ? <div className="absolute top-0 bottom-0 border-l border-foreground" style={{ left: `${X(hit.n)}%` }} /> : null}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {hit ? `${hit.n} per group reaches ${Math.round(target * 100)}% power` : `Never reaches ${Math.round(target * 100)}%`}
      </p>
    </div>
  );
}
