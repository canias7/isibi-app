import { cn } from "@/lib/utils";
/**
 * "We suggest this one" — with the reason and the interest disclosed.
 *
 * A RECOMMENDATION WITHOUT A REASON IS AN ADVERT. "Most popular", "best value"
 * and "recommended" all mean nothing on their own, and readers have learned to
 * discount them entirely — which wastes a genuinely useful signal.
 *
 * IT DISCLOSES A COMMERCIAL INTEREST when there is one. A recommendation that is
 * also the highest-margin option is not disqualified, but hiding that is the
 * thing that makes the whole page untrustworthy once discovered.
 *
 * Words and weight, no colour or star. A badge that means "we prefer this" has
 * to be readable in greyscale and announced to a screen reader, since it is
 * being used to steer a decision.
 */
export function RecommendedFlag({ label = "Our suggestion", because, disclosure, className }: {
  label?: string;
  /** Why — "cheapest for the hours you gave". Required to be worth anything. */
  because?: string;
  /** "we earn a commission on this one" */
  disclosure?: string;
  className?: string;
}) {
  return (
    <p className={cn("text-xs", className)}>
      <span className="font-medium">{label}</span>
      {because && <span className="text-muted-foreground"> — {because}</span>}
      {disclosure && <span className="block text-muted-foreground">{disclosure}</span>}
    </p>
  );
}
