import { cn } from "@/lib/utils";
/**
 * A trend line, inline, with no charting library.
 *
 * The range is padded when every value is equal, or the line divides by zero
 * and disappears — a flat week is exactly when somebody looks.
 */
export function Sparkline({ values, width = 96, height = 24, label, className }: {
  values: number[]; width?: number; height?: number; label?: string; className?: string;
}) {
  if (!values.length) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const pts = values.map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - lo) / span) * (height - 2) - 1).toFixed(2)}`);
  const last = values[values.length - 1];
  return (
    <svg data-slot="sparkline" viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={cn("overflow-visible", className)}
      role="img" aria-label={label ?? `Trend, ${values.length} points, latest ${last}`}>
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(values.length - 1) * step} cy={height - ((last - lo) / span) * (height - 2) - 1} r="1.75" fill="currentColor" />
    </svg>
  );
}
