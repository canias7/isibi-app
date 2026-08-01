import { cn } from "@/lib/utils";
/**
 * Availability over a run of days, as a strip of segments.
 *
 * A PARTIAL DAY IS DRAWN DIFFERENTLY FROM A DOWN DAY. A twenty-minute outage
 * and eight hours down are both "not 100%", and a two-state strip shows them
 * identically — which makes a good month look like a bad one, or hides a real
 * incident inside a mostly-fine day.
 *
 * THE PERCENTAGE IS PRINTED, because a strip conveys shape and not magnitude.
 * 99.9% and 99% look nearly the same as segments and differ by eight hours a
 * year.
 *
 * SEGMENTS ARE FILLED, HATCHED AND HOLLOW rather than green/amber/red, and the
 * whole history is in one `sr-only` sentence — a row of coloured divs is silent
 * to a screen reader and meaningless in print.
 *
 * `title` PER DAY so the detail is reachable with a pointer without a tooltip
 * library, and days with no data are drawn as absent rather than as up — which
 * is the flattering default every uptime strip takes.
 */
export type UptimeDay = { date: string; state: "up" | "partial" | "down" | "unknown"; note?: string };

export function UptimeStrip({ days, percent, label = "Availability", className }: {
  /** Oldest first. */
  days: UptimeDay[];
  /** Overall percentage for the period. */
  percent?: number;
  label?: string;
  className?: string;
}) {
  if (!days.length) return null;
  const bad = days.filter((d) => d.state === "down" || d.state === "partial").length;
  return (
    <div className={cn("space-y-1", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        {percent !== undefined && <span className="font-medium tabular-nums">{percent}%</span>}
        <span className="text-xs text-muted-foreground">
          {bad === 0 ? "no interruptions" : `${bad} ${bad === 1 ? "day" : "days"} affected`} over {days.length} days
        </span>
      </p>
      <span className="sr-only">
        {days.map((d) => `${d.date}: ${d.state}`).join("; ")}
      </span>
      <div aria-hidden="true" className="flex gap-px">
        {days.map((d) => (
          <span key={d.date} title={`${d.date}${d.note ? ` — ${d.note}` : ""}`}
            className={cn("h-5 flex-1 rounded-sm",
              d.state === "up" && "bg-foreground",
              d.state === "partial" && "bg-[repeating-linear-gradient(45deg,var(--color-foreground)_0_2px,transparent_2px_4px)]",
              d.state === "down" && "border border-foreground",
              d.state === "unknown" && "border border-dashed border-border")} />
        ))}
      </div>
    </div>
  );
}
