import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * What is queued to send, in the order it will go.
 *
 * The order is the content, so it is an ordered list and the positions are
 * shown. Somebody looking at this is usually asking "will my important change
 * go before the bulk import" and a set of unnumbered rows cannot answer that.
 *
 * A FAILED ENTRY DOES NOT LEAVE THE QUEUE, it is marked and kept in place.
 * Dropping it silently is how a change disappears with nobody ever being told;
 * keeping it visible means the count on the page and the work actually pending
 * are the same number.
 *
 * `paused` is stated on the queue rather than implied by an idle spinner —
 * "Paused" and "sending, slowly" look identical from outside and call for
 * completely different reactions.
 *
 * Send-now is offered only when paused, because a button that means "hurry up"
 * on an already-running queue does nothing and teaches people the interface
 * lies.
 */
export type QueuedWrite = { key: string; what: string; failed?: boolean; attempts?: number };

export function WriteQueue({ items, paused, onSendNow, onDrop, empty = "Nothing waiting to send.", className }: {
  items: QueuedWrite[];
  paused?: boolean;
  onSendNow?: () => void;
  onDrop?: (key: string) => void;
  empty?: string;
  className?: string;
}) {
  if (!items.length) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{empty}</p>;
  }
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium tabular-nums">
          {items.length} waiting to send
          {paused ? " · Paused" : ""}
        </p>
        {onSendNow && paused && (
          <Button size="sm" variant="outline" onClick={onSendNow}>Send now</Button>
        )}
      </div>
      <ol className="divide-y divide-border rounded-md border border-border">
        {items.map((q, i) => (
          <li key={q.key} className="flex items-center gap-3 p-3 text-sm">
            <span className="w-5 shrink-0 text-muted-foreground tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{q.what}</span>
            {q.failed && (
              <span className="shrink-0 text-xs font-medium">
                Failed{q.attempts ? ` ×${q.attempts}` : ""}
              </span>
            )}
            {onDrop && (
              <button type="button" onClick={() => onDrop(q.key)}
                aria-label={`Remove ${q.what} from the queue`}
                className="shrink-0 cursor-pointer text-xs underline underline-offset-2">Remove</button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
