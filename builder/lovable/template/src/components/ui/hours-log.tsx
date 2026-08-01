import { cn } from "@/lib/utils";
/**
 * Hours given — recorded for the funder, not to judge anybody.
 *
 * IT SAYS WHY THE HOURS ARE COUNTED. Volunteers reasonably resent being
 * clocked, and the honest answer — grant reporting, insurance, an award scheme
 * — makes the request reasonable. A log with no stated purpose reads as
 * surveillance.
 *
 * TRAVEL AND PREPARATION COUNT WHERE THE SCHEME COUNTS THEM. Most volunteers
 * under-record by leaving them out, which understates a charity's contribution
 * in exactly the return where the figure matters.
 *
 * IT IS SELF-REPORTED AND SAYS SO. Nobody is checking, the number is an
 * estimate, and pretending otherwise invites a precision the data does not
 * have.
 *
 * NO RANKING AGAINST OTHER VOLUNTEERS. A personal total against a personal
 * milestone is encouraging; a leaderboard turns a gift into a competition and
 * pushes out the people who can give least.
 */
export type HoursEntry = { id: string; on: string; activity: string; hours: number; travelHours?: number };

export function HoursLog({ entries, purposeNote, countsTravel, milestoneHours, className }: {
  entries: HoursEntry[];
  /** Why hours are recorded at all. */
  purposeNote?: string;
  /** Whether travel counts under this scheme. */
  countsTravel?: boolean;
  /** A personal milestone, never a comparison. */
  milestoneHours?: number;
  className?: string;
}) {
  const total = entries.reduce((n, e) => n + e.hours + (countsTravel ? e.travelHours ?? 0 : 0), 0);
  const toGo = milestoneHours !== undefined ? milestoneHours - total : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm tabular-nums">
        <span className="font-medium">{Number(total.toFixed(1))} hours</span>
        {toGo !== undefined && toGo > 0 && (
          <span className="text-muted-foreground"> · {Number(toGo.toFixed(1))} to your {milestoneHours}-hour award</span>
        )}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {entries.map((e) => (
          <li key={e.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">{e.on}</span>
            <span className="min-w-0 flex-1">{e.activity}</span>
            <span className="shrink-0 tabular-nums">
              {e.hours}
              {countsTravel && e.travelHours ? ` + ${e.travelHours}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {countsTravel
          ? "Travel and preparation count — most people forget to include them."
          : "Time on task only; travel is not counted under this scheme."}
      </p>
      <p className="text-xs text-muted-foreground">
        {purposeNote ?? "These hours are self-reported estimates. Nobody is checking them."}
      </p>
    </div>
  );
}
