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
 * STATE IS CARRIED BY HOW MUCH OF THE SEGMENT IS FILLED, never by colour — and
 * on the VERTICAL axis specifically, which is the scar. It used to be filled /
 * hatched / hollow / dashed, all of which are horizontal distinctions, and at
 * 90 days in a normal column a segment is about four pixels wide. Rendered:
 * the hatch was indistinguishable from solid, the hollow outline read as solid,
 * and the dashed "unknown" disappeared entirely — so the component's own
 * guarantee that a partial day looks different from a down day held at 7 days,
 * held at 30, and was false at 90, which is the window every status page uses.
 *
 * Worse than merely unreadable: an unknown day rendering as a GAP undoes the
 * decision below it. Days with no data are drawn as absent rather than as up,
 * because assuming up is the flattering default every uptime strip takes — and
 * an absence nobody can see is that default arriving anyway.
 *
 * Height has room at any width, so: up is the full segment, partial is the
 * bottom half, down is a foot, unknown is the empty track. Legible down to one
 * pixel wide, and it survives greyscale and print because it is quantity of
 * fill rather than hue.
 *
 * `title` PER DAY so the detail is reachable with a pointer without a tooltip
 * library, and the whole history is in one `sr-only` sentence — a row of divs
 * is silent to a screen reader whatever it is filled with.
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
            className="relative h-5 flex-1 overflow-hidden rounded-sm bg-muted">
            {d.state === "up" && <span className="absolute inset-0 bg-foreground" />}
            {d.state === "partial" && <span className="absolute inset-x-0 bottom-0 h-1/2 bg-foreground" />}
            {d.state === "down" && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-foreground" />}
            {/* unknown is the bare track — the one state with nothing added. */}
          </span>
        ))}
      </div>
    </div>
  );
}
