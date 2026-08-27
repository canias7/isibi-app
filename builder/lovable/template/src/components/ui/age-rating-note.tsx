import { cn } from "@/lib/utils";
/**
 * Who this is suitable for, and why.
 *
 * THE REASON MATTERS MORE THAN THE NUMBER. "15" tells a parent nothing;
 * "strong language, some violence" lets them decide, and the descriptors are the
 * part every rating system publishes and most interfaces drop.
 *
 * THE SCHEME IS NAMED. Ratings are national — a "15" means different things in
 * different systems and nothing at all outside them — so an unlabelled number is
 * a claim that cannot be checked. This is also why the rating is a free string
 * rather than an enum: hard-coding one country's scale is exactly the country
 * rule the backlog was filtered against.
 *
 * `aria-label` spells it out, since a bare "15" in a badge is announced as a
 * loose number in the middle of a card.
 */
export function AgeRatingNote({ rating, scheme, descriptors, className }: {
  /** "15", "PG", "T" — whatever the scheme uses. */
  rating: string;
  /** Which system — "BBFC", "ESRB". Required to be meaningful. */
  scheme?: string;
  /** "strong language, some violence" */
  descriptors?: string[];
  className?: string;
}) {
  return (
    <p data-slot="age-rating-note" className={cn("flex flex-wrap items-baseline gap-x-2 text-xs", className)}>
      <span aria-label={`Rated ${rating}${scheme ? ` by ${scheme}` : ""}`}
        className="rounded border border-border px-1.5 py-0.5 font-medium">
        {rating}
      </span>
      {scheme && <span className="text-muted-foreground">{scheme}</span>}
      {descriptors?.length ? (
        <span className="text-muted-foreground">{descriptors.join(", ")}</span>
      ) : null}
    </p>
  );
}
