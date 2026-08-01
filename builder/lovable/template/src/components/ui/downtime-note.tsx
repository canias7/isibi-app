import { cn } from "@/lib/utils";
/**
 * A stoppage recorded — with the cause, not just the length.
 *
 * PLANNED AND UNPLANNED ARE COUNTED APART. Mixing a scheduled tool change into
 * the same total as a breakdown makes the number look worse and the trend
 * unreadable — and the only actionable half is the unplanned one.
 *
 * THE CAUSE IS CATEGORISED AND ALSO WRITTEN. A category makes a Pareto
 * possible; the free text is what an engineer actually reads, and either alone
 * gives you a chart nobody can act on or a pile of notes nobody can total.
 *
 * WHETHER IT RECURRED IS PART OF THE RECORD. The same fault three times this
 * week is a different conversation from three unrelated faults, and it is the
 * fact a downtime log exists to surface.
 *
 * THE LOST OUTPUT IS SHOWN WHERE THE CALLER KNOWS THE RATE, because minutes
 * persuade nobody and "about 340 units" gets the repair authorised.
 */
export type DowntimeCause = "breakdown" | "changeover" | "material" | "quality" | "operator" | "planned" | "other";

const WORDS: Record<DowntimeCause, string> = {
  breakdown: "Breakdown",
  changeover: "Changeover",
  material: "Waiting for material",
  quality: "Quality problem",
  operator: "No operator",
  planned: "Planned",
  other: "Other",
};

export function DowntimeNote({ machine, minutes, cause, note, at, planned, timesThisWeek, lostUnits, className }: {
  machine?: string;
  minutes: number;
  cause: DowntimeCause;
  note?: string;
  /** Free text — "Tuesday, 14:20". */
  at?: string;
  planned?: boolean;
  /** How often this same cause has hit recently. */
  timesThisWeek?: number;
  /** Output lost, where the caller knows the rate. */
  lostUnits?: number;
  className?: string;
}) {
  const fmt = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`);
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {WORDS[cause]}
          {machine && <span className="text-muted-foreground"> · {machine}</span>}
        </span>
        <span className={cn("shrink-0 tabular-nums", !planned && "font-medium")}>{fmt(minutes)}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {planned ? "Planned" : "Unplanned"}
        {at && ` · ${at}`}
        {lostUnits !== undefined && ` · about ${lostUnits} units lost`}
      </p>
      {note && <p className="text-xs">{note}</p>}
      {timesThisWeek !== undefined && timesThisWeek > 1 && (
        <p className="text-xs font-medium tabular-nums">
          {timesThisWeek} times this week — this is recurring, not a one-off.
        </p>
      )}
    </li>
  );
}
