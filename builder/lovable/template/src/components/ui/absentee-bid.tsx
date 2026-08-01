import { cn } from "@/lib/utils";
/**
 * A bid left with the house — with the deadline and the tie rule.
 *
 * THE REGISTRATION DEADLINE IS THE FIELD PEOPLE MISS. Absentee bids close hours
 * before the sale so the book can be made up, and somebody submitting an hour
 * beforehand has not bid at all — they simply do not find out until afterwards.
 *
 * THE TIE RULE IS STATED. Two identical absentee bids are settled by whichever
 * arrived first at almost every house, which is a real reason to submit early
 * and is never published.
 *
 * A COMMISSION BID IS DISTINGUISHED FROM A TELEPHONE BID. One is executed by
 * the auctioneer to a maximum; the other means being rung and bidding live, and
 * they have different deadlines and different failure modes — a missed phone
 * call being the obvious one.
 *
 * IT SAYS THE BID IS EXECUTED AS CHEAPLY AS POSSIBLE. Bidders assume the house
 * will bid their maximum; the practice is to buy as low as the competition
 * allows, and saying so raises the maximums people are willing to leave.
 */
export function AbsenteeBid({ kind = "commission", lotNumber, maximum, submittedOn, registerBy, deadlinePassed, tieRuleNote, phoneNumber, currency = "GBP", locale = "en-GB", className }: {
  kind?: "commission" | "telephone";
  lotNumber?: string | number;
  /** The maximum left, for a commission bid. */
  maximum?: number;
  submittedOn?: string;
  /** Free text — when the book closes. */
  registerBy?: string;
  deadlinePassed?: boolean;
  tieRuleNote?: string;
  /** For a telephone bid. */
  phoneNumber?: string;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = maximum !== undefined
    ? new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(maximum)
    : undefined;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">
          {kind === "commission" ? "Bid left with the auctioneer" : "Telephone bid"}
        </span>
        {lotNumber !== undefined && (
          <span className="text-muted-foreground"> · lot {lotNumber}</span>
        )}
      </p>
      {kind === "commission" ? (
        <>
          {money && <p className="tabular-nums">Up to {money}</p>}
          <p className="text-xs text-muted-foreground">
            The auctioneer buys it as cheaply as the bidding allows — your maximum is a ceiling, not an offer.
          </p>
        </>
      ) : (
        <p className="text-xs">
          We will ring you on {phoneNumber ?? "the number on your registration"} shortly before the lot.
          If we cannot reach you, the lot goes without you.
        </p>
      )}
      <p className={cn("text-xs", deadlinePassed ? "font-medium" : "text-muted-foreground")}>
        {deadlinePassed
          ? "The deadline for leaving bids has passed — this will not be executed."
          : registerBy
            ? `Bids must be with us by ${registerBy}, not by the start of the sale.`
            : "There is a deadline before the sale for leaving bids."}
      </p>
      {submittedOn && <p className="text-xs text-muted-foreground">Received {submittedOn}.</p>}
      {/* The tie rule is about two identical MAXIMUMS, so it does not apply to a
          telephone bid — there is no maximum on one. */}
      {kind === "commission" && (
        <p className="text-xs text-muted-foreground">
          {tieRuleNote ?? "If two people leave the same maximum, the one received first wins. Early is better than late."}
        </p>
      )}
    </div>
  );
}
