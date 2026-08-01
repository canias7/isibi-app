import { cn } from "@/lib/utils";
/**
 * Progress toward a goal, as a ring, with the number in the middle.
 *
 * Plain SVG — two circles and a dash offset. Every chart library ships one of
 * these and none of them is worth a runtime dependency for an arc.
 *
 * THE NUMBER IN THE MIDDLE IS THE ACTUAL VALUE, not the percentage. "£8,400" is
 * what somebody is tracking; "70%" makes them multiply to find out what they
 * raised. The percentage goes underneath where it belongs.
 *
 * PAST 100% THE RING FILLS AND THE TEXT SAYS SO. A ring that wraps a second time
 * is unreadable and one that clamps silently hides the overshoot, which for a
 * fundraiser is the best news of the campaign.
 */
export function GoalGauge({ value, goal, label, unit = "", size = 120, className }: {
  value: number; goal: number; label?: string; unit?: string; size?: number;
  className?: string;
}) {
  if (goal <= 0) return null;
  const pct = (value / goal) * 100;
  const shown = Math.min(pct, 100);
  const r = 44, c = 2 * Math.PI * r;
  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
          className="stroke-foreground"
          strokeDasharray={c} strokeDashoffset={c - (shown / 100) * c} />
      </svg>
      <div className="-mt-[calc(50%+0.5rem)] flex flex-col items-center pb-[calc(50%-0.5rem)]">
        <span className="text-lg font-semibold tabular-nums">{unit}{value.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(pct)}% of {unit}{goal.toLocaleString()}
        </span>
      </div>
      {label && <span className="text-sm">{label}</span>}
      {pct > 100 && <span className="text-xs font-medium tabular-nums">{Math.round(pct - 100)}% over goal</span>}
    </div>
  );
}
