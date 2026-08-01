import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * A job that stopped, why, and what happens next.
 *
 * THE PARTIAL RESULT IS THE PART EVERYONE FORGETS. An import that failed on row
 * 4,000 of 5,000 usually kept the first 3,999, and a panel that says only
 * "failed" sends somebody to re-run the whole thing and duplicate all of it.
 * `done` states what survived; omitting it says nothing rather than implying
 * zero.
 *
 * `attempts` is shown once there has been more than one, because "failed" and
 * "failed for the fourth time" call for different reactions — the second means
 * stop pressing retry and read the reason.
 *
 * The reason is rendered as given. A job failure is usually seen by the person
 * who can act on it, so a provider's own message is more useful than a friendly
 * rewrite that loses the detail; `error-detail-toggle` is the component for
 * hiding the noisy half.
 */
export function JobFailed({
  name, reason, attempts, done, onRetry, onDismiss, className,
}: {
  name: string;
  reason?: string;
  /** Shown once it is more than one. */
  attempts?: number;
  /** What completed before it stopped — "3,999 of 5,000 rows imported". */
  done?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <section role="alert" aria-label={`${name} failed`}
      className={cn("flex flex-col gap-2 rounded-md border border-border p-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{name} didn&apos;t finish</p>
        {typeof attempts === "number" && attempts > 1 && (
          <p className="text-xs text-muted-foreground tabular-nums">{attempts} attempts</p>
        )}
      </div>
      {reason && <p className="text-sm text-muted-foreground">{reason}</p>}
      {done && <p className="text-sm">{done}</p>}
      <div className="flex flex-wrap gap-2">
        {onRetry && <Button size="sm" onClick={onRetry}>Try again</Button>}
        {onDismiss && <Button size="sm" variant="outline" onClick={onDismiss}>Dismiss</Button>}
      </div>
    </section>
  );
}
