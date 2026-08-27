import { cn } from "@/lib/utils";
/**
 * Hours used against hours agreed.
 *
 * A retainer, a support plan, a fixed-price job. The number people care about
 * is what is LEFT, so that leads; used-of-total is the supporting detail, not
 * the headline.
 *
 * OVERSPEND IS SHOWN, NOT CLAMPED. A bar that stops at 100% hides the fact that
 * a 40-hour retainer is at 52 hours, which is precisely the moment somebody
 * needed to know. Past the line it says "12h over" in words and the bar stays
 * full — a bar cannot express 130% honestly, so the words do it.
 *
 * Hours are formatted as hours and minutes rather than decimals: "7h 30m" is
 * how time is discussed and 7.5 is how it is stored, and showing the storage
 * format is a small tax on every reader.
 *
 * No colour. The overspend reads as bold text and the word "over", which
 * survives greyscale and a screen reader — where a bar turning red says nothing
 * to either.
 */
function hm(minutes: number) {
  const sign = minutes < 0 ? "-" : "";
  const m = Math.abs(Math.round(minutes));
  const h = Math.floor(m / 60), r = m % 60;
  return `${sign}${h ? `${h}h` : ""}${h && r ? " " : ""}${r || !h ? `${r}m` : ""}`;
}

export function TimeBudget({ usedMinutes, totalMinutes, label = "Time", className }: {
  usedMinutes: number;
  totalMinutes: number;
  label?: string;
  className?: string;
}) {
  if (totalMinutes <= 0) return null;
  const left = totalMinutes - usedMinutes;
  const over = left < 0;
  const pct = Math.min(Math.round((usedMinutes / totalMinutes) * 100), 100);

  return (
    <div data-slot="time-budget" className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("text-sm tabular-nums", over && "font-medium")}>
          {over ? `${hm(-left)} over` : `${hm(left)} left`}
        </span>
      </div>
      <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
        aria-label={label}
        className={cn("h-1.5 overflow-hidden rounded-full bg-muted", over && "ring-1 ring-foreground")}>
        <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {hm(usedMinutes)} of {hm(totalMinutes)} used
      </p>
    </div>
  );
}
