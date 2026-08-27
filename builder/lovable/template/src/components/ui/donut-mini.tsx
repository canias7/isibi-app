import { cn } from "@/lib/utils";
/**
 * A single-value ring with the number in the middle.
 *
 * One value, never a pie of many — a monochrome kit cannot tell four slices
 * apart, and a pie of four greys is a puzzle rather than a chart. For a
 * breakdown use `RatioBar`, which labels its parts.
 */
export function DonutMini({ value, max = 100, size = 56, label, className }: {
  value: number; max?: number; size?: number; label?: string; className?: string;
}) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return (
    <div data-slot="donut-mini" className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img"
        aria-label={label ?? `${Math.round(pct * 100)} percent`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="5"
          strokeLinecap="round" strokeDasharray={`${(c * pct).toFixed(2)} ${c.toFixed(2)}`} />
      </svg>
      <span className="absolute text-xs font-medium tabular-nums">{Math.round(pct * 100)}%</span>
    </div>
  );
}
