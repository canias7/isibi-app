import { cn } from "@/lib/utils";
/** A circular percentage. Plain SVG — no chart library for one number. */
export function ProgressRing({ value, size = 64, thickness = 6, label, className }: {
  value: number; size?: number; thickness?: number; label?: string; className?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}
      role="img" aria-label={label ?? `${v}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={thickness} className="stroke-muted" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={thickness} strokeLinecap="round"
          className="stroke-foreground" strokeDasharray={c} strokeDashoffset={c - (c * v) / 100} />
      </svg>
      <span className="absolute text-xs font-medium tabular-nums">{Math.round(v)}%</span>
    </div>
  );
}
