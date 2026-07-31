/** Materials engineering: selection, failure and how properties trade off. */

const TONE = "var(--foreground)";

/* -------------------------------------------------------------- Ashby chart */
/**
 * Two properties on log axes, with GUIDE LINES of constant merit.
 *
 * The point of an Ashby chart is not where a material sits but which side of a
 * performance index it falls on — so the index line is drawn and the materials
 * beating it are counted.
 */
export function AshbyChart({
  materials, xLabel, yLabel, index, height = 280, label,
}: {
  materials: { name: string; x: number; y: number; family?: string }[];
  xLabel: string; yLabel: string;
  /** y = c * x^slope; materials above it win */ index?: { slope: number; through: { x: number; y: number } };
  height?: number; label?: string;
}) {
  if (!materials.length) return null;
  const xs = materials.map((m) => m.x), ys = materials.map((m) => m.y);
  const x0 = Math.min(...xs) * 0.5, x1 = Math.max(...xs) * 2;
  const y0 = Math.min(...ys) * 0.5, y1 = Math.max(...ys) * 2;
  const px = (v: number) => ((Math.log10(v) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0))) * 100;
  const py = (v: number) => 100 - ((Math.log10(v) - Math.log10(y0)) / (Math.log10(y1) - Math.log10(y0))) * 100;
  const above = index
    ? materials.filter((m) => m.y > index.through.y * Math.pow(m.x / index.through.x, index.slope))
    : [];

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
          {[1, 2, 3].map((d) => (
            <line key={d} x1={(d / 4) * 100} y1={0} x2={(d / 4) * 100} y2={100} stroke={TONE} strokeWidth={1} strokeOpacity={0.12} vectorEffect="non-scaling-stroke" />
          ))}
          {index ? (
            <line x1={px(x0)} y1={py(index.through.y * Math.pow(x0 / index.through.x, index.slope))}
              x2={px(x1)} y2={py(index.through.y * Math.pow(x1 / index.through.x, index.slope))}
              stroke={TONE} strokeWidth={1.6} strokeDasharray="6 4" strokeOpacity={0.7} vectorEffect="non-scaling-stroke" />
          ) : null}
        </svg>
        {materials.map((m) => (
          <span key={m.name} className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${px(m.x)}%`, top: `${py(m.y)}%`, background: TONE }} title={`${m.name}`} />
        ))}
        {materials.map((m) => (
          <span key={`l${m.name}`} className="absolute text-[9px] whitespace-nowrap text-muted-foreground"
            style={{
              ...(px(m.x) > 62 ? { right: `${100 - px(m.x) + 2}%` } : { left: `${px(m.x) + 2}%` }),
              top: `${py(m.y)}%`, transform: "translateY(-50%)",
            }}>{m.name}</span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{xLabel} (log)</span><span>{yLabel} (log)</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        {index
          ? `Dashed is the performance index · ${above.length} of ${materials.length} beat it: ${above.map((m) => m.name).join(", ") || "none"}`
          : "Both axes logarithmic — property ranges span decades"}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- creep curve */
/**
 * Strain against time under load, with the three stages.
 *
 * The MINIMUM CREEP RATE — the flat middle — is what a design life is
 * calculated from, and it is measured off the curve here.
 */
export function CreepCurve({
  curves, height = 250, label,
}: {
  curves: { label: string; points: { hours: number; strain: number }[] }[]; height?: number; label?: string;
}) {
  if (!curves.length) return null;
  const all = curves.flatMap((c) => c.points);
  const maxH = Math.max(...all.map((p) => p.hours)), maxS = Math.max(...all.map((p) => p.strain)) * 1.06;
  const x = (h: number) => (h / maxH) * 100;
  const y = (s: number) => 100 - (s / maxS) * 100;
  const dashes = ["", "5 3", "2 2"];
  const minRate = curves.map((c) => {
    let best = Infinity;
    for (let i = 1; i < c.points.length; i++) {
      const r = (c.points[i].strain - c.points[i - 1].strain) / (c.points[i].hours - c.points[i - 1].hours || 1);
      if (r < best) best = r;
    }
    return { label: c.label, rate: best };
  });

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${curves.length} creep curves`}>
        {curves.map((c, i) => (
          <polyline key={c.label} points={c.points.map((p) => `${x(p.hours)},${y(p.strain)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.9} strokeDasharray={dashes[i % dashes.length] || undefined} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0 h</span><span>{maxH.toLocaleString()} h</span>
      </div>
      <div className="mt-0.5 space-y-0.5">
        {minRate.map((m, i) => (
          <p key={m.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={1.9} strokeDasharray={dashes[i % dashes.length] || undefined} /></svg>
            {m.label} · minimum rate {(m.rate * 1e6).toFixed(2)} µ/h
          </p>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Primary settles, secondary is the flat middle, tertiary runs away to rupture — design life comes from the middle
      </p>
    </div>
  );
}

/* --------------------------------------------------------- tensile comparison */
/**
 * Stress-strain to failure for several materials.
 *
 * TOUGHNESS is the area under the curve, computed here — a material with the
 * higher strength is often the one that absorbs less energy, which is the
 * distinction a bar chart of strengths destroys.
 */
export function TensileComparison({
  materials, height = 250, label,
}: {
  materials: { name: string; points: { strain: number; stress: number }[] }[]; height?: number; label?: string;
}) {
  if (!materials.length) return null;
  const all = materials.flatMap((m) => m.points);
  const maxE = Math.max(...all.map((p) => p.strain)) * 1.05;
  const maxS = Math.max(...all.map((p) => p.stress)) * 1.08;
  const x = (e: number) => (e / maxE) * 100;
  const y = (s: number) => 100 - (s / maxS) * 100;
  const dashes = ["", "5 3", "2 2", "7 2 2 2"];
  const stats = materials.map((m) => {
    let area = 0;
    for (let i = 1; i < m.points.length; i++) {
      area += ((m.points[i].stress + m.points[i - 1].stress) / 2) * (m.points[i].strain - m.points[i - 1].strain);
    }
    return { name: m.name, uts: Math.max(...m.points.map((p) => p.stress)), toughness: area };
  });
  const strongest = stats.reduce((a, b) => (b.uts > a.uts ? b : a));
  const toughest = stats.reduce((a, b) => (b.toughness > a.toughness ? b : a));

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${materials.length} materials`}>
        {materials.map((m, i) => (
          <polyline key={m.name} points={m.points.map((p) => `${x(p.strain)},${y(p.stress)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.9} strokeDasharray={dashes[i % dashes.length] || undefined} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1 space-y-0.5">
        {stats.map((s, i) => (
          <p key={s.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={1.9} strokeDasharray={dashes[i % dashes.length] || undefined} /></svg>
            {s.name} · UTS {Math.round(s.uts)} MPa · toughness {s.toughness.toFixed(1)} MJ/m³
          </p>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Toughness is the AREA under the curve, not the peak · {strongest.name} is strongest,
        {strongest.name === toughest.name ? " and also toughest" : ` but ${toughest.name} absorbs more energy`}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- hardness scale */
/**
 * Materials on a hardness scale, with the scale's own NON-LINEARITY shown.
 *
 * Mohs is ordinal — diamond is not 10/9 as hard as corundum, it is about four
 * times — so the absolute values are drawn beside the ordinal ranks.
 */
export function HardnessScale({
  items, height = 240, label,
}: {
  items: { name: string; mohs: number; absoluteGpa: number }[]; height?: number; label?: string;
}) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => a.mohs - b.mohs);
  const maxAbs = Math.max(...sorted.map((i) => i.absoluteGpa));
  const maxMohs = Math.max(...sorted.map((i) => i.mohs));

  return (
    <div className="w-full" style={{ minHeight: height }}>
      <div className="space-y-1">
        {sorted.map((i) => (
          <div key={i.name} className="flex items-center gap-2">
            <span className="w-[28%] shrink-0 truncate text-[10px]">{i.name}</span>
            <span className="h-2.5 shrink-0 rounded-[2px]" style={{ width: `${(i.mohs / maxMohs) * 26}%`, background: TONE, opacity: 0.35 }} />
            <span className="h-2.5 rounded-[2px]" style={{ width: `${(i.absoluteGpa / maxAbs) * 42}%`, background: TONE }} />
            <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
              Mohs {i.mohs} · {i.absoluteGpa} GPa
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Pale is the ordinal Mohs number, solid is measured hardness · the two disagree wildly at the top,
        which is what "ordinal scale" means
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- thermal expansion */
/**
 * Length change with temperature for a joined pair, with the MISMATCH shown —
 * differential expansion is what cracks a joint, and the difference is the
 * number that matters, not either curve.
 */
export function ThermalExpansion({
  materials, fromC, toC, lengthMm, height = 230, label,
}: {
  materials: { name: string; alphaPerK: number }[]; fromC: number; toC: number; lengthMm: number;
  height?: number; label?: string;
}) {
  if (materials.length < 1) return null;
  const dT = toC - fromC;
  const rows = materials.map((m) => ({ ...m, delta: m.alphaPerK * dT * lengthMm }));
  const max = Math.max(...rows.map((r) => Math.abs(r.delta))) * 1.1;
  const spread = Math.max(...rows.map((r) => r.delta)) - Math.min(...rows.map((r) => r.delta));
  const x = (t: number) => ((t - fromC) / (dT || 1)) * 100;
  const y = (d: number) => 100 - (d / max) * 100;
  const dashes = ["", "5 3", "2 2", "7 2 2 2"];

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${spread.toFixed(2)} mm mismatch`}>
        {rows.map((r, i) => (
          <line key={r.name} x1={x(fromC)} y1={y(0)} x2={x(toC)} y2={y(r.delta)}
            stroke={TONE} strokeWidth={1.9} strokeDasharray={dashes[i % dashes.length] || undefined} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{fromC}°C</span><span>{toC}°C</span>
      </div>
      <div className="mt-0.5 space-y-0.5">
        {rows.map((r, i) => (
          <p key={r.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={1.9} strokeDasharray={dashes[i % dashes.length] || undefined} /></svg>
            {r.name} · {(r.alphaPerK * 1e6).toFixed(1)} µ/K · {r.delta >= 0 ? "+" : ""}{r.delta.toFixed(2)} mm
          </p>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Over {lengthMm} mm and {dT} K · the MISMATCH is {spread.toFixed(2)} mm, and that is what a joint has to absorb
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- corrosion rate */
/**
 * Metal loss over time, with the remaining wall against the retirement
 * thickness — the DATE it is reached is extrapolated and stated, because that
 * is the decision the inspection exists to inform.
 */
export function CorrosionRate({
  readings, nominalMm, retireMm, height = 240, label,
}: {
  readings: { year: number; thicknessMm: number }[]; nominalMm: number; retireMm: number;
  height?: number; label?: string;
}) {
  if (readings.length < 2) return null;
  const first = readings[0], last = readings[readings.length - 1];
  const rate = (first.thicknessMm - last.thicknessMm) / (last.year - first.year || 1);
  const yearsLeft = rate > 0 ? (last.thicknessMm - retireMm) / rate : Infinity;
  const retireYear = last.year + yearsLeft;
  const spanTo = Number.isFinite(yearsLeft) ? Math.ceil(retireYear) + 1 : last.year + 10;
  const x = (y: number) => ((y - first.year) / (spanTo - first.year)) * 100;
  const py = (t: number) => 100 - (t / (nominalMm * 1.05)) * 100;

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `${rate.toFixed(3)} mm a year`}>
          <line x1={0} y1={py(nominalMm)} x2={100} y2={py(nominalMm)} stroke={TONE} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={py(retireMm)} x2={100} y2={py(retireMm)} stroke={TONE} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
          <polyline points={readings.map((r) => `${x(r.year)},${py(r.thicknessMm)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
          {Number.isFinite(yearsLeft) ? (
            <line x1={x(last.year)} y1={py(last.thicknessMm)} x2={x(retireYear)} y2={py(retireMm)}
              stroke={TONE} strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          ) : null}
        </svg>
        {readings.map((r) => (
          <span key={r.year} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${x(r.year)}%`, top: `${py(r.thicknessMm)}%`, background: TONE }} title={`${r.year}: ${r.thicknessMm} mm`} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{first.year}</span><span>{spanTo}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {rate.toFixed(3)} mm a year over {last.year - first.year} years · solid line is the retirement thickness ·
        {Number.isFinite(yearsLeft)
          ? ` reached about ${Math.round(retireYear)}, in ${Math.round(yearsLeft)} years`
          : " not losing metal on this trend"}
      </p>
    </div>
  );
}
