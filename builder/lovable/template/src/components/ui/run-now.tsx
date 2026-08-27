import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Running an automation by hand, with the count in the confirmation.
 *
 * THE COUNT IS IN THE CONFIRM TEXT, which is what makes this different from a
 * plain button. "Run now" on a rule that sends texts is a spend, and the number
 * of records it will touch is the only thing that tells somebody whether they
 * are about to send four messages or four hundred.
 *
 * IT OFFERS A TEST RUN WHERE THE CALLER SUPPORTS ONE, and puts it first. Doing
 * nothing but reporting what would happen is almost always the right first
 * press, and burying it behind the real one gets it skipped.
 *
 * THE OUTCOME OF THE LAST RUN STAYS ON SCREEN. A button that fires and reverts
 * to its resting state leaves somebody unsure whether anything happened, so
 * they press it again — which on a rule that sends things is the failure the
 * whole component is guarding.
 *
 * `role="status"` on the result, so the outcome is announced rather than
 * appearing silently below a button somebody has already looked away from.
 */
export function RunNow({ affected, onRun, onTest, running, result, className }: {
  /** How many records it will act on. */
  affected?: number;
  onRun: () => void;
  /** A dry run, if the caller has one. */
  onTest?: () => void;
  running?: boolean;
  /** What the last run did. */
  result?: string;
  className?: string;
}) {
  const confirm = () => {
    if (affected === undefined) return window.confirm("Run this now?");
    return window.confirm(
      affected === 0
        ? "Nothing matches right now. Run it anyway?"
        : `This will act on ${affected.toLocaleString()} ${affected === 1 ? "record" : "records"} now. Continue?`,
    );
  };
  return (
    <div data-slot="run-now" className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap gap-2">
        {onTest && (
          <Button type="button" size="sm" variant="outline" onClick={onTest} disabled={running}>
            Test without doing anything
          </Button>
        )}
        <Button type="button" size="sm" disabled={running} onClick={() => { if (confirm()) onRun(); }}>
          {running ? "Running…" : "Run now"}
        </Button>
      </div>
      {affected !== undefined && !running && (
        <p className="text-xs text-muted-foreground">
          {affected === 0 ? "Nothing matches right now." : `${affected.toLocaleString()} ${affected === 1 ? "record matches" : "records match"} right now.`}
        </p>
      )}
      {result && <p role="status" className="text-xs">{result}</p>}
    </div>
  );
}
