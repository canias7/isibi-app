/** Analytical chemistry: what comes off an instrument and what it means. */

const TONE = "var(--foreground)";

/* ------------------------------------------------------------------ chromatogram */
/**
 * Detector signal against retention time, with RESOLUTION between adjacent
 * peaks computed.
 *
 * Two peaks that look separate can still be unresolved; the number that
 * decides is 1.5, and it comes from the peak widths, not the eye.
 */
export function Chromatogram({
  peaks, runMinutes, height = 240, label,
}: {
  peaks: { rt: number; height: number; widthMin: number; name?: string }[];
  runMinutes: number; height?: number; label?: string;
}) {
  if (!peaks.length) return null;
  const N = 600;
  const trace = Array.from({ length: N + 1 }, (_, i) => {
    const t = (i / N) * runMinutes;
    // Gaussian peaks: width is taken as the base width, so sigma is width/4.
    return peaks.reduce((s, p) => s + p.height * Math.exp(-((t - p.rt) ** 2) / (2 * (p.widthMin / 4) ** 2)), 0);
  });
  const max = Math.max(...trace) * 1.08;
  const x = (t: number) => (t / runMinutes) * 100;
  const y = (v: number) => 100 - (v / max) * 100;
  const sorted = [...peaks].sort((a, b) => a.rt - b.rt);
  const res = sorted.slice(1).map((p, i) => ({
    a: sorted[i], b: p,
    r: (2 * (p.rt - sorted[i].rt)) / (p.widthMin + sorted[i].widthMin),
  }));
  const worst = res.length ? res.reduce((a, b) => (b.r < a.r ? b : a)) : null;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${peaks.length} peaks`}>
        <polyline points={trace.map((v, i) => `${x((i / N) * runMinutes)},${y(v)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="relative mt-1 h-3.5">
        {sorted.filter((p) => p.name).map((p) => (
          <span key={p.rt} className="absolute -translate-x-1/2 text-[9px] text-muted-foreground"
            style={{ left: `${Math.min(94, Math.max(6, x(p.rt)))}%` }}>{p.name}</span>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0 min</span><span>{runMinutes} min</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {worst
          ? `Worst resolution is ${worst.a.name ?? worst.a.rt} / ${worst.b.name ?? worst.b.rt} at R = ${worst.r.toFixed(2)} — ${worst.r >= 1.5 ? "baseline separated" : "NOT baseline separated, whatever it looks like"}`
          : "One peak, nothing to resolve"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ mass spectrum */
/**
 * A stick spectrum with the BASE PEAK normalised to 100 and the molecular ion
 * marked — everything in a mass spectrum is relative to the base peak, so an
 * un-normalised one cannot be compared with anything.
 */
export function MassSpectrum({
  ions, molecularIon, height = 230, label,
}: {
  ions: { mz: number; abundance: number; note?: string }[]; molecularIon?: number;
  height?: number; label?: string;
}) {
  if (!ions.length) return null;
  const base = Math.max(...ions.map((i) => i.abundance));
  const maxMz = Math.max(...ions.map((i) => i.mz)) * 1.06;
  const basePeak = ions.find((i) => i.abundance === base)!;
  const named = ions.filter((i) => i.note || i.mz === molecularIon);

  return (
    <div className="w-full">
      <div className="relative flex items-end" style={{ height }}>
        {ions.map((i) => (
          <span key={i.mz} className="absolute bottom-0 w-[2px] -translate-x-1/2"
            style={{
              left: `${(i.mz / maxMz) * 100}%`, height: `${(i.abundance / base) * 100}%`,
              background: TONE, opacity: i.mz === molecularIon ? 1 : 0.8,
            }} title={`m/z ${i.mz} · ${Math.round((i.abundance / base) * 100)}%`} />
        ))}
        {molecularIon != null ? (
          <span className="absolute bottom-0 top-0 border-l border-dashed border-foreground"
            style={{ left: `${(molecularIon / maxMz) * 100}%`, opacity: 0.5 }} />
        ) : null}
      </div>
      <div className="relative mt-1 h-3.5">
        {named.map((i) => (
          <span key={i.mz} className="absolute -translate-x-1/2 text-[9px] text-muted-foreground"
            style={{ left: `${Math.min(94, Math.max(4, (i.mz / maxMz) * 100))}%` }}>
            {i.mz === molecularIon ? `M⁺ ${i.mz}` : i.note}
          </span>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0 m/z</span><span>{Math.round(maxMz)}</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Normalised to the base peak at m/z {basePeak.mz}
        {molecularIon != null ? ` · molecular ion at ${molecularIon}, ${Math.round(((ions.find((i) => i.mz === molecularIon)?.abundance ?? 0) / base) * 100)}% of base` : ""}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- solubility curve */
/**
 * Grams per 100 g of water against temperature, with the amount that
 * CRYSTALLISES on cooling computed — which is the whole reason to draw it.
 */
export function SolubilityCurve({
  salts, coolFrom, coolTo, height = 250, label,
}: {
  salts: { name: string; points: { tempC: number; gPer100 : number }[] }[];
  coolFrom?: number; coolTo?: number; height?: number; label?: string;
}) {
  if (!salts.length) return null;
  const all = salts.flatMap((s) => s.points);
  const maxT = Math.max(...all.map((p) => p.tempC));
  const maxG = Math.max(...all.map((p) => p.gPer100)) * 1.06;
  const x = (t: number) => (t / maxT) * 100;
  const y = (g: number) => 100 - (g / maxG) * 100;
  const dashes = ["", "5 3", "2 2", "7 2 2 2"];
  const at = (s: (typeof salts)[number], t: number) => {
    const i = s.points.findIndex((p) => p.tempC >= t);
    if (i <= 0) return s.points[0]?.gPer100 ?? 0;
    const a = s.points[i - 1], b = s.points[i];
    return a.gPer100 + ((t - a.tempC) / (b.tempC - a.tempC || 1)) * (b.gPer100 - a.gPer100);
  };
  const yields = coolFrom != null && coolTo != null
    ? salts.map((s) => ({ name: s.name, g: at(s, coolFrom) - at(s, coolTo) })) : [];

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${salts.length} salts`}>
        {coolFrom != null && coolTo != null ? (
          <rect x={x(Math.min(coolFrom, coolTo))} y={0} width={Math.abs(x(coolFrom) - x(coolTo))} height={100} fill={TONE} fillOpacity={0.08} />
        ) : null}
        {salts.map((s, i) => (
          <polyline key={s.name} points={s.points.map((p) => `${x(p.tempC)},${y(p.gPer100)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.9} strokeDasharray={dashes[i % dashes.length] || undefined} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0°C</span><span>{maxT}°C</span>
      </div>
      <div className="mt-0.5 space-y-0.5">
        {salts.map((s, i) => (
          <p key={s.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={1.9} strokeDasharray={dashes[i % dashes.length] || undefined} /></svg>
            {s.name}{yields.length ? ` · ${yields.find((y2) => y2.name === s.name)!.g.toFixed(1)} g crystallises` : ""}
          </p>
        ))}
      </div>
      {coolFrom != null && coolTo != null ? (
        <p className="text-[10px] text-muted-foreground">
          Cooling a saturated solution from {coolFrom}°C to {coolTo}°C · the yield is the vertical gap, per 100 g of water
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- buffer capacity */
/**
 * pH against added base, with the BUFFER REGION derived from the pKa.
 *
 * A buffer works within about one pH unit of its pKa; outside that it is not
 * a buffer, and the region is drawn rather than assumed.
 */
export function BufferCapacity({
  pKa, points, height = 240, label,
}: {
  pKa: number; points: { added: number; ph: number }[]; height?: number; label?: string;
}) {
  if (points.length < 3) return null;
  const maxAdd = Math.max(...points.map((p) => p.added));
  const x = (a: number) => (a / maxAdd) * 100;
  const y = (ph: number) => 100 - (ph / 14) * 100;
  const inBuffer = points.filter((p) => Math.abs(p.ph - pKa) <= 1);
  const span = inBuffer.length
    ? Math.max(...inBuffer.map((p) => p.added)) - Math.min(...inBuffer.map((p) => p.added)) : 0;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `buffers around pH ${pKa}`}>
        <rect x={0} y={y(pKa + 1)} width={100} height={y(pKa - 1) - y(pKa + 1)} fill={TONE} fillOpacity={0.1} />
        <line x1={0} y1={y(pKa)} x2={100} y2={y(pKa)} stroke={TONE} strokeWidth={1.2} strokeDasharray="5 3" strokeOpacity={0.65} vectorEffect="non-scaling-stroke" />
        <polyline points={points.map((p) => `${x(p.added)},${y(p.ph)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0 mL base</span><span>{maxAdd} mL</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Shaded is pKa {pKa} ± 1, where it actually buffers · it holds for {span.toFixed(1)} mL of added base,
        then the pH runs away
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- calibration line */
/**
 * Standards fitted by least squares, with an unknown read BACK off the line.
 *
 * R² alone does not say a method is good — an unknown outside the calibrated
 * range is extrapolation whatever the fit is — so the range is enforced.
 */
export function CalibrationLine({
  standards, unknown, unit = "mg/L", height = 250, label,
}: {
  standards: { concentration: number; signal: number }[]; unknown?: number; unit?: string;
  height?: number; label?: string;
}) {
  if (standards.length < 3) return null;
  const n = standards.length;
  const mx = standards.reduce((s, p) => s + p.concentration, 0) / n;
  const my = standards.reduce((s, p) => s + p.signal, 0) / n;
  const sxy = standards.reduce((s, p) => s + (p.concentration - mx) * (p.signal - my), 0);
  const sxx = standards.reduce((s, p) => s + (p.concentration - mx) ** 2, 0) || 1;
  const slope = sxy / sxx, intercept = my - slope * mx;
  const syy = standards.reduce((s, p) => s + (p.signal - my) ** 2, 0) || 1;
  const r2 = (sxy * sxy) / (sxx * syy);
  const hiC = Math.max(...standards.map((p) => p.concentration));
  const hiS = Math.max(...standards.map((p) => p.signal), unknown ?? 0) * 1.08;
  const x = (c: number) => (c / (hiC * 1.08)) * 100;
  const y = (s: number) => 100 - (s / hiS) * 100;
  const read = unknown != null && slope !== 0 ? (unknown - intercept) / slope : null;
  const outside = read != null && (read > hiC || read < 0);

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
          <line x1={x(0)} y1={y(intercept)} x2={x(hiC * 1.08)} y2={y(slope * hiC * 1.08 + intercept)}
            stroke={TONE} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
          {read != null ? (
            <g>
              <line x1={0} y1={y(unknown!)} x2={x(read)} y2={y(unknown!)} stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
              <line x1={x(read)} y1={y(unknown!)} x2={x(read)} y2={100} stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
            </g>
          ) : null}
        </svg>
        {standards.map((p) => (
          <span key={p.concentration} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${x(p.concentration)}%`, top: `${y(p.signal)}%`, background: TONE }} />
        ))}
        {read != null ? (
          <span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{ left: `${x(read)}%`, top: `${y(unknown!)}%`, background: "var(--background)", borderColor: TONE }} />
        ) : null}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0 {unit}</span><span>{hiC} {unit}</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        signal = {slope.toFixed(3)}·c + {intercept.toFixed(3)}, R² {r2.toFixed(4)}
        {read != null ? ` · unknown reads ${read.toFixed(2)} ${unit}${outside ? " — OUTSIDE the calibrated range, so this is extrapolation whatever R² says" : ""}` : ""}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- enzyme kinetics */
/**
 * Rate against substrate, with Vmax and Km FITTED by Lineweaver–Burk.
 *
 * Reading Vmax off the top of a hyperbola always underestimates it, because
 * the curve never gets there — which is exactly why the double-reciprocal fit
 * exists, and why both are shown.
 */
export function EnzymeKinetics({
  points, height = 250, label,
}: {
  points: { substrate: number; rate: number }[]; height?: number; label?: string;
}) {
  if (points.length < 3) return null;
  const usable = points.filter((p) => p.substrate > 0 && p.rate > 0);
  const n = usable.length;
  const xs = usable.map((p) => 1 / p.substrate), ys = usable.map((p) => 1 / p.rate);
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0) /
    (xs.reduce((s, v) => s + (v - mx) ** 2, 0) || 1);
  const intercept = my - slope * mx;
  const vmax = intercept > 0 ? 1 / intercept : 0;
  const km = slope * vmax;
  const observedMax = Math.max(...points.map((p) => p.rate));

  const hiS = Math.max(...points.map((p) => p.substrate)) * 1.06;
  const hiV = Math.max(vmax, observedMax) * 1.08;
  const x = (s: number) => (s / hiS) * 100;
  const y = (v: number) => 100 - (v / hiV) * 100;
  const curve = Array.from({ length: 80 }, (_, i) => {
    const s = (i / 79) * hiS;
    return `${x(s)},${y((vmax * s) / (km + s))}`;
  }).join(" ");

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
          <line x1={0} y1={y(vmax)} x2={100} y2={y(vmax)} stroke={TONE} strokeWidth={1.2} strokeDasharray="5 3" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={y(vmax / 2)} x2={x(km)} y2={y(vmax / 2)} stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.45} vectorEffect="non-scaling-stroke" />
          <line x1={x(km)} y1={y(vmax / 2)} x2={x(km)} y2={100} stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.45} vectorEffect="non-scaling-stroke" />
          <polyline points={curve} fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((p) => (
          <span key={p.substrate} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${x(p.substrate)}%`, top: `${y(p.rate)}%`, background: TONE }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0</span><span>[S]</span><span>{hiS.toFixed(0)}</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Fitted Vmax {vmax.toFixed(2)}, Km {km.toFixed(2)} · the highest rate actually measured is
        {" "}{observedMax.toFixed(2)}, {Math.round((1 - observedMax / vmax) * 100)}% short — reading Vmax off the
        top of the curve always under-reads it
      </p>
    </div>
  );
}
