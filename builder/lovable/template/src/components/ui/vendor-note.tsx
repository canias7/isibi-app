import { cn } from "@/lib/utils";
/**
 * What the seller actually needs — which is frequently not the highest number.
 *
 * THE SELLER'S CONSTRAINTS BEAT THE PRICE MORE OFTEN THAN ANYBODY EXPECTS.
 * Somebody who must be out by a date, or who cannot move until they have found
 * somewhere, will take less for the offer that fits. Recording it is what lets a
 * lower offer be presented as the better one, with a reason.
 *
 * WHAT THE SELLER WILL NOT DO IS AS USEFUL AS WHAT THEY WANT. "Not before the
 * school year ends" prevents a fortnight of offers that were never going to work.
 *
 * WHAT IS INCLUDED AND EXCLUDED IS RECORDED HERE, EARLY. Fixtures are the
 * classic late argument, and it is late entirely because nobody wrote it down at
 * the start when it cost nothing.
 *
 * IT IS MARKED AS SHARED OR PRIVATE. Some of this is a negotiating position and
 * being able to see which is which stops the wrong half reaching a buyer.
 */
export function VendorNote({ mustCompleteBy, cannotMoveUntil, willNotConsider = [], included = [], excluded = [], note, sharedWithBuyers, className }: {
  mustCompleteBy?: string;
  /** "Until we have found somewhere". */
  cannotMoveUntil?: string;
  willNotConsider?: string[];
  /** Written down at the start, when it is free. */
  included?: string[];
  excluded?: string[];
  note?: string;
  /** Some of this is a negotiating position. */
  sharedWithBuyers?: boolean;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  return (
    <div data-slot="vendor-note" className={cn("space-y-1 text-sm", className)}>
      {(mustCompleteBy || cannotMoveUntil) && (
        <p className="font-medium">
          {[mustCompleteBy && `Must be finished by ${mustCompleteBy}`, cannotMoveUntil && `Cannot move ${cannotMoveUntil}`]
            .filter(Boolean)
            .join(". ")}
          .
        </p>
      )}
      {willNotConsider.length > 0 && (
        <p className="text-xs">Will not consider {AND.format(willNotConsider)}.</p>
      )}
      {included.length > 0 && (
        <p className="text-xs text-muted-foreground">Included: {AND.format(included)}.</p>
      )}
      {excluded.length > 0 && (
        <p className="text-xs text-muted-foreground">Not included: {AND.format(excluded)}.</p>
      )}
      {included.length === 0 && excluded.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nothing recorded about fixtures. It costs nothing now and is the usual argument later.
        </p>
      )}
      {note && <p className="text-xs">{note}</p>}
      <p className="text-xs text-muted-foreground">
        {sharedWithBuyers ? "Buyers can see this." : "Not shown to buyers."}
      </p>
    </div>
  );
}
