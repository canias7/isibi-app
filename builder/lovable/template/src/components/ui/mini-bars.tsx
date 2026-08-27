import { cn } from "@/lib/utils";
/**
 * A tiny bar column — days of the week, hours of the day.
 *
 * Every bar keeps a 2px floor so a zero day is still a visible slot rather
 * than a gap that reads as missing data.
 */
export function MiniBars({ values, height = 28, label, highlight, className }: {
  values: number[]; height?: number; label?: string; highlight?: number; className?: string;
}) {
  if (!values.length) return null;
  const hi = Math.max(...values) || 1;
  return (
    <div data-slot="mini-bars" className={cn("flex items-end gap-0.5", className)} style={{ height }}
      role="img" aria-label={label ?? `${values.length} bars, peak ${hi}`}>
      {values.map((v, i) => (
        <span key={i} className={cn("min-h-[2px] flex-1 rounded-[1px]",
          i === highlight ? "bg-foreground" : "bg-foreground/25")}
          style={{ height: `${Math.round((v / hi) * 100)}%` }} />
      ))}
    </div>
  );
}
