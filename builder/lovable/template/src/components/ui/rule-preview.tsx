import { cn } from "@/lib/utils";
/**
 * What a rule would have done to the records that already exist.
 *
 * A DRY RUN BEFORE THE RULE GOES LIVE. An automation is written blind — nobody
 * knows whether "if the total is over £50" matches four bookings or four
 * thousand until it fires, and by then it has sent four thousand texts. This
 * runs it against history and reports the number.
 *
 * ZERO MATCHES IS THE MOST IMPORTANT RESULT and is called out rather than shown
 * as a bare "0". A rule matching nothing is almost always a mistake — a typo'd
 * value, an operator that cannot be true — and it is the failure that otherwise
 * goes unnoticed forever, because a rule that does nothing raises nothing.
 *
 * IT SHOWS EXAMPLES, not just a count. "412 matches" is not checkable; three
 * named records are, and spotting one that obviously should not be there is
 * how a wrong condition gets caught.
 *
 * IT SAYS THE WINDOW IT LOOKED AT, since "matches 12" means very different
 * things over a week and over three years.
 */
export function RulePreview({ matched, window: period, examples = [], onRun, running, className }: {
  /** null before it has been run. */
  matched: number | null;
  /** What history was checked — "the last 30 days". */
  window?: string;
  examples?: string[];
  onRun?: () => void;
  running?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="rule-preview" className={cn("space-y-2 rounded-md border border-border p-3", className)}>
      {matched === null ? (
        <p className="text-sm text-muted-foreground">
          {running ? "Checking…" : "Check this rule against records you already have."}
        </p>
      ) : matched === 0 ? (
        <p className="text-sm">
          <span className="font-medium">Nothing matches.</span>
          <span className="text-muted-foreground">
            {period ? ` Nothing in ${period} would have set this off.` : " This rule would never have fired."}
          </span>
        </p>
      ) : (
        <p className="text-sm">
          <span className="font-medium tabular-nums">{matched.toLocaleString()}</span>
          {matched === 1 ? " record matches" : " records match"}
          {period && <span className="text-muted-foreground"> in {period}</span>}
        </p>
      )}
      {examples.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {examples.map((e) => (
            <li key={e} className="flex gap-2"><span aria-hidden="true">·</span><span>{e}</span></li>
          ))}
        </ul>
      )}
      {onRun && (
        <button type="button" onClick={onRun} disabled={running}
          className="text-xs underline underline-offset-2 disabled:opacity-50">
          {matched === null ? "Run the check" : "Check again"}
        </button>
      )}
    </div>
  );
}
