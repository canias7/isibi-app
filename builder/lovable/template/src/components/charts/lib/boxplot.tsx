/**
 * Five-number summary per category: min, Q1, median, Q3, max.
 *
 * Quartiles are computed here rather than taken as props, because a caller that
 * has to work out its own quartiles will use a different interpolation from the
 * next caller and two charts on one page will disagree. Linear interpolation
 * (the R type-7 default) is used throughout.
 */
export type Box = { label: string; values: number[] };

const quantile = (sorted: number[], q: number) => {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
};

export function BoxPlot({
  boxes,
  height = 220,
  min,
  max,
  horizontal = false,
  showOutliers = true,
  format = (n: number) => String(Math.round(n)),
  label,
}: {
  boxes: Box[];
  height?: number;
  min?: number;
  max?: number;
  horizontal?: boolean;
  showOutliers?: boolean;
  format?: (n: number) => string;
  label?: string;
}) {
  if (!boxes.length) return null;

  const stats = boxes.map((b) => {
    const s = [...b.values].sort((x, y) => x - y);
    const q1 = quantile(s, 0.25);
    const med = quantile(s, 0.5);
    const q3 = quantile(s, 0.75);
    const iqr = q3 - q1;
    // Tukey fences: whiskers reach the furthest point still inside 1.5 IQR,
    // NOT to the extremes — otherwise a single stray value stretches the whisker
    // and the box looks tiny, which is the opposite of what it should show.
    const loF = q1 - 1.5 * iqr;
    const hiF = q3 + 1.5 * iqr;
    const inside = s.filter((v) => v >= loF && v <= hiF);
    return {
      label: b.label, q1, med, q3,
      lo: inside[0] ?? s[0],
      hi: inside[inside.length - 1] ?? s[s.length - 1],
      outliers: showOutliers ? s.filter((v) => v < loF || v > hiF) : [],
    };
  });

  const lo = min ?? Math.min(...stats.map((s) => Math.min(s.lo, ...s.outliers)));
  const hi = max ?? Math.max(...stats.map((s) => Math.max(s.hi, ...s.outliers)));
  const span = hi - lo || 1;
  const pos = (v: number) => ((v - lo) / span) * 100;

  const slot = 100 / stats.length;
  const boxW = slot * 0.5;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Distribution across ${boxes.length} groups`}>
      <div className="relative w-full" style={{ height }}>
        {stats.map((s, i) => {
          const centre = i * slot + slot / 2;
          const across = horizontal
            ? { top: `${centre}%`, height: `${boxW}%`, transform: "translateY(-50%)" }
            : { left: `${centre - boxW / 2}%`, width: `${boxW}%` };
          const along = (a: number, b: number) =>
            horizontal
              ? { left: `${pos(a)}%`, width: `${pos(b) - pos(a)}%` }
              : { top: `${100 - pos(b)}%`, height: `${pos(b) - pos(a)}%` };
          return (
            <div key={s.label}>
              {/* whisker */}
              <div className="absolute bg-border"
                style={
                  horizontal
                    ? { ...along(s.lo, s.hi), top: `${centre}%`, height: 1 }
                    : { ...along(s.lo, s.hi), left: `${centre}%`, width: 1 }
                } />
              {/* box */}
              <div className="absolute rounded-[2px] border border-foreground bg-background"
                style={{ ...across, ...along(s.q1, s.q3) }} title={`${s.label}: median ${format(s.med)}`} />
              {/* median */}
              <div className="absolute bg-foreground"
                style={
                  horizontal
                    ? { ...across, left: `${pos(s.med)}%`, width: 2 }
                    : { ...across, top: `${100 - pos(s.med)}%`, height: 2 }
                } />
              {s.outliers.map((o, oi) => (
                <div key={oi} className="absolute h-1 w-1 rounded-full bg-muted-foreground"
                  style={
                    horizontal
                      ? { left: `${pos(o)}%`, top: `${centre}%`, transform: "translate(-50%,-50%)" }
                      : { top: `${100 - pos(o)}%`, left: `${centre}%`, transform: "translate(-50%,-50%)" }
                  } title={`Outlier ${format(o)}`} />
              ))}
            </div>
          );
        })}
        {/* Horizontal needs its categories named too. An earlier version
            guarded the label row on !horizontal and shipped rows of unlabelled
            boxes, which is a distribution of nothing in particular. */}
        {horizontal
          ? stats.map((s, i) => (
              <div key={`${s.label}-lab`}
                className="pointer-events-none absolute left-0 -translate-y-1/2 pr-1 text-[10px] text-muted-foreground"
                style={{ top: `${i * slot + slot / 2}%` }}>
                {s.label}
              </div>
            ))
          : null}
      </div>
      {!horizontal && (
        <div className="flex">
          {stats.map((s) => (
            <div key={s.label} className="truncate px-1 text-center text-[10px] text-muted-foreground"
              style={{ width: `${slot}%` }}>
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function sampleBoxes(labels: string[], seed = 9): Box[] {
  let s = seed;
  const next = () => { s = (s * 1103515245 + 12345) % 2147483648; return (s % 1000) / 1000; };
  return labels.map((label, i) => ({
    label,
    values: Array.from({ length: 24 }, () => Math.round(20 + i * 6 + (next() + next() - 1) * 22))
      .concat(i === 1 ? [96] : []),
  }));
}
