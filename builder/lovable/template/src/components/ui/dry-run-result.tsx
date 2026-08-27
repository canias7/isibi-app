import { cn } from "@/lib/utils";
/**
 * What a job WOULD do, with the problems it would hit.
 *
 * A DRY RUN THAT ONLY REPORTS A COUNT IS NOT WORTH RUNNING. The value is the
 * sample of problems — "412 rows would fail: no email address" — because that
 * is what gets fixed before the real run. A number alone leaves somebody to
 * discover the reason during the thing they were trying to de-risk.
 *
 * NOTHING-WOULD-CHANGE IS CALLED OUT. A dry run matching zero records is
 * usually a mistake in the filter rather than a clean bill of health, and it is
 * indistinguishable from success in every implementation that just prints
 * counts.
 *
 * IT SAYS EXPLICITLY THAT NOTHING WAS WRITTEN. People do not trust dry runs,
 * and the sentence costs a line — without it somebody checks the live data
 * afterwards to be sure.
 *
 * THE SAMPLE IS CAPPED AND THE CAP IS STATED. Ten examples out of four hundred
 * is useful; printing all four hundred makes the panel unreadable and silently
 * truncating misrepresents the scale.
 */
export type DryRunProblem = { id: string; reason: string; count: number; examples?: string[] };

export function DryRunResult({ wouldChange, wouldSkip, problems = [], sampleLimit = 3, className }: {
  wouldChange: number;
  wouldSkip?: number;
  problems?: DryRunProblem[];
  sampleLimit?: number;
  className?: string;
}) {
  return (
    <div data-slot="dry-run-result" className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        {wouldChange === 0 ? (
          <>
            <span className="font-medium">Nothing would change.</span>
            <span className="text-muted-foreground"> Check the filter — this usually means it matched nothing.</span>
          </>
        ) : (
          <>
            <span className="font-medium tabular-nums">{wouldChange.toLocaleString()}</span>
            {wouldChange === 1 ? " record would change" : " records would change"}
            {wouldSkip !== undefined && wouldSkip > 0 && (
              <span className="text-muted-foreground tabular-nums"> · {wouldSkip.toLocaleString()} skipped</span>
            )}
          </>
        )}
      </p>
      {problems.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {problems.map((p) => {
            const shown = (p.examples ?? []).slice(0, sampleLimit);
            const more = (p.examples?.length ?? 0) - shown.length;
            return (
              <li key={p.id} className="px-3 py-2">
                <p>
                  <span className="font-medium tabular-nums">{p.count.toLocaleString()}</span>
                  <span className="text-muted-foreground"> — {p.reason}</span>
                </p>
                {shown.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {shown.join(", ")}
                    {more > 0 && ` and ${more.toLocaleString()} more`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Nothing was written — this was a rehearsal.</p>
    </div>
  );
}
