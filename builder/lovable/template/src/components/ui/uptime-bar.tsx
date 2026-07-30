import { cn } from "@/lib/utils";
/**
 * Ninety days of service, one bar per day.
 *
 * Colour AND height carry the state — a degraded day is shorter as well as
 * amber — so the row still reads in greyscale and to anyone who cannot tell
 * the two hues apart. Days are oldest-first, left to right.
 */
export function UptimeBar({ days, label, className }: {
  days: { date: string; state: "up" | "degraded" | "down" | "unknown" }[];
  label?: string; className?: string;
}) {
  const tone = { up: "bg-success h-full", degraded: "bg-warning h-2/3 self-end", down: "bg-destructive h-1/2 self-end", unknown: "bg-muted h-full" };
  const up = days.filter((d) => d.state === "up").length;
  const pct = days.length ? (up / days.length) * 100 : 0;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex h-8 items-stretch gap-px" role="img"
        aria-label={label ?? `${pct.toFixed(1)}% up over ${days.length} days`}>
        {days.map((d) => (
          <span key={d.date} title={`${d.date}: ${d.state}`}
            className={cn("flex-1 rounded-[1px]", tone[d.state])} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{days.length} days ago</span>
        <span className="tabular-nums">{pct.toFixed(2)}% up</span>
        <span>Today</span>
      </div>
    </div>
  );
}
