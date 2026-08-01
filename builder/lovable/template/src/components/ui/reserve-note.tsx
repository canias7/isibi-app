import { cn } from "@/lib/utils";
/**
 * Whether the reserve has been met — without revealing what it is.
 *
 * THE RESERVE FIGURE IS NEVER SHOWN, AND THE FACT THAT ONE EXISTS ALWAYS IS.
 * Publishing the number turns the reserve into the price; concealing that there
 * is one at all leaves a bidder wondering why their winning bid did not win.
 * Met or not met is the whole of what a bidder is entitled to.
 *
 * "NO RESERVE" IS STATED LOUDLY WHERE TRUE, because it changes how people bid
 * and it is the one fact about a reserve that can be published.
 *
 * IT SAYS WHAT HAPPENS IF THE RESERVE IS NOT MET. The lot is unsold and the
 * highest bidder gets nothing — which surprises people every single sale, and
 * is usually followed by a negotiation nobody told them about.
 *
 * THE AUCTIONEER'S DISCRETION IS DISCLOSED. Most houses may sell below reserve
 * with the seller's agreement, and a bidder who does not know that reads a
 * "not met" lot as final.
 */
export function ReserveNote({ hasReserve = true, met, mayNegotiate, negotiationNote, className }: {
  hasReserve?: boolean;
  /** Undefined before bidding starts. */
  met?: boolean;
  /** True where the house may sell below reserve afterwards. */
  mayNegotiate?: boolean;
  negotiationNote?: string;
  className?: string;
}) {
  if (!hasReserve) {
    return (
      <div className={cn("space-y-0.5 text-sm", className)}>
        <p className="font-medium">No reserve.</p>
        <p className="text-xs text-muted-foreground">
          It sells to the highest bidder whatever that is.
        </p>
      </div>
    );
  }
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className={cn(met === false && "font-medium")}>
        {met === true
          ? "The reserve has been met — this will sell."
          : met === false
            ? "The reserve has not been met yet."
            : "This lot has a reserve."}
      </p>
      <p className="text-xs text-muted-foreground">
        We do not publish the figure. If we did, it would become the price.
      </p>
      {met !== true && (
        <p className="text-xs">
          If it is not met the lot goes unsold and the highest bidder gets nothing.
          {mayNegotiate && " We may then approach the seller on your behalf."}
        </p>
      )}
      {negotiationNote && <p className="text-xs text-muted-foreground">{negotiationNote}</p>}
    </div>
  );
}
