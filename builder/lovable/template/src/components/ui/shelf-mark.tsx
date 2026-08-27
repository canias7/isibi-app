import { cn } from "@/lib/utils";
/**
 * Where to physically walk to — the shelfmark, and the floor it is on.
 *
 * THE BUILDING AND FLOOR COME FIRST, THEN THE MARK. A classification number is
 * useless to somebody standing in the wrong building, and that is the ordinary
 * case in any library with more than one site. The sequence here matches the
 * order a person needs it.
 *
 * IT IS MONOSPACED AND SPACED AS SHELVED. Classification schemes sort character
 * by character, and a proportional font makes `823.914 JOH` and `823.9 14JOH`
 * look alike — which is a shelf somebody will not find it on.
 *
 * A CLOSED-ACCESS ITEM SAYS SO INSTEAD OF SENDING SOMEBODY WALKING. Items in a
 * store have to be requested and fetched, and a shelfmark displayed without that
 * is an invitation to search a floor that does not hold it.
 *
 * "SHELVED ELSEWHERE" IS ITS OWN NOTE — oversize, reference, a display case. It
 * is the reason a reader stands in front of the correct number and finds a gap.
 */
export function ShelfMark({ mark, site, floor, sequence, closedAccess, requestNote, shelvedElsewhere, className }: {
  /** The classification mark, exactly as shelved. */
  mark: string;
  site?: string;
  floor?: string;
  /** "Oversize", "Reference", "Short loan". */
  sequence?: string;
  /** True where a reader cannot fetch it themselves. */
  closedAccess?: boolean;
  /** How to request it. */
  requestNote?: string;
  /** Why it is not in the main run. */
  shelvedElsewhere?: string;
  className?: string;
}) {
  return (
    <div data-slot="shelf-mark" className={cn("space-y-0.5 text-sm", className)}>
      {(site || floor) && (
        <p className="text-xs text-muted-foreground">
          {[site, floor].filter(Boolean).join(" · ")}
        </p>
      )}
      <p className="font-mono text-base">{mark}</p>
      {sequence && <p className="text-xs text-muted-foreground">{sequence} sequence</p>}
      {closedAccess ? (
        <p className="text-xs font-medium">
          Not on the open shelves. {requestNote ?? "It has to be requested from the store."}
        </p>
      ) : shelvedElsewhere ? (
        <p className="text-xs">{shelvedElsewhere}</p>
      ) : null}
    </div>
  );
}
