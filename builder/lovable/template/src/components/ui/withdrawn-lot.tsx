import { cn } from "@/lib/utils";
/**
 * A lot pulled from the sale — with what happens to bids already left.
 *
 * EXISTING BIDS ARE THE URGENT PART. Somebody who left a maximum needs to know
 * it is cancelled and that no money is owed, and a withdrawal notice that omits
 * it leaves people believing they may still be committed.
 *
 * THE REASON IS STATED AT THE LEVEL THE HOUSE CAN. Withdrawn for a title
 * question, for condition, or at the seller's request are different things —
 * and the last is a fact about the seller rather than about the object, which
 * matters to somebody who was going to bid.
 *
 * WHETHER IT MAY RETURN IS ANSWERED. Lots withdrawn for paperwork often
 * reappear in the next sale; ones withdrawn over authenticity do not. A bidder
 * deciding whether to keep watching needs that.
 *
 * THE LOT STAYS LISTED, marked. Removing it makes the catalogue numbering look
 * wrong and leaves anybody arriving from a link with no explanation at all.
 */
export function WithdrawnLot({ lotNumber, title, reason, withdrawnOn, bidsCancelled = true, mayReturn, returnNote, className }: {
  lotNumber: string | number;
  title?: string;
  /** As specific as the house can be. */
  reason?: string;
  withdrawnOn?: string;
  bidsCancelled?: boolean;
  mayReturn?: boolean;
  returnNote?: string;
  className?: string;
}) {
  return (
    <div data-slot="withdrawn-lot" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="text-xs tabular-nums text-muted-foreground">Lot {lotNumber}</span>
        {title && <span className="block text-muted-foreground line-through">{title}</span>}
      </p>
      <p className="font-medium">Withdrawn from the sale{withdrawnOn ? ` on ${withdrawnOn}` : ""}.</p>
      <p className="text-xs">{reason ?? "No reason has been given."}</p>
      <p className={cn("text-xs", bidsCancelled ? "" : "font-medium")}>
        {bidsCancelled
          ? "Any bids left on this lot are cancelled. You owe nothing and need do nothing."
          : "Bids on this lot have not been cancelled — contact us."}
      </p>
      {mayReturn !== undefined && (
        <p className="text-xs text-muted-foreground">
          {mayReturn
            ? returnNote ?? "It may appear in a later sale."
            : "It will not be offered again."}
        </p>
      )}
    </div>
  );
}
