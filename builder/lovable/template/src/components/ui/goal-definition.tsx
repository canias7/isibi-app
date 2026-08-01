import { cn } from "@/lib/utils";
/**
 * What counts as success, written down so two people mean the same thing.
 *
 * THE COUNTING RULE IS THE PART THAT GETS ARGUED ABOUT. "Bookings" counted once
 * per visitor and once per event differ by everybody who books twice — often
 * 20% — and two dashboards using different rules produce two numbers that are
 * both right. Stating it is what makes a goal quotable.
 *
 * WHAT IS EXCLUDED IS PART OF THE DEFINITION. Test bookings, staff accounts and
 * cancellations are the usual exclusions, and a goal that does not say leaves
 * everybody assuming their own.
 *
 * THE TARGET AND THE PERIOD ARE TOGETHER OR NEITHER MEANS ANYTHING. "400
 * bookings" is not a goal until it says by when, and a number with no deadline
 * is never missed.
 *
 * IT IS READ-ONLY AND MEANT TO BE PINNED NEXT TO THE CHART. A definition that
 * lives in a separate document is one nobody opens, which is how the argument
 * starts.
 */
export function GoalDefinition({ name, counts, countingRule, excludes = [], target, by, current, className }: {
  name: string;
  /** What is counted — "a completed booking". */
  counts: string;
  /** How — "once per visitor", "every time". */
  countingRule?: string;
  /** What is left out. */
  excludes?: string[];
  /** The number to hit. */
  target?: number;
  /** Free text — "31 August". */
  by?: string;
  /** Where it stands. */
  current?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-sm">
        <span className="font-medium">{name}</span>
        {target !== undefined && (
          <span className="text-muted-foreground tabular-nums">
            {" — "}
            {current !== undefined && `${current.toLocaleString()} of `}
            {target.toLocaleString()}
            {by && ` by ${by}`}
          </span>
        )}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-muted-foreground">Counts</dt>
        <dd>{counts}</dd>
        {countingRule && (<><dt className="text-muted-foreground">Counted</dt><dd>{countingRule}</dd></>)}
        <dt className="text-muted-foreground">Excludes</dt>
        <dd className={cn(!excludes.length && "text-muted-foreground")}>
          {excludes.length ? excludes.join(", ") : "nothing stated — assume everything is counted"}
        </dd>
      </dl>
    </div>
  );
}
