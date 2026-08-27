import { cn } from "@/lib/utils";
/**
 * A locker, with what happens to the contents made explicit.
 *
 * WHAT HAPPENS TO WHAT IS INSIDE WHEN A HIRE ENDS IS THE FIELD EVERYBODY OMITS.
 * A locker whose rental lapses gets cut open at some point and its contents put
 * somewhere, and the member who was travelling deserves that stated before it
 * happens rather than after.
 *
 * THE SIZE IS DESCRIBED BY WHAT FITS. "Large" is not a measurement; "a laptop
 * bag and a coat" is, and it is the only form of the answer anybody can use
 * standing in front of a bank of doors.
 *
 * A LOCKER SOMEBODY IS STILL PAYING FOR AND NOT USING IS FLAGGED. It is a
 * recurring charge for an empty box, and it is invisible on a statement where it
 * appears as one line among the membership.
 *
 * NO CONTENTS INVENTORY. What is inside is the member's business, and a space
 * that keeps a list of it has created a record nobody asked for.
 */
export function LockerRow({ number, fits, holder, paidUntil, daysUntilEnd, unusedDays, onEndNote = "the contents are removed and kept at reception for a period", className }: {
  number: string;
  /** What fits, not a size word. */
  fits?: string;
  holder?: string;
  paidUntil?: string;
  /** Negative means the hire has already lapsed. */
  daysUntilEnd?: number;
  unusedDays?: number;
  /** Stated before it happens. */
  onEndNote?: string;
  className?: string;
}) {
  const lapsed = daysUntilEnd !== undefined && daysUntilEnd <= 0;
  const ending = daysUntilEnd !== undefined && daysUntilEnd > 0 && daysUntilEnd <= 14;
  const idle = unusedDays !== undefined && unusedDays >= 60;
  return (
    <li data-slot="locker-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1">
          <span className="font-medium">Locker {number}</span>
          {fits && <span className="block text-xs text-muted-foreground">Fits {fits}</span>}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{holder ?? "Free"}</span>
      </p>
      {lapsed ? (
        <p className="text-xs font-medium">
          The hire has ended{paidUntil ? ` — it ran to ${paidUntil}` : ""}. Anything inside will be removed:{" "}
          {onEndNote}.
        </p>
      ) : ending ? (
        <p className="text-xs font-medium tabular-nums">
          Ends in {daysUntilEnd} {daysUntilEnd === 1 ? "day" : "days"}. Empty it or renew — {onEndNote}.
        </p>
      ) : paidUntil ? (
        <p className="text-xs text-muted-foreground">Paid to {paidUntil}.</p>
      ) : null}
      {idle && !lapsed && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Not opened for {unusedDays} days, and still being charged for.
        </p>
      )}
    </li>
  );
}
