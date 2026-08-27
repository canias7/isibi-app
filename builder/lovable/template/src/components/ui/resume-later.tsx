import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "You started this on Tuesday — carry on, or begin again?"
 *
 * BOTH ANSWERS ARE OFFERED, EQUALLY. A flow that silently restores a draft
 * traps somebody who wanted a fresh start into deleting their way out of old
 * answers; one that silently discards it loses ten minutes of work. Neither is
 * safe to guess, so it asks — once, at the top.
 *
 * IT SAYS WHEN AND HOW FAR, because that is what decides the answer. Half an
 * hour ago at step 4 is worth resuming; three weeks ago at step 1 is not, and
 * "you have a saved draft" cannot distinguish them.
 *
 * STARTING AGAIN CONFIRMS, resuming does not. The asymmetry is deliberate:
 * carrying on is reversible (they can still start over afterwards), discarding
 * is not.
 *
 * IT SAYS WHEN THE DRAFT EXPIRES where the caller knows, since somebody who
 * puts it off needs to know whether it will still be there.
 */
export function ResumeLater({ savedAt, step, totalSteps, expiresIn, onResume, onRestart, busy, className }: {
  /** Free text — "on Tuesday", "half an hour ago". */
  savedAt?: string;
  /** One-based step they got to. */
  step?: number;
  totalSteps?: number;
  /** Free text — "in 5 days". */
  expiresIn?: string;
  onResume: () => void;
  onRestart: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="resume-later" className={cn("space-y-2 rounded-md border border-border p-3", className)}>
      <p className="text-sm">
        <span className="font-medium">You started this already</span>
        {savedAt && <span className="text-muted-foreground"> — saved {savedAt}</span>}
        {step !== undefined && (
          <span className="block text-xs text-muted-foreground">
            You had reached step <span className="tabular-nums">{step}</span>
            {totalSteps !== undefined && <> of <span className="tabular-nums">{totalSteps}</span></>}.
            {expiresIn && ` It is kept ${expiresIn}.`}
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onResume} disabled={busy}>Carry on</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy}
          onClick={() => { if (window.confirm("Start again? Your saved answers will be thrown away.")) onRestart(); }}>
          Start again
        </Button>
      </div>
    </div>
  );
}
