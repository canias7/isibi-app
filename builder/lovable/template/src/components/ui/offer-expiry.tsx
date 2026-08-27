import { cn } from "@/lib/utils";
/**
 * When a lending offer runs out — and what happens if it does.
 *
 * WHAT HAPPENS AT EXPIRY IS SPELLED OUT, because it is not what people assume.
 * An expired offer is usually not renewed on the same terms: the rate is
 * re-quoted at whatever is current, which can move the payment considerably. A
 * countdown with no consequence attached reads as an administrative deadline.
 *
 * THE RATE HOLD AND THE OFFER ITSELF CAN EXPIRE ON DIFFERENT DAYS, and both are
 * shown. Losing the rate while the offer stands is the commoner and quieter of
 * the two, and it is invisible on any component that keeps one date.
 *
 * IT SAYS WHO CAN EXTEND IT AND HOW LONG THAT TAKES. A deadline with no named
 * action is a countdown somebody watches rather than something they can do
 * anything about.
 *
 * EXPIRED IS A STATE, NOT A NEGATIVE NUMBER. "−3 days" is a bug that has shipped
 * in every countdown ever written.
 */
export function OfferExpiry({ offerExpiresOn, offerDaysLeft, rateHeldUntil, rateDaysLeft, extendBy, extendTakes, className }: {
  offerExpiresOn?: string;
  /** Negative means it has gone. */
  offerDaysLeft?: number;
  /** Can run out before the offer does. */
  rateHeldUntil?: string;
  rateDaysLeft?: number;
  /** Who can extend it. */
  extendBy?: string;
  extendTakes?: string;
  className?: string;
}) {
  const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
  const expired = offerDaysLeft !== undefined && offerDaysLeft <= 0;
  const rateGone = rateDaysLeft !== undefined && rateDaysLeft <= 0;
  return (
    <div data-slot="offer-expiry" className={cn("space-y-0.5 text-sm", className)}>
      {expired ? (
        <p className="font-medium">
          This offer has run out{offerExpiresOn ? ` — it expired ${offerExpiresOn}` : ""}. A new one is quoted at
          today's rate, which may not be the rate you had.
        </p>
      ) : (
        <p className={cn("tabular-nums", offerDaysLeft !== undefined && offerDaysLeft <= 14 ? "font-medium" : "")}>
          Offer stands for {offerDaysLeft !== undefined ? days(offerDaysLeft) : "an unstated period"}
          {offerExpiresOn ? `, until ${offerExpiresOn}` : ""}.
        </p>
      )}
      {(rateHeldUntil || rateDaysLeft !== undefined) && (
        <p className={cn("text-xs tabular-nums", rateGone || (rateDaysLeft ?? 99) <= 14 ? "font-medium" : "text-muted-foreground")}>
          {rateGone
            ? "The rate hold has already gone. The offer may stand while the price does not."
            : `The rate is held for ${rateDaysLeft !== undefined ? days(rateDaysLeft) : "a shorter period"}${rateHeldUntil ? `, until ${rateHeldUntil}` : ""} — often sooner than the offer itself.`}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {extendBy
          ? `${extendBy} can ask for an extension${extendTakes ? `, which takes about ${extendTakes}` : ""}.`
          : "Nobody is recorded as able to extend this."}
      </p>
    </div>
  );
}
