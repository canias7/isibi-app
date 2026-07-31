/** Model-evaluation charts. Everything deterministic. */

const TONE = "var(--foreground)";
const SHADE = (t: number) => `color-mix(in oklch, var(--foreground) ${Math.round(8 + t * 84)}%, var(--muted))`;

const frame = (children: React.ReactNode, height: number, aria: string) => (
  <div className="relative w-full" style={{ height }} role="img" aria-label={aria}>{children}</div>
);

/* ------------------------------------------------------------- ROC curve */
/**
 * True-positive rate against false-positive rate.
 *
 * The diagonal is drawn always: a ROC curve without the chance line is
 * unreadable, because "good" is defined entirely by distance from it.
 */
export function RocCurve({
  curves, size = 250, label,
}: {
  curves: { label: string; points: { fpr: number; tpr: number }[] }[];
  size?: number; label?: string;
}) {
  if (!curves.length) return null;
  const auc = (pts: { fpr: number; tpr: number }[]) => {
    const s = [...pts].sort((a, b) => a.fpr - b.fpr);
    let a = 0;
    for (let i = 1; i < s.length; i++) a += ((s[i].fpr - s[i - 1].fpr) * (s[i].tpr + s[i - 1].tpr)) / 2;
    return a;
  };
  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `ROC for ${curves.length} models`}>
        <line x1={0} y1={100} x2={100} y2={0} stroke="var(--border)" strokeDasharray="3 3" />
        {curves.map((c, i) => (
          <polyline key={c.label} points={c.points.map((p) => `${p.fpr * 100},${100 - p.tpr * 100}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={i === 0 ? 2 : 1.2} strokeOpacity={i === 0 ? 1 : 0.45}
            strokeDasharray={i === 0 ? undefined : "4 3"} />
        ))}
      </svg>
      <div className="mt-1 space-y-0.5">
        {curves.map((c) => (
          <div key={c.label} className="text-[10px] text-muted-foreground">
            {c.label} · AUC {auc(c.points).toFixed(3)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------- precision-recall */
/** Precision against recall, with the base rate as the no-skill line. */
export function PrecisionRecall({
  points, baseRate, size = 250, label,
}: {
  points: { recall: number; precision: number }[]; baseRate?: number; size?: number; label?: string;
}) {
  if (!points.length) return null;
  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? "Precision against recall"}>
        {baseRate !== undefined ? (
          <line x1={0} y1={100 - baseRate * 100} x2={100} y2={100 - baseRate * 100}
            stroke="var(--border)" strokeDasharray="3 3" />
        ) : null}
        <polyline points={points.map((p) => `${p.recall * 100},${100 - p.precision * 100}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2} />
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Recall across, precision up{baseRate !== undefined ? ` · dashed is the ${Math.round(baseRate * 100)}% base rate` : ""}
      </p>
    </div>
  );
}

/* ------------------------------------------------------ confusion matrix */
/**
 * Predicted against actual.
 *
 * Every cell carries its COUNT and its row share. A confusion matrix shaded
 * on raw counts alone is dominated by whichever class is largest, which is
 * exactly the case where the model is worst and the picture says least.
 */
export function ConfusionMatrix({
  classes, matrix, cell = 72, label,
}: {
  classes: string[]; /** matrix[actual][predicted] */ matrix: number[][]; cell?: number; label?: string;
}) {
  if (!classes.length) return null;
  const rowTotals = matrix.map((r) => r.reduce((s, v) => s + v, 0) || 1);
  const correct = classes.reduce((s, _, i) => s + (matrix[i]?.[i] ?? 0), 0);
  const grand = rowTotals.reduce((s, v) => s + v, 0);

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `Confusion across ${classes.length} classes`}>
      <table className="border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th />
            {classes.map((c) => (
              <th key={c} className="pb-1 text-[10px] font-normal text-muted-foreground" style={{ width: cell }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {classes.map((a, ri) => (
            <tr key={a}>
              <th className="pr-2 text-right text-[10px] font-normal whitespace-nowrap text-muted-foreground">{a}</th>
              {classes.map((pcls, ci) => {
                const v = matrix[ri]?.[ci] ?? 0;
                const share = v / rowTotals[ri];
                return (
                  <td key={pcls} className="p-0">
                    <div className="flex flex-col items-center justify-center rounded-[3px] leading-tight"
                      style={{ width: cell, height: cell, background: SHADE(share), color: share > 0.45 ? "var(--background)" : "var(--foreground)" }}
                      title={`Actual ${a}, predicted ${pcls}: ${v}`}>
                      <span className="text-[12px] font-medium tabular-nums">{v}</span>
                      <span className="text-[9px] opacity-75 tabular-nums">{Math.round(share * 100)}%</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Rows are actual, columns predicted · {Math.round((correct / grand) * 100)}% correct · shaded by row share
      </p>
    </div>
  );
}

/* ------------------------------------------------------- calibration plot */
/** Predicted probability against what actually happened. */
export function CalibrationPlot({
  bins, size = 250, label,
}: {
  bins: { predicted: number; observed: number; count: number }[]; size?: number; label?: string;
}) {
  if (!bins.length) return null;
  const maxN = Math.max(...bins.map((b) => b.count)) || 1;
  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? "Predicted probability against observed rate"}>
        <line x1={0} y1={100} x2={100} y2={0} stroke="var(--border)" strokeDasharray="3 3" />
        <polyline points={bins.map((b) => `${b.predicted * 100},${100 - b.observed * 100}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={1.4} />
        {bins.map((b, i) => (
          <circle key={i} cx={b.predicted * 100} cy={100 - b.observed * 100}
            r={1.6 + Math.sqrt(b.count / maxN) * 3} fill={TONE} fillOpacity={0.75}>
            <title>{`Predicted ${Math.round(b.predicted * 100)}%, observed ${Math.round(b.observed * 100)}% (${b.count})`}</title>
          </circle>
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">Dot area is how many fell in the bin · dashed is perfect</p>
    </div>
  );
}

/* --------------------------------------------------------- lift and gains */
/** Cumulative gains: what share of positives the top N% captures. */
export function GainsChart({
  points, height = 220, label,
}: {
  points: { population: number; captured: number }[]; height?: number; label?: string;
}) {
  if (!points.length) return null;
  return (
    <div className="w-full">
      {frame(
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <line x1={0} y1={100} x2={100} y2={0} stroke="var(--border)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <polyline points={points.map((p) => `${p.population * 100},${100 - p.captured * 100}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>,
        height, label ?? "Cumulative gains"
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">Dashed is contacting people at random</p>
    </div>
  );
}

/** Lift: how many times better than random each decile is. */
export function LiftChart({
  deciles, height = 200, label,
}: {
  deciles: number[]; height?: number; label?: string;
}) {
  if (!deciles.length) return null;
  const hi = Math.max(...deciles, 1);
  return (
    <div className="w-full">
      <div className="relative flex w-full items-end gap-1" style={{ height }}>
        <div className="absolute right-0 left-0 border-t border-dashed border-border" style={{ bottom: `${(1 / hi) * 100}%` }} />
        {deciles.map((d, i) => (
          <div key={i} className="flex-1 rounded-t-[2px]" style={{ height: `${(d / hi) * 100}%`, background: TONE, opacity: 0.85 }}
            title={`Decile ${i + 1}: ${d.toFixed(2)}x`} />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Dashed is 1× — no better than random</p>
    </div>
  );
}

/* ---------------------------------------------------- feature importance */
/** Which inputs the model leans on. Sorted, because ranking is the question. */
export function FeatureImportance({
  features, format = (n: number) => n.toFixed(2), label,
}: {
  features: { label: string; value: number }[]; format?: (n: number) => string; label?: string;
}) {
  const rows = [...features].sort((a, b) => b.value - a.value);
  if (!rows.length) return null;
  const hi = rows[0].value || 1;
  return (
    <div className="w-full space-y-1" role="img" aria-label={label ?? `${rows.length} features by importance`}>
      {rows.map((f) => (
        <div key={f.label} className="flex items-center gap-2">
          <span className="w-24 shrink-0 truncate text-right text-[10px] text-muted-foreground">{f.label}</span>
          <div className="h-3.5 flex-1 rounded-[2px] bg-muted">
            <div className="h-full rounded-[2px]" style={{ width: `${(f.value / hi) * 100}%`, background: TONE }} />
          </div>
          <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{format(f.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------- contribution waterfall */
/**
 * How one prediction was reached: a base value plus each feature's push.
 *
 * Sorted by MAGNITUDE, not by sign, so the biggest driver is at the top
 * whichever way it pushed.
 */
export function ContributionWaterfall({
  base, contributions, format = (n: number) => n.toFixed(2), rowHeight = 26, label,
}: {
  base: number; contributions: { label: string; value: number }[];
  format?: (n: number) => string; rowHeight?: number; label?: string;
}) {
  if (!contributions.length) return null;
  const rows = [...contributions].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const final = base + rows.reduce((s, r) => s + r.value, 0);
  const reach = Math.max(...rows.map((r) => Math.abs(r.value))) || 1;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Prediction ${format(final)} from a base of ${format(base)}`}>
      <div className="mb-2 flex justify-between text-[10px] text-muted-foreground">
        <span>base {format(base)}</span><span>prediction {format(final)}</span>
      </div>
      <div className="relative" style={{ height: rows.length * rowHeight }}>
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
        {rows.map((r, i) => {
          const w = (Math.abs(r.value) / reach) * 46;
          const up = r.value >= 0;
          return (
            <div key={r.label}>
              <div className="absolute rounded-[2px]"
                style={{
                  top: i * rowHeight + rowHeight * 0.2, height: rowHeight * 0.6,
                  left: up ? "50%" : `${50 - w}%`, width: `${w}%`,
                  background: TONE, opacity: up ? 0.85 : 0.3,
                  border: up ? undefined : `1px solid ${TONE}`,
                }} title={`${r.label}: ${up ? "+" : "−"}${format(Math.abs(r.value))}`} />
              <span className="absolute text-[10px] whitespace-nowrap text-muted-foreground"
                style={{ top: i * rowHeight + rowHeight * 0.22, left: up ? `calc(50% - 4px)` : `calc(${50 + w * 0}% + 4px)`, transform: up ? "translateX(-100%)" : undefined }}>
                {r.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Solid pushes up · outlined pushes down</p>
    </div>
  );
}
