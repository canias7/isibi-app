/** Actuarial work: triangles, tables and the curves reserves are set from. */

const TONE = "var(--foreground)";

/* -------------------------------------------------------------- loss triangle */
/**
 * Claims paid by accident year and development period.
 *
 * The DEVELOPMENT FACTORS are computed from the triangle itself — a triangle
 * printed next to factors somebody typed is the classic reserving error, and
 * the whole reserve rests on them.
 */
export function LossTriangle({
  years, /** rows[year][devPeriod], cumulative */ rows, label,
}: {
  years: (string | number)[]; rows: number[][]; label?: string;
}) {
  if (!rows.length) return null;
  const periods = Math.max(...rows.map((r) => r.length));
  // Age-to-age factor per column: sum of the next column over the sum of this
  // one, across every row that has both.
  const factors = Array.from({ length: periods - 1 }, (_, c) => {
    let num = 0, den = 0;
    rows.forEach((r) => { if (r[c + 1] != null && r[c] != null) { num += r[c + 1]; den += r[c]; } });
    return den ? num / den : 1;
  });
  const toUltimate = factors.map((_, i) => factors.slice(i).reduce((a, b) => a * b, 1));
  const ultimate = rows.map((r) => {
    const last = r.length - 1;
    return r[last] * (last < periods - 1 ? toUltimate[last] : 1);
  });
  const reserve = ultimate.reduce((s, u, i) => s + (u - rows[i][rows[i].length - 1]), 0);
  const max = Math.max(...rows.flat());

  return (
    <div className="w-full overflow-x-auto">
      <table className="border-collapse text-[10px] tabular-nums">
        <tbody>
          <tr>
            <td className="pr-1.5 pb-0.5 font-semibold">AY</td>
            {Array.from({ length: periods }, (_, c) => (
              <td key={c} className="px-1 pb-0.5 text-center font-semibold">{c + 1}</td>
            ))}
            <td className="pl-2 pb-0.5 text-right font-semibold">Ult.</td>
          </tr>
          {rows.map((r, i) => (
            <tr key={String(years[i])}>
              <td className="pr-1.5 font-semibold">{years[i]}</td>
              {Array.from({ length: periods }, (_, c) => (
                <td key={c} className="px-1 text-right"
                  style={{ background: r[c] != null ? `color-mix(in oklch, ${TONE} ${Math.round((r[c] / max) * 34)}%, transparent)` : undefined }}>
                  {r[c] != null ? Math.round(r[c]).toLocaleString() : ""}
                </td>
              ))}
              <td className="pl-2 text-right font-semibold">{Math.round(ultimate[i]).toLocaleString()}</td>
            </tr>
          ))}
          <tr>
            <td className="pt-1 pr-1.5 text-[9px] text-muted-foreground">factor</td>
            {factors.map((f, c) => (
              <td key={c} className="px-1 pt-1 text-right text-[9px] text-muted-foreground">{f.toFixed(3)}</td>
            ))}
            <td />
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Age-to-age factors computed from the triangle, not supplied ·
        reserve {Math.round(reserve).toLocaleString()} on top of what is paid
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ mortality table */
/**
 * qx on a log axis, because mortality spans four orders of magnitude between
 * childhood and old age and a linear axis shows only the last decade of life.
 * The accident hump in early adulthood is the feature that only survives a log
 * scale.
 */
export function MortalityTable({
  rows, height = 250, label,
}: {
  /** probability of death within the year, by age */ rows: { age: number; qx: number; sex?: string }[];
  height?: number; label?: string;
}) {
  if (rows.length < 2) return null;
  const groups = new Map<string, { age: number; qx: number }[]>();
  rows.forEach((r) => {
    const k = r.sex ?? "all";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  });
  const maxAge = Math.max(...rows.map((r) => r.age));
  const lo = Math.min(...rows.map((r) => r.qx)), hi = Math.max(...rows.map((r) => r.qx));
  const x = (a: number) => (a / maxAge) * 100;
  const y = (q: number) => 100 - ((Math.log10(q) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * 100;
  const dashes = ["", "5 3", "2 2"];

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `qx from ${lo} to ${hi}`}>
        {[-4, -3, -2, -1].map((e) => {
          const q = Math.pow(10, e);
          return q >= lo && q <= hi ? (
            <line key={e} x1={0} y1={y(q)} x2={100} y2={y(q)} stroke={TONE} strokeWidth={1} strokeOpacity={0.14} vectorEffect="non-scaling-stroke" />
          ) : null;
        })}
        {[...groups.entries()].map(([k, pts], i) => (
          <polyline key={k} points={pts.map((p) => `${x(p.age)},${y(p.qx)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.8} strokeDasharray={dashes[i % dashes.length] || undefined}
            vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>age 0</span><span>log scale</span><span>{maxAge}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        {[...groups.keys()].map((k, i) => (
          <span key={k} className="flex items-center gap-1">
            <svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={1.8} strokeDasharray={dashes[i % dashes.length] || undefined} /></svg>{k}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Log axis, or the accident hump in early adulthood is invisible under old-age mortality
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- lapse curve */
/** Policies still in force by duration, with the first-year lapse called out. */
export function LapseCurve({
  points, height = 220, label,
}: {
  points: { year: number; inForce: number }[]; height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const start = points[0].inForce;
  const x = (y: number) => (y / Math.max(...points.map((p) => p.year))) * 100;
  const py = (v: number) => 100 - (v / start) * 100;
  const yearOne = points.find((p) => p.year === 1);
  const firstYearLapse = yearOne ? 1 - yearOne.inForce / start : null;
  const last = points[points.length - 1];

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${Math.round((last.inForce / start) * 100)}% left at year ${last.year}`}>
        <polygon points={`0,100 ${points.map((p) => `${x(p.year)},${py(p.inForce)}`).join(" ")} ${x(last.year)},100`} fill={TONE} fillOpacity={0.14} />
        <polyline points={points.map((p) => `${x(p.year)},${py(p.inForce)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {yearOne ? <line x1={x(1)} y1={0} x2={x(1)} y2={100} stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>issue</span><span>year {last.year}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {firstYearLapse != null ? `${Math.round(firstYearLapse * 100)}% lapse in the first year alone · ` : ""}
        {Math.round((last.inForce / start) * 100)}% still in force at year {last.year}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- exposure curve */
/**
 * What share of a loss falls below each share of the sum insured — the curve a
 * layer is priced from. The share ceded to a layer is COMPUTED as the gap
 * between its two attachment points.
 */
export function ExposureCurve({
  points, layer, height = 240, label,
}: {
  /** fraction of sum insured → fraction of total loss below it */ points: { d: number; g: number }[];
  layer?: { from: number; to: number }; height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const x = (v: number) => v * 100;
  const y = (v: number) => 100 - v * 100;
  const at = (d: number) => {
    const i = points.findIndex((p) => p.d >= d);
    if (i <= 0) return points[0]?.g ?? 0;
    const a = points[i - 1], b = points[i];
    return a.g + ((d - a.d) / (b.d - a.d || 1)) * (b.g - a.g);
  };
  const ceded = layer ? at(layer.to) - at(layer.from) : null;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? "exposure curve"}>
        <line x1={0} y1={100} x2={100} y2={0} stroke={TONE} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.35} vectorEffect="non-scaling-stroke" />
        {layer ? (
          <rect x={x(layer.from)} y={y(at(layer.to))} width={x(layer.to) - x(layer.from)} height={y(at(layer.from)) - y(at(layer.to))}
            fill={TONE} fillOpacity={0.2} />
        ) : null}
        <polyline points={points.map((p) => `${x(p.d)},${y(p.g)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0% of sum insured</span><span>100%</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Dashed is proportional · the curve bows above it because most losses are small
        {ceded != null && layer ? ` · a layer from ${Math.round(layer.from * 100)}% to ${Math.round(layer.to * 100)}% takes ${Math.round(ceded * 100)}% of the loss cost` : ""}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- reserve runoff */
/** How a held reserve was actually spent, and whether it was enough. */
export function ReserveRunoff({
  initialReserve, periods, height = 230, label,
}: {
  initialReserve: number; periods: { label: string; paid: number }[]; height?: number; label?: string;
}) {
  if (!periods.length) return null;
  let left = initialReserve;
  const rows = periods.map((p) => { left -= p.paid; return { ...p, remaining: left }; });
  const totalPaid = periods.reduce((s, p) => s + p.paid, 0);
  const surplus = initialReserve - totalPaid;
  const max = Math.max(initialReserve, ...rows.map((r) => Math.abs(r.remaining)));

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-1.5" style={{ height }}>
        {rows.map((r) => (
          <div key={r.label} className="relative h-full flex-1" title={`${r.label}: paid ${r.paid.toLocaleString()}`}>
            {/* STACKED, not overlaid: paid plus what is left is the reserve held at
                the start of the period, so the first bar meets the dashed line. */}
            <div className="absolute w-full" style={{
              bottom: `${(r.paid / max) * 100}%`,
              height: `${(Math.max(0, r.remaining) / max) * 100}%`,
              background: TONE, opacity: 0.22,
            }} />
            <div className="absolute bottom-0 w-full" style={{
              height: `${(r.paid / max) * 100}%`,
              background: r.remaining < 0 ? "var(--background)" : TONE,
              border: r.remaining < 0 ? `2px solid ${TONE}` : undefined,
            }} />
          </div>
        ))}
        <div className="pointer-events-none absolute right-0 left-0 border-t-2 border-dashed border-foreground"
          style={{ bottom: `${(initialReserve / max) * 100}%` }} />
      </div>
      <div className="mt-1 flex gap-1.5">
        {rows.map((r) => <span key={r.label} className="flex-1 text-center text-[9px] text-muted-foreground">{r.label}</span>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Held {initialReserve.toLocaleString()}, paid {totalPaid.toLocaleString()} ·
        {surplus >= 0 ? ` released ${surplus.toLocaleString()}` : ` strengthened by ${Math.abs(surplus).toLocaleString()} (outlined bars)`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- combined ratio */
/**
 * Losses plus expenses over premium, against the 100% line.
 *
 * Above 100 the underwriting loses money, and the total is COMPUTED from its
 * two parts — a headline ratio that does not equal loss plus expense is the
 * thing this shape prevents.
 */
export function CombinedRatio({
  lines, height = 230, label,
}: {
  lines: { name: string; lossRatio: number; expenseRatio: number }[]; height?: number; label?: string;
}) {
  if (!lines.length) return null;
  const rows = lines.map((l) => ({ ...l, combined: l.lossRatio + l.expenseRatio })).sort((a, b) => b.combined - a.combined);
  const max = Math.max(1.15, ...rows.map((r) => r.combined)) * 1.02;
  const unprofitable = rows.filter((r) => r.combined > 1);

  return (
    <div className="w-full">
      <div className="relative space-y-1.5" style={{ minHeight: height }}>
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2">
            <span className="w-[26%] shrink-0 truncate text-[10px]">{r.name}</span>
            <div className="relative h-4 flex-1">
              <span className="absolute top-0 bottom-0 left-0 rounded-l-[2px]" style={{ width: `${(r.lossRatio / max) * 100}%`, background: TONE }} />
              <span className="absolute top-0 bottom-0" style={{
                left: `${(r.lossRatio / max) * 100}%`, width: `${(r.expenseRatio / max) * 100}%`,
                background: TONE, opacity: 0.35,
              }} />
              <span className="absolute top-[-2px] bottom-[-2px] w-0.5" style={{ left: `${(1 / max) * 100}%`, background: TONE }} />
            </div>
            <span className="w-11 text-right text-[10px] font-semibold tabular-nums">{Math.round(r.combined * 100)}%</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5" style={{ background: TONE }} />losses</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5" style={{ background: TONE, opacity: 0.35 }} />expenses</span>
        <span>tick at 100%</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        {unprofitable.length
          ? `${unprofitable.map((r) => r.name).join(", ")} above 100% — underwriting at a loss before investment income`
          : "every line under 100%"}
      </p>
    </div>
  );
}
