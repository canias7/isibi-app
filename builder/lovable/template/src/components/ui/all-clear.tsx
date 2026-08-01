import { cn } from "@/lib/utils";
/**
 * Telling people it is over — which is a decision, not a state change.
 *
 * SOMEBODY GIVES THE ALL-CLEAR BY NAME. A screen that simply stops showing an
 * alarm leaves everybody guessing whether it is finished or the system has
 * failed, and standing in a car park is where people make that guess badly. The
 * name is the difference between an announcement and an absence.
 *
 * IT SAYS WHAT IS SAFE, not that everything is. Re-entry to one building while
 * another is still closed is the normal shape of the end of an incident, and a
 * single all-clear message sends people into the wrong one.
 *
 * PARTIAL RE-ENTRY IS A FIRST-CLASS STATE for the same reason, rather than being
 * squeezed into "clear" or "not clear".
 *
 * THE TIME IS SHOWN BECAUSE PEOPLE ARRIVE LATE TO THIS SCREEN. Somebody reading
 * it twenty minutes later needs to know whether it is current, and a bare
 * "All clear" carries no way to tell.
 */
export function AllClear({ given, givenBy, at, safeAreas = [], stillClosed = [], note, className }: {
  given?: boolean;
  /** A person, or it is not an announcement. */
  givenBy?: string;
  at?: string;
  safeAreas?: string[];
  /** The normal shape of the end of an incident. */
  stillClosed?: string[];
  note?: string;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  if (!given) {
    return (
      <div className={cn("space-y-0.5 text-sm", className)}>
        <p className="text-lg font-medium">No all-clear yet. Stay where you are.</p>
        <p className="text-xs text-muted-foreground">
          Nobody has said it is over. This screen not showing an alarm is not the same thing.
        </p>
      </div>
    );
  }
  const partial = stillClosed.length > 0;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="text-lg font-medium">
        {partial ? "Partly clear — some areas are still closed." : "All clear."}
      </p>
      <p className="text-sm">
        {givenBy
          ? `Given by ${givenBy}${at ? ` at ${at}` : ""}.`
          : "Nobody is named as having given it, which is not an announcement anybody should act on."}
      </p>
      {safeAreas.length > 0 && <p className="text-xs">You can go back into {AND.format(safeAreas)}.</p>}
      {partial && <p className="text-xs font-medium">Still closed: {AND.format(stillClosed)}.</p>}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
