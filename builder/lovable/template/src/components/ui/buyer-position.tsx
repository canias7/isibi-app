import { cn } from "@/lib/utils";
/**
 * What makes an offer strong — which is almost never the amount.
 *
 * READINESS IS A CHECKLIST OF FACTS, NOT A RATING. Funds in place, nothing to
 * sell, a solicitor instructed and a survey booked are each verifiable and each
 * separately decisive; a single "strong buyer" badge is an agent's opinion
 * wearing the clothes of a measurement.
 *
 * THE MISSING ITEM IS NAMED. "Three of five" leaves a seller comparing two
 * offers by counting, when what they need is which one is missing — a buyer with
 * a house to sell and one without are not three-fifths apart.
 *
 * WHAT IS CHECKED AND WHAT IS CLAIMED ARE DIFFERENT. A buyer saying they have
 * funds and an agent having seen evidence are separate states, and running them
 * together is how a chain collapses in the last fortnight.
 *
 * NO SCORE OUT OF TEN. It would be sorted on, and the sort would rank a
 * confident claim above a verified fact.
 */
export type PositionFact = {
  id: string;
  what: string;
  /** The buyer says so. */
  claimed?: boolean;
  /** Somebody has seen evidence. */
  verified?: boolean;
};

export function BuyerPosition({ facts, chainFree, buying = "with a mortgage", className }: {
  facts: PositionFact[];
  /** Nothing to sell first. Usually the single biggest factor. */
  chainFree?: boolean;
  buying?: string;
  className?: string;
}) {
  const missing = facts.filter((f) => !f.claimed && !f.verified);
  const claimedOnly = facts.filter((f) => f.claimed && !f.verified);
  return (
    <div data-slot="buyer-position" className={cn("space-y-1.5 text-sm", className)}>
      <p className="font-medium">
        {chainFree ? "Nothing to sell first." : "Has a property to sell first."} Buying {buying}.
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {facts.map((f) => (
          <li key={f.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1">{f.what}</span>
            <span className={cn("shrink-0 text-xs", f.verified ? "text-muted-foreground" : "font-medium")}>
              {f.verified ? "Seen" : f.claimed ? "Said, not seen" : "Not yet"}
            </span>
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <p className="text-xs font-medium">
          Not in place: {missing.map((f) => f.what).join(", ")}.
        </p>
      )}
      {claimedOnly.length > 0 && (
        <p className="text-xs">
          {claimedOnly.map((f) => f.what).join(", ")} — the buyer says so and nobody has seen it. That distinction is
          what decides the last fortnight.
        </p>
      )}
    </div>
  );
}
