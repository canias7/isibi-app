import { cn } from "@/lib/utils";
/**
 * What a trade term actually means — who pays, and where risk passes.
 *
 * WHO PAYS AND WHO CARRIES THE RISK ARE DIFFERENT QUESTIONS with different
 * answers under the same term, and that is where the money is lost. Under some
 * terms the seller pays the freight and the risk passes before it — so goods
 * damaged in transit are the buyer's problem on a shipment the seller is
 * paying for.
 *
 * THE PLACE IS PART OF THE TERM. A term without a named place is incomplete and
 * unenforceable — "the risk passes at the named place" needs one, and quoting
 * three letters alone is the standard sloppiness.
 *
 * IT SAYS WHO INSURES. An uninsured leg is the ordinary consequence of both
 * sides assuming the other did, and it surfaces only after a loss.
 *
 * IT DOES NOT SHIP A TABLE OF EVERY TERM. Those change between revisions of the
 * rules and vary by contract — the caller states the term's meaning, and the
 * component makes sure the three questions get answered.
 */
export function IncotermNote({ term, place, freightPaidBy, riskPassesAt, insuredBy, className }: {
  /** The three-letter term. */
  term: string;
  /** The named place — required for the term to mean anything. */
  place?: string;
  /** Who pays the carriage. */
  freightPaidBy?: string;
  /** Where responsibility for loss transfers. */
  riskPassesAt?: string;
  insuredBy?: string;
  className?: string;
}) {
  return (
    <div data-slot="incoterm-note" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{term}</span>
        {place
          ? <span className="text-muted-foreground"> {place}</span>
          : <span className="block text-xs font-medium">No place named — the term does not mean anything on its own.</span>}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-muted-foreground">Freight paid by</dt>
        <dd>{freightPaidBy ?? <span className="text-muted-foreground">not stated</span>}</dd>
        <dt className="text-muted-foreground">Risk passes</dt>
        <dd>{riskPassesAt ?? <span className="text-muted-foreground">not stated</span>}</dd>
        <dt className="text-muted-foreground">Insured by</dt>
        <dd className={cn(!insuredBy && "font-medium")}>
          {insuredBy ?? "nobody stated — check somebody has cover"}
        </dd>
      </dl>
    </div>
  );
}
