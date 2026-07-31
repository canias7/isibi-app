/** Charts a business plan or an ops dashboard asks for. */

const TONE = "var(--foreground)";

/* ----------------------------------------------------------- break-even */
/**
 * Revenue against total cost, with the crossing marked.
 *
 * The break-even point is COMPUTED from the two lines rather than passed in.
 * A caller that works it out separately can hand over a marker that does not
 * sit on the intersection, which is the one thing the chart exists to show.
 */
export function BreakEven({
  fixed, variablePerUnit, pricePerUnit, maxUnits, height = 230,
  format = (n: number) => "£" + Math.round(n).toLocaleString(), label,
}: {
  fixed: number; variablePerUnit: number; pricePerUnit: number; maxUnits: number;
  height?: number; format?: (n: number) => string; label?: string;
}) {
  const margin = pricePerUnit - variablePerUnit;
  const bep = margin > 0 ? fixed / margin : null;
  const hi = Math.max(pricePerUnit * maxUnits, fixed + variablePerUnit * maxUnits) || 1;
  const X = (u: number) => (u / maxUnits) * 100;
  const Y = (v: number) => 100 - (v / hi) * 96 - 2;

  return (
    <div className="w-full" role="img" aria-label={label ?? (bep ? `Break-even at ${Math.ceil(bep)} units` : "No break-even at this price")}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {bep !== null && bep <= maxUnits ? (
            <polygon points={`${X(bep)},${Y(pricePerUnit * bep)} ${X(maxUnits)},${Y(pricePerUnit * maxUnits)} ${X(maxUnits)},${Y(fixed + variablePerUnit * maxUnits)}`}
              fill={TONE} fillOpacity={0.12} />
          ) : null}
          <line x1={X(0)} y1={Y(fixed)} x2={X(maxUnits)} y2={Y(fixed + variablePerUnit * maxUnits)}
            stroke={TONE} strokeOpacity={0.55} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
          <line x1={X(0)} y1={Y(0)} x2={X(maxUnits)} y2={Y(pricePerUnit * maxUnits)}
            stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {bep !== null && bep <= maxUnits ? (
          <span className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${X(bep)}%`, top: `${Y(pricePerUnit * bep)}%`, background: TONE }} />
        ) : null}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {bep === null ? "Price does not cover variable cost" : `Break-even at ${Math.ceil(bep)} units · ${format(pricePerUnit * bep)}`}
        {" · solid is revenue, dashed is total cost"}
      </p>
    </div>
  );
}

/* --------------------------------------------------------- supply-demand */
/** Two crossing curves with the equilibrium marked. */
export function SupplyDemand({
  supply, demand, size = 260, format = (n: number) => "£" + n, label,
}: {
  supply: { q: number; p: number }[]; demand: { q: number; p: number }[];
  size?: number; format?: (n: number) => string; label?: string;
}) {
  if (!supply.length || !demand.length) return null;
  const qs = [...supply, ...demand].map((d) => d.q);
  const ps = [...supply, ...demand].map((d) => d.p);
  const qHi = Math.max(...qs), pHi = Math.max(...ps);
  const X = (q: number) => (q / qHi) * 92 + 4;
  const Y = (p: number) => 96 - (p / pHi) * 92;

  // Equilibrium by scanning for the sign change in (supply - demand).
  let eq: { q: number; p: number } | null = null;
  for (let i = 1; i < Math.min(supply.length, demand.length); i++) {
    const a = supply[i - 1].p - demand[i - 1].p;
    const b = supply[i].p - demand[i].p;
    if (a === 0 || a * b < 0) { eq = { q: supply[i].q, p: (supply[i].p + demand[i].p) / 2 }; break; }
  }

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? "Supply and demand"}>
        <polyline points={supply.map((d) => `${X(d.q)},${Y(d.p)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.6} />
        <polyline points={demand.map((d) => `${X(d.q)},${Y(d.p)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={1.6} strokeDasharray="4 3" />
        {eq ? (
          <>
            <line x1={4} y1={Y(eq.p)} x2={X(eq.q)} y2={Y(eq.p)} stroke="var(--border)" strokeDasharray="2 2" />
            <line x1={X(eq.q)} y1={96} x2={X(eq.q)} y2={Y(eq.p)} stroke="var(--border)" strokeDasharray="2 2" />
            <circle cx={X(eq.q)} cy={Y(eq.p)} r={2.4} fill={TONE} />
          </>
        ) : null}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Solid supply · dashed demand{eq ? ` · clears at ${format(eq.p)}` : ""}
      </p>
    </div>
  );
}

/* --------------------------------------------------------- learning curve */
/** Unit cost against cumulative volume — cost falls by a fixed rate per doubling. */
export function LearningCurve({
  firstUnitCost, rate = 0.85, units = 128, height = 210,
  format = (n: number) => "£" + n.toFixed(1), label,
}: {
  firstUnitCost: number; /** Cost multiplier per doubling. */ rate?: number;
  units?: number; height?: number; format?: (n: number) => string; label?: string;
}) {
  const b = Math.log(rate) / Math.log(2);
  const pts = Array.from({ length: 40 }, (_, i) => {
    const q = 1 + (units - 1) * (i / 39);
    return { q, c: firstUnitCost * Math.pow(q, b) };
  });
  const cLo = pts[pts.length - 1].c, cHi = pts[0].c;
  const X = (q: number) => (Math.log(q) / Math.log(units)) * 96 + 2;
  const Y = (c: number) => 100 - ((c - cLo) / (cHi - cLo || 1)) * 92 - 4;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Cost falls to ${Math.round(rate * 100)}% each doubling`}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline points={pts.map((p) => `${X(p.q)},${Y(p.c)}`).join(" ")} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>1 unit · {format(cHi)}</span>
        <span>{Math.round(rate * 100)}% curve</span>
        <span>{units} units · {format(cLo)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ price ladder */
/** Tiers side by side, height to price, with what each includes. */
export function PriceLadder({
  tiers, height = 220, format = (n: number) => "£" + n, label,
}: {
  tiers: { label: string; price: number; note?: string; highlight?: boolean }[];
  height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!tiers.length) return null;
  const hi = Math.max(...tiers.map((t) => t.price)) || 1;
  return (
    <div className="w-full" role="img" aria-label={label ?? tiers.map((t) => `${t.label} ${format(t.price)}`).join(", ")}>
      <div className="flex items-end gap-3" style={{ height }}>
        {tiers.map((t) => (
          <div key={t.label} className="flex flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-[11px] font-medium tabular-nums">{format(t.price)}</span>
            <div className="w-full rounded-t-[3px]"
              style={{
                height: `${(t.price / hi) * 100}%`,
                background: t.highlight ? TONE : "color-mix(in oklch, var(--foreground) 26%, transparent)",
                border: t.highlight ? undefined : `1px solid color-mix(in oklch, var(--foreground) 45%, transparent)`,
              }}
              title={`${t.label}: ${format(t.price)}`} />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        {tiers.map((t) => (
          <div key={t.label} className="flex-1 pt-1 text-center">
            <div className="truncate text-[10px] font-medium">{t.label}</div>
            {t.note ? <div className="truncate text-[9px] text-muted-foreground">{t.note}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- thermometer */
/** Vertical goal progress. The shape a fundraising page uses, and for good reason. */
export function Thermometer({
  value, goal, height = 220, width = 46, milestones,
  format = (n: number) => "£" + n.toLocaleString(), label,
}: {
  value: number; goal: number; height?: number; width?: number;
  milestones?: number[]; format?: (n: number) => string; label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value / (goal || 1)));
  return (
    <div className="flex items-end gap-4" role="img" aria-label={label ?? `${format(value)} of ${format(goal)}`}>
      <div className="relative overflow-hidden rounded-full border" style={{ width, height, borderColor: TONE }}>
        <div className="absolute right-0 bottom-0 left-0" style={{ height: `${pct * 100}%`, background: TONE }} />
        {(milestones ?? []).map((m) => (
          <div key={m} className="absolute right-0 left-0 border-t border-dashed"
            style={{ bottom: `${(m / (goal || 1)) * 100}%`, borderColor: "var(--background)" }} title={format(m)} />
        ))}
      </div>
      <div className="pb-1">
        <div className="text-[18px] leading-none font-semibold tabular-nums">{format(value)}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">of {format(goal)} · {Math.round(pct * 100)}%</div>
        {(milestones ?? []).length ? (
          <div className="mt-2 space-y-0.5">
            {(milestones ?? []).map((m) => (
              <div key={m} className="text-[10px] text-muted-foreground">
                {value >= m ? "●" : "○"} {format(m)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- gauge grid */
/** Several dials at once. Arcs, not needles — a needle needs more room to read. */
export function GaugeGrid({
  gauges, columns = 3, size = 96, label,
}: {
  gauges: { label: string; value: number; max?: number; unit?: string }[];
  columns?: number; size?: number; label?: string;
}) {
  if (!gauges.length) return null;
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
      role="img" aria-label={label ?? gauges.map((g) => `${g.label} ${g.value}`).join(", ")}>
      {gauges.map((g) => {
        const max = g.max ?? 100;
        const pct = Math.max(0, Math.min(1, g.value / (max || 1)));
        const r = size / 2 - 7;
        const c = Math.PI * r; // half circle
        return (
          <div key={g.label} className="flex flex-col items-center">
            <svg viewBox={`0 0 ${size} ${size / 2 + 8}`} width={size} height={size / 2 + 8}>
              <path d={`M 7 ${size / 2} A ${r} ${r} 0 0 1 ${size - 7} ${size / 2}`}
                fill="none" stroke="var(--muted)" strokeWidth={7} strokeLinecap="round" />
              <path d={`M 7 ${size / 2} A ${r} ${r} 0 0 1 ${size - 7} ${size / 2}`}
                fill="none" stroke={TONE} strokeWidth={7} strokeLinecap="round"
                strokeDasharray={`${pct * c} ${c}`} />
              <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize={14} fontWeight={600} className="fill-foreground">
                {g.value}{g.unit ?? ""}
              </text>
            </svg>
            <span className="mt-1 truncate text-[10px] text-muted-foreground">{g.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------- cost breakdown */
/** Where the money went, as one stacked bar plus a keyed list. */
export function CostBreakdown({
  parts, height = 34, format = (n: number) => "£" + n.toLocaleString(), label,
}: {
  parts: { label: string; value: number }[]; height?: number;
  format?: (n: number) => string; label?: string;
}) {
  if (!parts.length) return null;
  const sum = parts.reduce((s, p) => s + p.value, 0) || 1;
  const tone = (i: number) => `color-mix(in oklch, var(--foreground) ${Math.round(92 - (i / Math.max(1, parts.length - 1)) * 74)}%, transparent)`;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${parts.length} cost lines totalling ${format(sum)}`}>
      <div className="flex w-full overflow-hidden rounded-[3px]" style={{ height }}>
        {parts.map((p, i) => (
          <div key={p.label} style={{ width: `${(p.value / sum) * 100}%`, background: tone(i) }}
            title={`${p.label}: ${format(p.value)}`} />
        ))}
      </div>
      <div className="mt-3 space-y-1">
        {parts.map((p, i) => (
          <div key={p.label} className="flex items-center gap-2 text-[11px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: tone(i) }} />
            <span className="flex-1 truncate">{p.label}</span>
            <span className="tabular-nums">{format(p.value)}</span>
            <span className="w-9 text-right tabular-nums text-muted-foreground">{Math.round((p.value / sum) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
