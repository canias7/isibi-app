import { cn } from "@/lib/utils";
/**
 * The run-up to a release date — with the deadlines that are not the date.
 *
 * DELIVERY TO STORES IS WEEKS BEFORE RELEASE, and that is the deadline people
 * miss. Editorial playlist consideration closes earlier still. A schedule
 * showing only the release date makes everything look comfortable until the
 * week it is not.
 *
 * A TASK THAT BLOCKS THE DATE IS DISTINGUISHED FROM ONE THAT DOES NOT.
 * Artwork and masters block; a press release does not, and treating them alike
 * either causes panic or lets the real one slip.
 *
 * THE DATE MOVES AS A UNIT. Every deadline is relative to the release, so the
 * component shows days-before rather than fixed dates where the caller has
 * them — a schedule of absolute dates silently becomes wrong the moment the
 * release moves.
 *
 * OVERDUE IS COUNTED FROM TODAY BY THE CALLER, not computed here, because
 * "today" in a component is a source of bugs nobody can reproduce.
 */
export type ReleaseTask = {
  id: string;
  what: string;
  /** How far before release it is due. */
  daysBefore?: number;
  /** Free text, where the caller has resolved it. */
  dueOn?: string;
  done?: boolean;
  /** True where the release cannot happen without it. */
  blocking?: boolean;
  overdue?: boolean;
};

export function ReleaseSchedule({ releaseOn, tasks, className }: {
  /** Free text — "16 October 2026". */
  releaseOn?: string;
  tasks: ReleaseTask[];
  className?: string;
}) {
  const blockingOverdue = tasks.filter((t) => t.blocking && t.overdue && !t.done);
  return (
    <div className={cn("space-y-1.5", className)}>
      {releaseOn && <p className="text-sm">Out on <span className="font-medium">{releaseOn}</span></p>}
      {blockingOverdue.length > 0 && (
        <p className="text-sm font-medium">
          {blockingOverdue.length} overdue {blockingOverdue.length === 1 ? "task blocks" : "tasks block"} the release date.
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className={cn("min-w-0 flex-1", t.done && "text-muted-foreground line-through")}>
              {t.what}
              {t.blocking && !t.done && <span className="text-xs text-muted-foreground"> · blocks the date</span>}
            </span>
            <span className={cn("shrink-0 text-xs tabular-nums", t.overdue && !t.done ? "font-medium" : "text-muted-foreground")}>
              {t.done
                ? "Done"
                : t.dueOn ?? (t.daysBefore !== undefined ? `${t.daysBefore} days before` : "No date")}
              {t.overdue && !t.done ? " · overdue" : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Deadlines are counted back from the release date, so they all move with it.
      </p>
    </div>
  );
}
