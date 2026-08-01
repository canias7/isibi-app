import { cn } from "@/lib/utils";
/**
 * A suggestion that lapses — with the reason it does, and no false urgency.
 *
 * IT SAYS WHY THERE IS A DEADLINE AT ALL. Expiry is a legitimate mechanism —
 * it keeps a queue moving and stops somebody sitting on a place another person
 * could use — and stating that turns an arbitrary countdown into something
 * fair. Without it, an expiry is just pressure.
 *
 * IT COUNTS IN DAYS, NEVER IN SECONDS. A ticking timer on a decision about a
 * person is a manipulation, it is recognised as one, and it produces worse
 * decisions from the people who fall for it.
 *
 * LAPSING IS NOT A REJECTION AND SAYS SO. Both sides otherwise read silence as
 * a decision, and one of them is usually just busy.
 *
 * IT CAN BE EXTENDED WHERE THAT IS TRUE. Most systems can and almost none
 * offer it, which converts a solvable delay into a lost match.
 */
export function MatchExpiry({ daysLeft, expiresOn, whyExpires, canExtend, onExtend, lapsed, className }: {
  daysLeft?: number;
  /** Free text — "16 August". */
  expiresOn?: string;
  /** The legitimate reason there is a limit. */
  whyExpires?: string;
  canExtend?: boolean;
  onExtend?: () => void;
  lapsed?: boolean;
  className?: string;
}) {
  const soon = !lapsed && daysLeft !== undefined && daysLeft <= 2;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className={cn(soon && "font-medium")}>
        {lapsed
          ? "This one has lapsed."
          : daysLeft !== undefined
            ? daysLeft <= 0
              ? "This closes today."
              : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} to answer.`
            : expiresOn
              ? `Open until ${expiresOn}.`
              : "No closing date."}
      </p>
      <p className="text-xs text-muted-foreground">
        {whyExpires ??
          "Suggestions lapse so the queue keeps moving and nobody holds a place somebody else could use."}
      </p>
      <p className="text-xs text-muted-foreground">
        Letting it lapse is not a rejection — nobody is told anything either way.
      </p>
      {!lapsed && canExtend && onExtend && (
        <button type="button" onClick={onExtend} className="text-xs underline underline-offset-2">
          I need longer
        </button>
      )}
    </div>
  );
}
