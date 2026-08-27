import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The "you are here" line across a day timetable.
 *
 * It ticks itself once a minute and returns null outside the visible window,
 * so a Tuesday view does not draw a marker at Tuesday's time on a page showing
 * Friday. `dayStart`/`dayEnd` are hours, matching how the grid is laid out.
 */
export function NowLine({ dayStart = 8, dayEnd = 20, date, className }: {
  dayStart?: number; dayEnd?: number; date?: Date; className?: string;
}) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (date && date.toDateString() !== now.toDateString()) return null;
  const hours = now.getHours() + now.getMinutes() / 60;
  if (hours < dayStart || hours > dayEnd) return null;
  const pct = ((hours - dayStart) / (dayEnd - dayStart)) * 100;
  return (
    <div data-slot="now-line" className={cn("pointer-events-none absolute inset-x-0 z-10 flex items-center", className)}
      style={{ top: `${pct}%` }} aria-hidden="true">
      <span className="size-2 shrink-0 rounded-full bg-destructive" />
      <span className="h-px flex-1 bg-destructive" />
    </div>
  );
}
