import { cn } from "@/lib/utils";
/**
 * Telling the depot something is finished with — the moment charging stops.
 *
 * CHARGING STOPS WHEN THE OFF-HIRE IS REGISTERED, NOT WHEN THE KIT IS COLLECTED,
 * AND THE COMPONENT SAYS SO IN ITS FIRST LINE. Hirers wait for a lorry and pay
 * for the wait; the single sentence explaining that off-hiring now costs nothing
 * and saves the days in between is worth more than the whole rest of the screen.
 *
 * THE REFERENCE IS SHOWN AND IS THE PROOF. When an invoice arrives covering days
 * after the kit was finished with, the off-hire number and its timestamp are the
 * entire argument, and they are usually in an email nobody kept.
 *
 * COLLECTION IS TRACKED SEPARATELY FROM OFF-HIRE. Both are real events with
 * different consequences, and merging them is what makes the billing dispute
 * possible in the first place.
 *
 * NOTHING HERE IS A CANCELLATION. Off-hiring stops the charge and leaves the
 * kit where it is; the two are frequently confused and the wording never uses
 * one word for the other.
 */
export function OffHireNote({ reference, offHiredAt, collectedAt, collectionBooked, chargedTo, className }: {
  /** The proof, when an invoice runs past the date. */
  reference?: string;
  offHiredAt?: string;
  /** A separate event with separate consequences. */
  collectedAt?: string;
  collectionBooked?: string;
  chargedTo?: string;
  className?: string;
}) {
  if (!offHiredAt) {
    return (
      <div data-slot="off-hire-note" className={cn("space-y-0.5 text-sm", className)}>
        <p className="font-medium">
          This is still on hire and still being charged for. Charging stops when you off-hire it, not when it is
          collected.
        </p>
        <p className="text-xs text-muted-foreground">
          If you have finished with it, off-hire it now. The kit can stay where it is until somebody comes for it.
        </p>
      </div>
    );
  }
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="font-medium">Off-hired {offHiredAt}. Charging stopped then.</p>
      {reference && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Reference {reference} — keep this. It is the answer if an invoice runs past that date.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {collectedAt
          ? `Collected ${collectedAt}.`
          : collectionBooked
            ? `Collection booked for ${collectionBooked}. Nothing is charged while you wait.`
            : "Not collected yet, and nothing is charged while it sits there."}
      </p>
      {chargedTo && <p className="text-xs tabular-nums text-muted-foreground">Charged to {chargedTo}.</p>}
    </div>
  );
}
