import { cn } from "@/lib/utils";
/**
 * What was achieved — with the method, so it can be believed.
 *
 * THE NUMBER IS SHOWN WITH HOW IT WAS COUNTED. "1,400 meals served" is a
 * headline; "1,400 meals served, counted from kitchen tickets" is a claim
 * somebody can check. Charities are asked for the second constantly and publish
 * the first.
 *
 * OUTPUTS AND OUTCOMES ARE DIFFERENT AND ARE LABELLED. Meals served is an
 * output and is countable; people eating better is an outcome and is not — and
 * conflating them is how funders are promised things nobody can demonstrate.
 *
 * ATTRIBUTION IS HEDGED WHERE IT SHOULD BE. Almost nothing is caused by one
 * organisation alone, and claiming sole credit for a shared outcome is the
 * thing that makes the whole sector's numbers untrusted.
 *
 * THE PERIOD AND THE SAMPLE ARE SHOWN. A figure with no period is unfalsifiable,
 * and one drawn from twelve responses is a different kind of fact from one drawn
 * from four hundred.
 */
// A sentence-embedded list needs a conjunction, not a comma: "does not
// include rubble, waste burned for energy" reads as a truncated list.
// `Intl.ListFormat` also gets the separator right outside English.
const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

export function ImpactNote({ figure, what, kind = "output", period, method, sampleSize, sharedWith = [], className }: {
  /** Pre-formatted — "1,400". */
  figure?: string;
  /** "meals served". */
  what: string;
  /** An output is countable; an outcome is a change in people's lives. */
  kind?: "output" | "outcome";
  /** Free text — "in the year to March". */
  period?: string;
  /** How it was counted. */
  method?: string;
  /** Where the figure comes from a survey. */
  sampleSize?: number;
  /** Others who contributed to the same result. */
  sharedWith?: string[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        {figure && <span className="font-medium tabular-nums">{figure} </span>}
        {what}
        {period && <span className="text-muted-foreground"> {period}</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        {kind === "output"
          ? "An output — something we did, and can count."
          : "An outcome — a change in people's lives, which is estimated rather than counted."}
      </p>
      <p className={cn("text-xs", method ? "text-muted-foreground" : "font-medium")}>
        {method
          ? `Counted from ${method}.`
          : "No method stated. A figure nobody can check is a figure funders discount."}
        {sampleSize !== undefined && ` Based on ${sampleSize} ${sampleSize === 1 ? "response" : "responses"}.`}
      </p>
      {sharedWith.length > 0 && (
        <p className="text-xs">
          Achieved with {AND.format(sharedWith)} — not by us alone.
        </p>
      )}
    </div>
  );
}
