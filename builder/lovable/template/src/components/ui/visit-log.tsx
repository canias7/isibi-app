import { cn } from "@/lib/utils";
/**
 * A care visit that happened — measured against the one that was paid for.
 *
 * THE ACTUAL LENGTH IS COMPARED WITH THE COMMISSIONED LENGTH. Fifteen minutes
 * billed and seven minutes delivered is the single most documented failure in
 * home care, and it is invisible on any log that records only a tick. The
 * component computes the difference rather than accepting a "completed" flag.
 *
 * WHAT WAS NOT DONE IS RECORDED AS PLAINLY AS WHAT WAS. A visit where the meal
 * was made and the medication was refused is a normal visit; one where those
 * are silently equal is a record nobody can rely on later.
 *
 * A MISSED VISIT IS A STATE, NOT AN ABSENT ROW. A row that simply is not there
 * cannot be distinguished from one nobody has entered yet, and for somebody
 * living alone that difference is the whole point of the log.
 *
 * NO GEOLOCATION. Proving a carer's position to the metre solves a monitoring
 * problem by putting a tracker on a low-paid worker's phone all day, and the
 * arrival and departure times answer the question that was actually asked.
 */
export function VisitLog({ visitor, arrivedAt, leftAt, commissionedMinutes, done = [], notDone = [], missed, missedReason, className }: {
  visitor?: string;
  /** "09:12". */
  arrivedAt?: string;
  leftAt?: string;
  /** What the visit was funded for. */
  commissionedMinutes?: number;
  done?: string[];
  /** Recorded as plainly as what was done. */
  notDone?: string[];
  missed?: boolean;
  missedReason?: string;
  className?: string;
}) {
  const toMins = (t?: string) => {
    if (!t) return undefined;
    const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
  };
  const a = toMins(arrivedAt);
  const b = toMins(leftAt);
  const actual = a !== undefined && b !== undefined && b >= a ? b - a : undefined;
  const short =
    actual !== undefined && commissionedMinutes !== undefined ? commissionedMinutes - actual : undefined;
  if (missed) {
    return (
      <li data-slot="visit-log" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
        <p className="font-medium">Visit missed.</p>
        <p className="text-xs">{missedReason ?? "No reason recorded. Somebody should check they are alright."}</p>
      </li>
    );
  }
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1">{visitor ?? "Carer not recorded"}</span>
        {(arrivedAt || leftAt) && (
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {[arrivedAt, leftAt].filter(Boolean).join("–")}
          </span>
        )}
      </p>
      {actual !== undefined && (
        <p className={cn("text-xs tabular-nums", short !== undefined && short > 0 ? "font-medium" : "text-muted-foreground")}>
          {actual} {actual === 1 ? "minute" : "minutes"}
          {commissionedMinutes !== undefined &&
            (short !== undefined && short > 0
              ? ` — ${short} short of the ${commissionedMinutes} paid for`
              : ` against ${commissionedMinutes} paid for`)}
          .
        </p>
      )}
      {done.length > 0 && <p className="text-xs text-muted-foreground">Done: {AND.format(done)}.</p>}
      {notDone.length > 0 && <p className="text-xs font-medium">Not done: {AND.format(notDone)}.</p>}
    </li>
  );
}
