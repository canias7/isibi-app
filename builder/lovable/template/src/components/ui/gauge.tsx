import { cn } from "@/lib/utils";
/**
 * A half-dial for a bounded reading — capacity, score, load.
 *
 * The bounds are written under the arc. A gauge whose ends are unlabelled is
 * a needle pointing at nothing: 70 out of what?
 */
export function Gauge({ value, min = 0, max = 100, unit, label, size = 120, className }: {
  value: number; min?: number; max?: number; unit?: string;
  label?: string; size?: number; className?: string;
}) {
  const span = max - min || 1;
  const pct = Math.max(0, Math.min(1, (value - min) / span));
  const w = size, h = size / 2 + 8, r = (size - 14) / 2, cx = w / 2, cy = size / 2;
  const arc = Math.PI * r;
  return (
    <div className={cn("inline-flex flex-col items-center", className)}>
      <svg width={w} height={h} role="img" aria-label={label ?? `${value}${unit ?? ""} of ${max}${unit ?? ""}`}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="currentColor"
          strokeWidth="7" strokeLinecap="round" className="text-muted" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="currentColor"
          strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(arc * pct).toFixed(2)} ${arc.toFixed(2)}`} />
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-foreground text-lg font-semibold tabular-nums">
          {value}{unit}
        </text>
      </svg>
      <div className="flex w-full justify-between px-1 text-[10px] tabular-nums text-muted-foreground">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
      {label && <p className="mt-1 text-xs text-muted-foreground">{label}</p>}
    </div>
  );
}
