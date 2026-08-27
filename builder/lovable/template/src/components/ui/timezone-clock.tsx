import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The time somewhere else, honestly labelled.
 *
 * BUILT ON `Intl.DateTimeFormat` WITH `timeZone` — never an offset added
 * by hand, because offsets change twice a year on dates that differ per
 * country, and hand-rolled zone maths is wrong for two weeks every
 * spring somewhere.
 *
 * THE DIFFERENCE FROM THE VIEWER IS STATED ("3h ahead") because that is
 * the number people are computing in their head anyway — and it is
 * computed by comparing rendered wall times, not offsets, so DST on
 * either side is already in it.
 *
 * TICKS PER MINUTE. A wall clock has no seconds hand worth paying a
 * re-render every second for; seconds belong to the stopwatch.
 */
export function zoneDiffHours(zone: string, now = new Date()): number | null {
  try {
    const wall = (tz?: string) =>
      new Date(now.toLocaleString("en-US", tz ? { timeZone: tz } : {})).getTime();
    // Quarter-hour resolution: Nepal is :45 and Eucla is +8:45 - rounding
    // to halves relabelled Eucla "9h ahead" in the same breath as calling
    // it the +8:45 zone. Caught on a render.
    return Math.round(((wall(zone) - wall(undefined)) / 36e5) * 4) / 4;
  } catch { return null; }
}

export function diffWords(diff: number): string {
  const h = Math.floor(Math.abs(diff));
  const m = Math.round((Math.abs(diff) - h) * 60);
  const span = m ? `${h}h${String(m).padStart(2, "0")}m` : `${h}h`;
  return `${span} ${diff > 0 ? "ahead" : "behind"}`;
}

export function TimezoneClock({ zone, label, className }: {
  zone: string;
  label?: React.ReactNode;
  className?: string;
}) {
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  let time = "—";
  try {
    time = new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(new Date());
  } catch { /* unknown zone renders a dash, not a crash */ }
  const diff = zoneDiffHours(zone);
  const diffLabel = diff == null || diff === 0 ? "same time" : diffWords(diff);

  return (
    <span data-slot="timezone-clock" className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span className="text-sm font-medium tabular-nums">{time}</span>
      <span className="text-xs text-muted-foreground">{label ?? zone.split("/").pop()?.replace(/_/g, " ")} · {diffLabel}</span>
    </span>
  );
}
