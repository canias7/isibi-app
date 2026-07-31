/**
 * A distribution's shape, mirrored about its axis.
 *
 * Where a box plot gives five numbers, this shows whether the data is one lump
 * or two — a bimodal distribution reads as a perfectly ordinary box, which is
 * the one thing a box plot cannot tell you.
 *
 * Density is a Gaussian kernel estimate. The bandwidth defaults to Silverman's
 * rule rather than a fixed number, because a fixed bandwidth is either a comb
 * or a blob depending entirely on the scale of whatever was passed in.
 */
export type Violin = { label: string; values: number[] };

const gauss = (u: number) => Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);

function density(values: number[], lo: number, hi: number, steps: number, bw?: number) {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n || 1)) || 1;
  const h = bw ?? 1.06 * sd * Math.pow(n || 1, -1 / 5);
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const x = lo + ((hi - lo) * i) / (steps - 1);
    out.push(values.reduce((s, v) => s + gauss((x - v) / h), 0) / (n * h));
  }
  return out;
}

export function ViolinPlot({
  violins,
  height = 240,
  steps = 48,
  min,
  max,
  bandwidth,
  showMedian = true,
  showBox = false,
  label,
}: {
  violins: Violin[];
  height?: number;
  steps?: number;
  min?: number;
  max?: number;
  bandwidth?: number;
  showMedian?: boolean;
  showBox?: boolean;
  label?: string;
}) {
  if (!violins.length) return null;

  const all = violins.flatMap((v) => v.values);
  const lo = min ?? Math.min(...all);
  const hi = max ?? Math.max(...all);

  const shapes = violins.map((v) => {
    const d = density(v.values, lo, hi, steps, bandwidth);
    const sorted = [...v.values].sort((a, b) => a - b);
    return {
      label: v.label,
      d,
      peak: Math.max(...d) || 1,
      median: sorted[Math.floor(sorted.length / 2)],
      q1: sorted[Math.floor(sorted.length * 0.25)],
      q3: sorted[Math.floor(sorted.length * 0.75)],
    };
  });

  // Normalised across ALL violins, so a wide one really does hold more than a
  // narrow one. Per-violin normalisation makes every group look identical.
  const globalPeak = Math.max(...shapes.map((s) => s.peak));
  const slot = 100 / shapes.length;
  const y = (v: number) => ((hi - v) / (hi - lo || 1)) * 100;

  return (
    <div className="w-full" role="img" aria-label={label ?? `Distribution shape across ${violins.length} groups`}>
      <div className="relative w-full" style={{ height }}>
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {shapes.map((s, i) => {
            const centre = i * slot + slot / 2;
            const halfMax = slot * 0.42;
            const right = s.d.map((v, k) => {
              const py = 100 - (k / (steps - 1)) * 100;
              return `${centre + (v / globalPeak) * halfMax},${py}`;
            });
            const left = [...s.d].map((v, k) => {
              const py = 100 - (k / (steps - 1)) * 100;
              return `${centre - (v / globalPeak) * halfMax},${py}`;
            }).reverse();
            return (
              <polygon key={s.label} points={[...right, ...left].join(" ")}
                fill="var(--foreground)" fillOpacity={0.18}
                stroke="var(--foreground)" strokeOpacity={0.55} strokeWidth={0.4}
                vectorEffect="non-scaling-stroke" />
            );
          })}
          {showBox
            ? shapes.map((s, i) => {
                const centre = i * slot + slot / 2;
                return (
                  <rect key={`${s.label}-box`} x={centre - 1.2} width={2.4}
                    y={y(s.q3)} height={Math.max(0.4, y(s.q1) - y(s.q3))}
                    fill="var(--foreground)" fillOpacity={0.35} />
                );
              })
            : null}
          {showMedian
            ? shapes.map((s, i) => {
                const centre = i * slot + slot / 2;
                return (
                  <line key={`${s.label}-med`} x1={centre - slot * 0.2} x2={centre + slot * 0.2}
                    y1={y(s.median)} y2={y(s.median)} stroke="var(--foreground)" strokeWidth={2}
                    vectorEffect="non-scaling-stroke" />
                );
              })
            : null}
        </svg>
      </div>
      <div className="flex">
        {shapes.map((s) => (
          <div key={s.label} className="truncate px-1 text-center text-[10px] text-muted-foreground"
            style={{ width: `${slot}%` }}>
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** One group is deliberately BIMODAL — the case a box plot cannot show. */
export function sampleViolins(labels: string[], seed = 15): Violin[] {
  let s = seed;
  const next = () => { s = (s * 1103515245 + 12345) % 2147483648; return (s % 1000) / 1000; };
  return labels.map((label, i) => ({
    label,
    values: Array.from({ length: 90 }, (_, k) => {
      const g = (next() + next() + next()) / 3 - 0.5;
      if (i === 1) return Math.round((k % 2 ? 28 : 66) + g * 26);
      return Math.round(42 + i * 5 + g * 46);
    }),
  }));
}
