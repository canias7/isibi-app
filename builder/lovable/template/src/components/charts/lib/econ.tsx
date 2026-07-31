/** Macroeconomics: the named curves, and the diagrams demographers use. */

const TONE = "var(--foreground)";

/* ------------------------------------------------------------ Phillips curve */
/**
 * Unemployment against inflation, with the years JOINED in order.
 *
 * The scatter alone suggests a stable trade-off; the path is what shows the
 * curve shifting, which is the whole reason the relationship broke down.
 */
export function PhillipsCurve({
  points, height = 250, label,
}: {
  points: { year: number; unemployment: number; inflation: number }[]; height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.unemployment), ys = points.map((p) => p.inflation);
  const x0 = Math.min(...xs) * 0.9, x1 = Math.max(...xs) * 1.05;
  const y0 = Math.min(0, ...ys), y1 = Math.max(...ys) * 1.08;
  const px = (v: number) => ((v - x0) / (x1 - x0)) * 100;
  const py = (v: number) => 100 - ((v - y0) / (y1 - y0)) * 100;
  const first = points[0], last = points[points.length - 1];

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `${first.year} to ${last.year}`}>
          <polyline points={points.map((p) => `${px(p.unemployment)},${py(p.inflation)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.2} strokeOpacity={0.45} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={py(0)} x2={100} y2={py(0)} stroke={TONE} strokeWidth={1} strokeOpacity={0.35} vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((p) => (
          <span key={p.year} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${px(p.unemployment)}%`, top: `${py(p.inflation)}%`, background: TONE }}
            title={`${p.year}: ${p.unemployment}% / ${p.inflation}%`} />
        ))}
        {[first, last].map((p) => (
          <span key={`l${p.year}`} className="absolute text-[10px] font-medium"
            style={{ left: `${Math.min(88, px(p.unemployment) + 2)}%`, top: `${py(p.inflation)}%`, transform: "translateY(-140%)" }}>{p.year}</span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{x0.toFixed(1)}% unemployment</span><span>{x1.toFixed(1)}%</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Joined in year order · the loop is the curve shifting, which a scatter hides
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- Beveridge curve */
/** Vacancies against unemployment — outward movement is worsening matching. */
export function BeveridgeCurve({
  points, height = 240, label,
}: {
  points: { period: string; unemployment: number; vacancies: number }[]; height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const x1 = Math.max(...points.map((p) => p.unemployment)) * 1.1;
  const y1 = Math.max(...points.map((p) => p.vacancies)) * 1.1;
  const px = (v: number) => (v / x1) * 100;
  const py = (v: number) => 100 - (v / y1) * 100;
  // Distance from the origin is the standard read on matching efficiency.
  const dist = (p: { unemployment: number; vacancies: number }) => Math.hypot(p.unemployment / x1, p.vacancies / y1);
  const moved = dist(points[points.length - 1]) - dist(points[0]);

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
          <polyline points={points.map((p) => `${px(p.unemployment)},${py(p.vacancies)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.2} strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((p, i) => (
          <span key={p.period} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${px(p.unemployment)}%`, top: `${py(p.vacancies)}%`,
              width: i === points.length - 1 ? 10 : 7, height: i === points.length - 1 ? 10 : 7,
              background: i === points.length - 1 ? TONE : "var(--background)",
              border: `1.5px solid ${TONE}`,
            }} title={`${p.period}`} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{points[0].period}</span><span>unemployment →</span><span>{points[points.length - 1].period}</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Filled dot is the latest · the curve has moved {moved > 0 ? "OUTWARD" : "inward"}, meaning matching got
        {moved > 0 ? " worse" : " better"} for the same slack
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- Laffer curve */
/**
 * Revenue against the tax rate, with the peak COMPUTED from the supplied
 * curve — the point of contention is where it is, so it must never be a prop.
 */
export function LafferCurve({
  points, currentRate, height = 230, label,
}: {
  points: { rate: number; revenue: number }[]; currentRate?: number; height?: number; label?: string;
}) {
  if (points.length < 3) return null;
  const maxRev = Math.max(...points.map((p) => p.revenue)) * 1.08;
  const peak = points.reduce((a, b) => (b.revenue > a.revenue ? b : a));
  const x = (r: number) => r * 100;
  const y = (v: number) => 100 - (v / maxRev) * 100;
  const now = currentRate == null ? null : points.reduce((a, b) => (Math.abs(b.rate - currentRate) < Math.abs(a.rate - currentRate) ? b : a));

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `peak at ${Math.round(peak.rate * 100)}%`}>
          <polygon points={`0,100 ${points.map((p) => `${x(p.rate)},${y(p.revenue)}`).join(" ")} 100,100`} fill={TONE} fillOpacity={0.12} />
          <polyline points={points.map((p) => `${x(p.rate)},${y(p.revenue)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <line x1={x(peak.rate)} y1={0} x2={x(peak.rate)} y2={100} stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
          {now ? <line x1={x(now.rate)} y1={0} x2={x(now.rate)} y2={100} stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" /> : null}
        </svg>
        <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${x(peak.rate)}%`, top: `${y(peak.revenue)}%`, background: TONE }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>0%</span><span>100%</span></div>
      <p className="text-[10px] text-muted-foreground">
        Peak revenue at {Math.round(peak.rate * 100)}%, read off the curve
        {now ? ` · the current ${Math.round(now.rate * 100)}% is ${now.rate < peak.rate ? "below" : "above"} it` : ""}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ Okun's law */
/** Output gap against the change in unemployment, with the fitted slope. */
export function OkunLaw({
  points, height = 240, label,
}: {
  points: { year: number; gdpGrowth: number; unemploymentChange: number }[]; height?: number; label?: string;
}) {
  if (points.length < 3) return null;
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.gdpGrowth, 0) / n;
  const my = points.reduce((s, p) => s + p.unemploymentChange, 0) / n;
  const slope = points.reduce((s, p) => s + (p.gdpGrowth - mx) * (p.unemploymentChange - my), 0) /
    (points.reduce((s, p) => s + (p.gdpGrowth - mx) ** 2, 0) || 1);
  const intercept = my - slope * mx;
  // Where the fitted line crosses zero change: growth that holds unemployment still.
  const breakEven = slope !== 0 ? -intercept / slope : 0;

  const xs = points.map((p) => p.gdpGrowth), ys = points.map((p) => p.unemploymentChange);
  const x0 = Math.min(...xs) - 0.5, x1 = Math.max(...xs) + 0.5;
  const y0 = Math.min(...ys) - 0.3, y1 = Math.max(...ys) + 0.3;
  const px = (v: number) => ((v - x0) / (x1 - x0)) * 100;
  const py = (v: number) => 100 - ((v - y0) / (y1 - y0)) * 100;

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `slope ${slope.toFixed(2)}`}>
          <line x1={0} y1={py(0)} x2={100} y2={py(0)} stroke={TONE} strokeWidth={1} strokeOpacity={0.3} vectorEffect="non-scaling-stroke" />
          <line x1={px(0)} y1={0} x2={px(0)} y2={100} stroke={TONE} strokeWidth={1} strokeOpacity={0.3} vectorEffect="non-scaling-stroke" />
          <line x1={px(x0)} y1={py(slope * x0 + intercept)} x2={px(x1)} y2={py(slope * x1 + intercept)}
            stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((p) => (
          <span key={p.year} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${px(p.gdpGrowth)}%`, top: `${py(p.unemploymentChange)}%`, background: TONE }}
            title={`${p.year}`} />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Fitted slope {slope.toFixed(2)} — each extra point of growth moves unemployment {Math.abs(slope).toFixed(2)} points
        {slope < 0 ? " down" : " up"} · growth of {breakEven.toFixed(1)}% holds it still
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- Lexis diagram */
/**
 * Age against calendar time, where a person's life is a 45° LINE.
 *
 * That diagonal is the whole device: a cohort, a period and an age group are
 * three different slices of the same plane, and only this layout shows why.
 */
export function LexisDiagram({
  cohorts, fromYear, toYear, maxAge, events = [], height = 280, label,
}: {
  cohorts: number[]; fromYear: number; toYear: number; maxAge: number;
  events?: { year: number; label: string }[]; height?: number; label?: string;
}) {
  if (toYear <= fromYear) return null;
  const px = (y: number) => ((y - fromYear) / (toYear - fromYear)) * 100;
  const py = (a: number) => 100 - (a / maxAge) * 100;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${cohorts.length} cohorts`}>
        {Array.from({ length: Math.floor(maxAge / 10) + 1 }, (_, i) => i * 10).map((a) => (
          <line key={a} x1={0} y1={py(a)} x2={100} y2={py(a)} stroke={TONE} strokeWidth={1} strokeOpacity={0.14} vectorEffect="non-scaling-stroke" />
        ))}
        {events.map((e) => (
          <line key={e.label} x1={px(e.year)} y1={0} x2={px(e.year)} y2={100}
            stroke={TONE} strokeWidth={1.4} strokeDasharray="4 3" strokeOpacity={0.55} vectorEffect="non-scaling-stroke" />
        ))}
        {cohorts.map((c) => {
          const a0 = Math.max(0, fromYear - c), a1 = Math.min(maxAge, toYear - c);
          if (a1 <= a0) return null;
          return (
            <line key={c} x1={px(c + a0)} y1={py(a0)} x2={px(c + a1)} y2={py(a1)}
              stroke={TONE} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
          );
        })}
      </svg>
      <div className="relative mt-1 h-3.5">
        {events.map((e) => (
          <span key={e.label} className="absolute -translate-x-1/2 text-[9px] text-muted-foreground"
            style={{ left: `${Math.min(92, Math.max(8, px(e.year)))}%` }}>{e.label}</span>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{fromYear}</span><span>age 0 to {maxAge}</span><span>{toYear}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Each diagonal is one birth cohort ageing · a vertical slice is a year, a horizontal one an age group
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ inflation basket */
/**
 * Which components drove inflation: each one's CONTRIBUTION is its weight
 * times its own rate, and they sum to the headline — which is stated, because
 * "food is up 12%" and "food added 1.1 points" are very different claims.
 */
export function InflationBasket({
  items, height = 240, label,
}: {
  items: { name: string; weight: number; rate: number }[]; height?: number; label?: string;
}) {
  if (!items.length) return null;
  const rows = items.map((i) => ({ ...i, contribution: i.weight * i.rate })).sort((a, b) => b.contribution - a.contribution);
  const headline = rows.reduce((s, r) => s + r.contribution, 0);
  const max = Math.max(...rows.map((r) => Math.abs(r.contribution)));
  const biggest = rows[0];

  return (
    <div className="w-full">
      <div className="space-y-1" style={{ minHeight: height }}>
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2">
            <span className="w-[30%] shrink-0 truncate text-[10px]">{r.name}</span>
            <span className="w-9 shrink-0 text-right text-[9px] text-muted-foreground">{Math.round(r.weight * 100)}%</span>
            <div className="relative h-3.5 flex-1">
              <span className="absolute top-0 bottom-0 w-px" style={{ left: "50%", background: "var(--border)" }} />
              <span className="absolute top-0 bottom-0 rounded-[2px]" style={{
                left: r.contribution >= 0 ? "50%" : `${50 - (Math.abs(r.contribution) / max) * 50}%`,
                width: `${(Math.abs(r.contribution) / max) * 50}%`,
                background: r.contribution >= 0 ? TONE : "var(--background)",
                border: r.contribution >= 0 ? undefined : `2px solid ${TONE}`,
              }} />
            </div>
            <span className="w-20 text-right text-[9px] tabular-nums text-muted-foreground">
              {r.rate >= 0 ? "+" : ""}{(r.rate * 100).toFixed(1)}% → {r.contribution >= 0 ? "+" : ""}{(r.contribution * 100).toFixed(2)}pp
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Headline {(headline * 100).toFixed(2)}%, which is what the contributions sum to ·
        {biggest.name} is up {(biggest.rate * 100).toFixed(1)}% but adds {(biggest.contribution * 100).toFixed(2)} points
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ price parity */
/**
 * The same basket in different places, at market rates and at purchasing-power
 * parity. The implied exchange rate is COMPUTED, so over- and under-valuation
 * falls out rather than being asserted.
 */
export function PricePartyIndex({
  base, places, label,
}: {
  /** the reference: local price and its currency code */ base: { place: string; price: number; currency: string };
  places: { place: string; price: number; currency: string; marketRate: number }[]; label?: string;
}) {
  if (!places.length) return null;
  const rows = places.map((p) => {
    const implied = p.price / base.price;
    const valuation = implied / p.marketRate - 1;
    return { ...p, implied, valuation, inBase: p.price / p.marketRate };
  }).sort((a, b) => b.valuation - a.valuation);
  const max = Math.max(...rows.map((r) => Math.abs(r.valuation)));

  return (
    <div className="w-full">
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.place} className="flex items-center gap-2">
            <span className="w-[26%] shrink-0 truncate text-[10px]">{r.place}</span>
            <div className="relative h-3.5 flex-1">
              <span className="absolute top-[-2px] bottom-[-2px] w-px" style={{ left: "50%", background: TONE }} />
              <span className="absolute top-0 bottom-0 rounded-[2px]" style={{
                left: r.valuation >= 0 ? "50%" : `${50 - (Math.abs(r.valuation) / max) * 48}%`,
                width: `${(Math.abs(r.valuation) / max) * 48}%`,
                background: r.valuation >= 0 ? TONE : "var(--background)",
                border: r.valuation >= 0 ? undefined : `2px solid ${TONE}`,
              }} />
            </div>
            <span className="w-24 text-right text-[9px] tabular-nums text-muted-foreground">
              {r.valuation >= 0 ? "+" : ""}{Math.round(r.valuation * 100)}% · {r.inBase.toFixed(2)} {base.currency}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Against {base.place} at {base.price} {base.currency} · solid right is over-valued against the market rate,
        outlined left under-valued · the implied rate is the price ratio
      </p>
    </div>
  );
}
