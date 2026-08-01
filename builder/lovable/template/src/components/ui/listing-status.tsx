import { cn } from "@/lib/utils";
/**
 * Where a listing stands, in terms every country shares.
 *
 * THE ONLY QUESTION A BUYER IS ASKING IS WHETHER THEY CAN STILL OFFER, and the
 * component answers exactly that. The names for the stages in between — the
 * point at which a deal becomes binding, and what it is called — differ
 * everywhere, so the LABEL is the caller's and the MEANING is the component's.
 *
 * "STILL TAKING OFFERS" IS SHOWN SEPARATELY FROM THE STAGE. In several markets a
 * property with an accepted offer can still be offered on, and in others it
 * cannot; presenting the stage alone leaves the one question unanswered in
 * exactly the markets where the answer is surprising.
 *
 * HOW LONG IT HAS BEEN LISTED IS SHOWN. It is the fact buyers use and sellers
 * dislike, and hiding it does not stop anyone working it out from the listing
 * date — it only stops the seller seeing what the buyer sees.
 *
 * A RELISTING IS NOT A NEW LISTING and is marked as such. Resetting the clock on
 * a property that has been on the market for a year is the oldest trick here.
 */
export function ListingStatus({ stage, label, stillTakingOffers, daysListed, relisted, previouslyListedDays, className }: {
  /** The meaning. The name for it is the caller's. */
  stage: "available" | "offer accepted" | "binding" | "completed" | "withdrawn";
  /** What this market calls that stage. */
  label?: string;
  /** Answered separately, because markets differ. */
  stillTakingOffers?: boolean;
  daysListed?: number;
  /** True where this is a relisting of the same property. */
  relisted?: boolean;
  previouslyListedDays?: number;
  className?: string;
}) {
  const open = stage === "available" || stillTakingOffers;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="font-medium">{label ?? stage.charAt(0).toUpperCase() + stage.slice(1)}</p>
      <p className={cn("text-xs", open ? "font-medium" : "text-muted-foreground")}>
        {stage === "completed"
          ? "Sold and finished. Nothing further to offer on."
          : stage === "withdrawn"
            ? "Taken off the market."
            : open
              ? "You can still make an offer on this."
              : "Not taking further offers."}
      </p>
      {daysListed !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          On the market {daysListed} {daysListed === 1 ? "day" : "days"}.
        </p>
      )}
      {relisted && (
        <p className="text-xs">
          Relisted
          {previouslyListedDays !== undefined
            ? ` — it was on the market ${previouslyListedDays} ${previouslyListedDays === 1 ? "day" : "days"} before that`
            : ""}
          . The clock on the listing is not the clock on the property.
        </p>
      )}
    </div>
  );
}
