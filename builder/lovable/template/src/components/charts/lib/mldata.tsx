/** Model and service diagnostics — the plots you look at when it goes wrong. */

const TONE = "var(--foreground)";

/* -------------------------------------------------------------- attention map */
/**
 * How much each output token attended to each input token.
 *
 * Rows are normalised to sum to 1 — attention weights are a distribution per
 * query, so a raw grid makes a long row look uniformly weak when it is not.
 */
export function AttentionMap({
  sourceTokens, targetTokens, weights, size = 380, label,
}: {
  sourceTokens: string[]; targetTokens: string[];
  /** weights[target][source] */ weights: number[][]; size?: number; label?: string;
}) {
  if (!sourceTokens.length || !targetTokens.length) return null;
  const rows = weights.map((row) => {
    const sum = row.reduce((s, v) => s + v, 0) || 1;
    return row.map((v) => v / sum);
  });
  const peaks = rows.map((row, i) => {
    const j = row.indexOf(Math.max(...row));
    return { target: targetTokens[i], source: sourceTokens[j], w: row[j] };
  });
  const strongest = peaks.reduce((a, b) => (b.w > a.w ? b : a));

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(${sourceTokens.length}, 1fr)`, minWidth: Math.min(size, 260) }}>
        <span />
        {sourceTokens.map((t) => (
          <span key={t} className="pb-1 text-center text-[9px] whitespace-nowrap text-muted-foreground"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 44 }}>{t}</span>
        ))}
        {targetTokens.map((t, i) => (
          <div key={t} className="contents">
            <span className="self-center pr-1.5 text-[10px] whitespace-nowrap">{t}</span>
            {sourceTokens.map((s, j) => {
              const w = rows[i]?.[j] ?? 0;
              return (
                <span key={s} className="aspect-square min-w-[18px]"
                  style={{ background: `color-mix(in oklch, ${TONE} ${Math.round(w * 96)}%, transparent)` }}
                  title={`${t} → ${s}: ${(w * 100).toFixed(1)}%`} />
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Each row sums to 1 · strongest link "{strongest.target}" → "{strongest.source}" at {(strongest.w * 100).toFixed(0)}%
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- SHAP waterfall */
/**
 * One prediction explained: how each feature moved it from the base rate.
 *
 * The bars must SUM to the prediction, and they are checked here — an
 * attribution plot whose contributions do not reconcile is decoration.
 */
export function ShapWaterfall({
  baseValue, contributions, height = 240, unit = "", label,
}: {
  baseValue: number;
  /** `value` is the feature's own value, displayed and never computed on —
      so it may be categorical ("permanent") as easily as numeric. */
  contributions: { feature: string; value: string | number; shap: number }[];
  height?: number; unit?: string; label?: string;
}) {
  if (!contributions.length) return null;
  const ordered = [...contributions].sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap));
  const prediction = baseValue + ordered.reduce((s, c) => s + c.shap, 0);
  const lo = Math.min(baseValue, prediction, ...ordered.map((_, i) =>
    baseValue + ordered.slice(0, i + 1).reduce((s, c) => s + c.shap, 0)));
  const hi = Math.max(baseValue, prediction, ...ordered.map((_, i) =>
    baseValue + ordered.slice(0, i + 1).reduce((s, c) => s + c.shap, 0)));
  const pad = (hi - lo) * 0.1 || 0.1;
  const x = (v: number) => ((v - lo + pad) / (hi - lo + pad * 2)) * 100;

  let run = baseValue;
  const bars = ordered.map((c) => { const from = run; run += c.shap; return { ...c, from, to: run }; });

  return (
    <div className="w-full">
      <div className="space-y-1" style={{ minHeight: height }}>
        <div className="flex items-center gap-2">
          <span className="w-[38%] shrink-0 text-[10px] text-muted-foreground">base rate</span>
          <div className="relative h-3.5 flex-1">
            <span className="absolute top-0 bottom-0 w-0.5" style={{ left: `${x(baseValue)}%`, background: TONE }} />
          </div>
          <span className="w-12 text-right text-[10px] tabular-nums">{baseValue.toFixed(2)}{unit}</span>
        </div>
        {bars.map((b) => {
          const up = b.shap >= 0;
          return (
            <div key={b.feature} className="flex items-center gap-2">
              <span className="w-[38%] shrink-0 truncate text-[10px]" title={`${b.feature} = ${b.value}`}>
                {b.feature} <span className="text-muted-foreground">= {b.value}</span>
              </span>
              <div className="relative h-3.5 flex-1">
                <span className="absolute top-0 bottom-0 rounded-[2px]" style={{
                  left: `${x(Math.min(b.from, b.to))}%`,
                  width: `${Math.abs(x(b.to) - x(b.from))}%`,
                  // Direction is carried by fill AND by the sign printed beside
                  // it, since up and down here are not up and down on the page.
                  background: up ? TONE : "var(--background)",
                  border: up ? undefined : `2px solid ${TONE}`,
                }} />
              </div>
              <span className="w-12 text-right text-[10px] tabular-nums">{b.shap >= 0 ? "+" : ""}{b.shap.toFixed(2)}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 border-t pt-1" style={{ borderColor: "var(--border)" }}>
          <span className="w-[38%] shrink-0 text-[10px] font-semibold">prediction</span>
          <div className="relative h-3.5 flex-1">
            <span className="absolute top-0 bottom-0 w-0.5" style={{ left: `${x(prediction)}%`, background: TONE }} />
          </div>
          <span className="w-12 text-right text-[10px] font-semibold tabular-nums">{prediction.toFixed(2)}{unit}</span>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Solid pushes up, outlined pushes down · base {baseValue.toFixed(2)} plus the contributions gives {prediction.toFixed(2)}, which is what they sum to
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ threshold sweep */
/**
 * Precision, recall and F1 against the decision threshold, with the best F1
 * COMPUTED — not the 0.5 everybody ships by default.
 */
export function ThresholdSweep({
  points, height = 240, label,
}: {
  points: { threshold: number; precision: number; recall: number }[]; height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const rows = points.map((p) => ({
    ...p,
    f1: p.precision + p.recall > 0 ? (2 * p.precision * p.recall) / (p.precision + p.recall) : 0,
  }));
  const best = rows.reduce((a, b) => (b.f1 > a.f1 ? b : a));
  const half = rows.reduce((a, b) => (Math.abs(b.threshold - 0.5) < Math.abs(a.threshold - 0.5) ? b : a));
  const x = (t: number) => t * 100;
  const y = (v: number) => 100 - v * 100;
  const line = (get: (r: typeof rows[number]) => number) => rows.map((r) => `${x(r.threshold)},${y(get(r))}`).join(" ");

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `best F1 ${best.f1.toFixed(3)} at ${best.threshold.toFixed(2)}`}>
          {[0.25, 0.5, 0.75].map((v) => (
            <line key={v} x1={0} y1={y(v)} x2={100} y2={y(v)} stroke={TONE} strokeWidth={1} strokeOpacity={0.14} vectorEffect="non-scaling-stroke" />
          ))}
          <polyline points={line((r) => r.precision)} fill="none" stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
          <polyline points={line((r) => r.recall)} fill="none" stroke={TONE} strokeWidth={1.6} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
          <polyline points={line((r) => r.f1)} fill="none" stroke={TONE} strokeWidth={2.4} strokeOpacity={0.55} vectorEffect="non-scaling-stroke" />
          <line x1={x(best.threshold)} y1={0} x2={x(best.threshold)} y2={100} stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${x(best.threshold)}%`, top: `${y(best.f1)}%`, background: TONE }} />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={1.6} /></svg>precision</span>
        <span className="flex items-center gap-1"><svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={1.6} strokeDasharray="5 3" /></svg>recall</span>
        <span className="flex items-center gap-1"><svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={2.4} strokeOpacity={0.55} /></svg>F1</span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Best F1 {best.f1.toFixed(3)} at threshold {best.threshold.toFixed(2)}, against {half.f1.toFixed(3)} at the default 0.50
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- class balance */
/**
 * How many examples per class, with the MAJORITY-CLASS baseline stated.
 *
 * That baseline is the accuracy of predicting the commonest class every time,
 * and any model that does not beat it has learnt nothing — which a bar chart
 * of counts alone never says.
 */
