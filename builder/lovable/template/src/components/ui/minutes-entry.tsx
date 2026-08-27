import { cn } from "@/lib/utils";
/**
 * One item of minutes — with the action it produced.
 *
 * AN ACTION WITH NO NAME AND NO DATE IS NOT AN ACTION. "The committee will look
 * into it" is what minutes are full of and what nothing ever comes of; a named
 * person and a date is the difference between a record and a decision.
 *
 * DISCUSSION AND DECISION ARE SEPARATE FIELDS. Minutes that narrate a
 * conversation bury what was agreed, and the reader six months later wants only
 * the second — which is also the part that has to be accurate.
 *
 * AN UNRESOLVED ITEM IS CARRIED FORWARD, VISIBLY. Items that quietly drop off
 * between meetings are how the same complaint is raised four times, and a
 * carried-forward marker is the cheapest fix in club administration.
 *
 * ATTRIBUTION IS OPTIONAL AND OFF BY DEFAULT. Minuting who said what changes
 * how people speak in a small room, and most clubs do not need it.
 */
export function MinutesEntry({ item, discussion, decision, actionBy, actionDueOn, carriedForward, className }: {
  /** The agenda item. */
  item: string;
  /** What was said, briefly. */
  discussion?: string;
  /** What was agreed. */
  decision?: string;
  /** Who is doing it. */
  actionBy?: string;
  /** Free text — "before the next meeting". */
  actionDueOn?: string;
  carriedForward?: boolean;
  className?: string;
}) {
  const vagueAction = Boolean(decision) && !actionBy;
  return (
    <li data-slot="minutes-entry" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="font-medium">{item}</p>
      {discussion && <p className="text-xs text-muted-foreground">{discussion}</p>}
      {decision ? (
        <p className="text-xs">Agreed: {decision}</p>
      ) : (
        <p className="text-xs text-muted-foreground">No decision taken.</p>
      )}
      {actionBy ? (
        <p className="text-xs">
          {actionBy} to action{actionDueOn ? ` by ${actionDueOn}` : ""}.
        </p>
      ) : vagueAction ? (
        <p className="text-xs font-medium">
          Nobody is named to do this, so it will still be here next time.
        </p>
      ) : null}
      {carriedForward && <p className="text-xs text-muted-foreground">Carried forward from the last meeting.</p>}
    </li>
  );
}
