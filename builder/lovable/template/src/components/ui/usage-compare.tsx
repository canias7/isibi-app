import { cn } from "@/lib/utils";
/**
 * This period against the last one — with the reason it is not a fair fight.
 *
 * WEATHER IS THE DOMINANT VARIABLE AND IS NAMED. Heating use rises with a cold
 * month by far more than any behaviour change, and a comparison presenting a
 * rise as the household's doing is simply wrong most of the time. Where the
 * caller can supply the difference in heating demand, it is shown.
 *
 * PERIOD LENGTH IS NORMALISED. A 28-day month against a 31-day one is a 10%
 * fall that nobody caused, and it is the most common false signal in this
 * comparison.
 *
 * THE COMPARISON TO SIMILAR HOMES IS OPTIONAL AND HEDGED. It is motivating for
 * some and a source of misplaced guilt for others — a household with a
 * medically necessary heated room is not overusing — so it appears only when
 * the caller asks for it, and it never scolds.
 *
 * DIRECTION IS WRITTEN, not signed. "12% more" and "12% less" are read
 * instantly; "+12%" needs a convention the reader has to know.
 */
export function UsageCompare({ current, previous, currentDays, previousDays, unit = "kWh", periodLabel, previousLabel, colderNote, similarHomes, className }: {
  current: number;
  previous: number;
  currentDays?: number;
  previousDays?: number;
  unit?: string;
  /** Free text — "July". */
  periodLabel?: string;
  previousLabel?: string;
  /** Free text — "3°C colder on average than last July". */
  colderNote?: string;
  /** Typical use for comparable homes, same period. */
  similarHomes?: number;
  className?: string;
}) {
  const perDay = (v: number, d?: number) => (d && d > 0 ? v / d : undefined);
  const a = perDay(current, currentDays);
  const b = perDay(previous, previousDays);
  const comparable = a !== undefined && b !== undefined;
  const change = comparable ? (a - b) / (b || 1) : previous > 0 ? (current - previous) / previous : 0;
  const pct = Math.abs(Math.round(change * 100));
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="tabular-nums">
          {pct === 0 ? "About the same as" : `${pct}% ${change > 0 ? "more" : "less"} than`}
        </span>
        <span className="text-muted-foreground"> {previousLabel ?? "the period before"}</span>
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {periodLabel ? `${periodLabel}: ` : ""}{current.toLocaleString()} {unit}
        {` · ${previousLabel ?? "before"}: ${previous.toLocaleString()} ${unit}`}
        {comparable && ` · compared per day, not per period`}
      </p>
      {colderNote && (
        <p className="text-xs text-muted-foreground">{colderNote} — most of any rise in heating is that, not you.</p>
      )}
      {similarHomes !== undefined && (
        <p className="text-xs text-muted-foreground tabular-nums">
          Similar homes used about {similarHomes.toLocaleString()} {unit}. Homes differ for good reasons.
        </p>
      )}
    </div>
  );
}
