import { cn } from "@/lib/utils";
/**
 * The bar that says the connection went.
 *
 * Renders nothing while online, which is the only acceptable resting state for
 * something pinned across the top of a page.
 *
 * IT SAYS WHAT STILL WORKS, not just what broke. "You're offline — changes are
 * saved here and will send when you're back" is the difference between somebody
 * carrying on and somebody closing the tab believing their work is lost. The
 * caller passes that promise, because only the caller knows whether it is true.
 *
 * `role="status"` rather than `alert`: an alert interrupts whatever a screen
 * reader is saying, and losing connection is worth knowing, not worth cutting
 * somebody off mid-sentence for.
 *
 * "Try now" is offered because the automatic retry has a delay and somebody who
 * can see their wifi is back should not have to wait out a countdown.
 */
export function ReconnectStrip({ online, retryInSeconds, safeMessage, onRetryNow, className }: {
  online: boolean;
  /** Seconds until the next automatic attempt. */
  retryInSeconds?: number;
  /** What still works while offline. Omitted says nothing rather than guessing. */
  safeMessage?: string;
  onRetryNow?: () => void;
  className?: string;
}) {
  if (online) return null;
  return (
    <div role="status"
      className={cn("flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border bg-muted px-4 py-2 text-sm", className)}>
      <span className="font-medium">You&apos;re offline</span>
      {safeMessage && <span className="text-muted-foreground">{safeMessage}</span>}
      {typeof retryInSeconds === "number" && retryInSeconds > 0 && (
        <span className="text-muted-foreground tabular-nums">Retrying in {retryInSeconds}s</span>
      )}
      {onRetryNow && (
        <button type="button" onClick={onRetryNow}
          className="cursor-pointer underline underline-offset-4">Try now</button>
      )}
    </div>
  );
}