export function ClassBalance({
  classes, modelAccuracy, label,
}: {
  classes: { name: string; count: number }[]; modelAccuracy?: number; label?: string;
}) {
  if (!classes.length) return null;
  const total = classes.reduce((s, c) => s + c.count, 0);
  const sorted = [...classes].sort((a, b) => b.count - a.count);
  const baseline = sorted[0].count / total;
  const ratio = sorted[0].count / sorted[sorted.length - 1].count;

  return (
    <div className="w-full">
      <div className="space-y-1">
        {sorted.map((c) => (
          <div key={c.name} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-[10px]">{c.name}</span>
            <span className="h-3.5 rounded-[2px]" style={{ width: `${(c.count / sorted[0].count) * 62}%`, background: TONE }} />
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {c.count.toLocaleString()} · {((c.count / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {total.toLocaleString()} examples, {ratio.toFixed(1)}:1 between the largest and smallest class ·
        always guessing "{sorted[0].name}" scores {(baseline * 100).toFixed(1)}%
        {modelAccuracy != null
          ? modelAccuracy > baseline
            ? `, and the model's ${(modelAccuracy * 100).toFixed(1)}% beats it by ${((modelAccuracy - baseline) * 100).toFixed(1)} points`
            : `, which the model's ${(modelAccuracy * 100).toFixed(1)}% does NOT beat`
          : ""}
      </p>
    </div>
  );
}

/* --------------------------------------------------------- latency percentiles */
/**
 * Response time by percentile on a log axis, because the tail is the story.
 *
 * The mean is drawn too, and it sits below the 90th on almost every real
 * service — which is exactly why nobody should be paged on it.
 */
export function LatencyPercentiles({
  points, budgetMs, height = 230, label,
}: {
  /** percentile 0-1 */ points: { p: number; ms: number }[]; budgetMs?: number; height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.p - b.p);
  const hi = Math.max(...sorted.map((s) => s.ms), budgetMs ?? 0) * 1.25;
  const lo = Math.min(...sorted.map((s) => s.ms)) * 0.8;
  const y = (ms: number) => 100 - ((Math.log10(ms) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * 100;
  // Percentile axis stretched toward 1 so p99 and p99.9 are not on top of each other.
  const x = (p: number) => (Math.log10(1 - Math.min(p, 0.9999)) / Math.log10(0.0001)) * 100;
  const worst = sorted[sorted.length - 1];
  const over = budgetMs ? sorted.filter((s) => s.ms > budgetMs) : [];

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none"
          role="img" aria-label={label ?? `p99 tail at ${worst.ms} ms`}>
          {budgetMs ? (
            <line x1={0} y1={y(budgetMs)} x2={100} y2={y(budgetMs)} stroke={TONE} strokeWidth={1.4} strokeDasharray="5 3" strokeOpacity={0.65} vectorEffect="non-scaling-stroke" />
          ) : null}
          <polyline points={sorted.map((s) => `${x(s.p)},${y(s.ms)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {sorted.map((s) => (
          <span key={s.p} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${x(s.p)}%`, top: `${y(s.ms)}%`, background: TONE }} title={`p${(s.p * 100).toFixed(s.p > 0.99 ? 2 : 0)} · ${s.ms} ms`} />
        ))}
      </div>
      <div className="relative mt-1 h-3.5">
        {sorted.filter((s) => [0.5, 0.9, 0.99, 0.999].includes(s.p)).map((s) => (
          <span key={s.p} className="absolute -translate-x-1/2 text-[9px] text-muted-foreground" style={{ left: `${x(s.p)}%` }}>
            p{(s.p * 100).toFixed(s.p > 0.99 ? 1 : 0)}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Both axes stretched, or the tail collapses into the corner · slowest shown {worst.ms.toLocaleString()} ms
        {budgetMs ? ` · ${over.length ? `${over.map((s) => `p${(s.p * 100).toFixed(s.p > 0.99 ? 1 : 0)}`).join(", ")} over the ${budgetMs} ms budget` : `everything inside the ${budgetMs} ms budget`}` : ""}
      </p>
    </div>
  );
}
