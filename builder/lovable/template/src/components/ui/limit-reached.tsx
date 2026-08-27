import { cn } from "@/lib/utils";
/**
 * A hard stop, with every way out listed.
 *
 * THREE WAYS OUT, NOT ONE. Upgrading is the obvious route and it is often not
 * the right one — deleting old records, waiting for the reset, or asking an
 * administrator can all fix it — and a wall offering only "upgrade now" reads
 * as a sales tactic rather than an explanation. Whichever apply are shown.
 *
 * IT SAYS WHAT STILL WORKS. Hitting a limit rarely stops everything: reading
 * usually continues when writing does not, and somebody who thinks the whole
 * account is frozen panics differently from somebody who knows they simply
 * cannot add more today.
 *
 * THE RESET TIME IS FIRST WHERE THERE IS ONE, because waiting an hour is free
 * and upgrading is not — putting the paid option first when a free one exists
 * is the pattern this component refuses.
 *
 * `role="alert"` — an action was just refused, and the person is waiting for an
 * explanation.
 */
export function LimitReached({ what, resetsAt, stillWorks, options = [], askAdmin, className }: {
  /** What is capped — "adding bookings". */
  what: string;
  /** Free text — "at midnight". */
  resetsAt?: string;
  /** What is unaffected — "everything already saved is still readable". */
  stillWorks?: string;
  /** Ways out, in order of what the caller thinks is best. */
  options?: React.ReactNode[];
  /** Set when the reader cannot change plan themselves. */
  askAdmin?: string;
  className?: string;
}) {
  return (
    <div data-slot="limit-reached" role="alert" className={cn("space-y-2 rounded-md border border-foreground/40 bg-muted/40 p-3", className)}>
      <p className="text-sm font-medium">You have reached the limit for {what}</p>
      {resetsAt && <p className="text-sm">This clears {resetsAt}.</p>}
      {stillWorks && <p className="text-xs text-muted-foreground">{stillWorks}</p>}
      {askAdmin && <p className="text-xs text-muted-foreground">{askAdmin}</p>}
      {options.length > 0 && (
        <ul className="space-y-1 text-sm">
          {options.map((o, i) => (
            <li key={i} className="flex gap-2"><span aria-hidden="true">·</span><span className="min-w-0">{o}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
