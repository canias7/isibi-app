import { cn } from "@/lib/utils";
/**
 * The line acknowledging who paid for something.
 *
 * THE WORDING IS THE DONOR'S AND IS RENDERED VERBATIM. Credit lines are
 * contractual — "The Ashworth Bequest, 1994" is not interchangeable with "Given
 * by Harriet Ashworth" — and a component that reformats them breaks an
 * agreement rather than a style rule.
 *
 * AN ANONYMOUS GIFT IS CREDITED AS ANONYMOUS, not omitted. Omission looks like
 * an unfunded object; a stated anonymity is a fact and is what the donor asked
 * for.
 *
 * IT DISTINGUISHES WHO GAVE THE OBJECT FROM WHO FUNDED THE PURCHASE. They are
 * usually different parties, both entitled to credit, and collapsing them
 * misattributes a gift to a funder or the reverse.
 *
 * A CREDIT WITH AN EXPIRY IS MARKED. Naming rights and sponsorship credits run
 * for a term; one still displayed after it has lapsed is an unpaid endorsement,
 * and one removed early is a breach.
 */
export function DonorCredit({ line, anonymous, fundedBy, givenBy, until, lapsed, className }: {
  /** The exact agreed wording. Rendered as given. */
  line?: string;
  anonymous?: boolean;
  /** Who paid for the acquisition. */
  fundedBy?: string[];
  /** Who gave the object itself. */
  givenBy?: string;
  /** Free text — when the credit expires. */
  until?: string;
  lapsed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      {line ? (
        <p>{line}</p>
      ) : anonymous ? (
        <p>Given anonymously.</p>
      ) : givenBy ? (
        <p>Given by {givenBy}.</p>
      ) : (
        <p className="text-muted-foreground">No credit line agreed.</p>
      )}
      {fundedBy && fundedBy.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Purchase funded by {fundedBy.join(", ")}.
        </p>
      )}
      {until && (
        <p className={cn("text-xs", lapsed ? "font-medium" : "text-muted-foreground")}>
          {lapsed
            ? `This credit expired ${until} and should not still be displayed.`
            : `Agreed until ${until}.`}
        </p>
      )}
    </div>
  );
}
