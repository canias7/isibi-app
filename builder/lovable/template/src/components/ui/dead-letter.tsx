import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Events that were never delivered and are no longer being retried.
 *
 * THIS QUEUE IS INVISIBLE UNTIL SOMEBODY LOOKS, which is why it needs a
 * headline rather than being a tab. Events that exhausted their retries are
 * gone in every practical sense — no alert fires, nothing is broken, and the
 * business simply never learns about a hundred bookings.
 *
 * THE OLDEST ITEM'S AGE IS THE ALARMING NUMBER, not the count. Forty events
 * from this morning is an outage that has ended; four from three weeks ago is a
 * failure nobody has noticed since, and the count reads the same in both.
 *
 * IT SAYS WHEN THE QUEUE ITSELF EXPIRES. Dead letters are usually kept for a
 * bounded period and then deleted for good — replaying is only possible until
 * then, and that deadline is the reason to act today.
 *
 * REPLAY-ALL CONFIRMS WITH THE COUNT, because it is the one action here that
 * can deliver hundreds of duplicate events to an endpoint in one press.
 */
export function DeadLetter({ count, oldest, keptFor, onReplayAll, onDiscard, busy, className }: {
  count: number;
  /** Free text — "3 weeks ago". */
  oldest?: string;
  /** Free text — "30 days". */
  keptFor?: string;
  onReplayAll?: () => void;
  onDiscard?: () => void;
  busy?: boolean;
  className?: string;
}) {
  if (count <= 0) {
    return <p data-slot="dead-letter" className={cn("text-sm text-muted-foreground", className)}>Nothing has been given up on.</p>;
  }
  return (
    <div className={cn("space-y-2 rounded-md border border-foreground/40 bg-muted/40 p-3", className)}>
      <p className="text-sm">
        <span className="font-medium tabular-nums">{count.toLocaleString()}</span>
        {count === 1 ? " event was" : " events were"} never delivered
        {oldest && <span className="block text-xs text-muted-foreground">The oldest is from {oldest}.</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        We have stopped retrying these.
        {keptFor && ` They are kept for ${keptFor}, then deleted.`}
      </p>
      <div className="flex flex-wrap gap-2">
        {onReplayAll && (
          <Button type="button" size="sm" disabled={busy}
            onClick={() => {
              if (window.confirm(`Send all ${count.toLocaleString()} again? Your endpoint may act on any it has already seen.`)) onReplayAll();
            }}>
            Send them all again
          </Button>
        )}
        {onDiscard && (
          <Button type="button" size="sm" variant="outline" disabled={busy}
            onClick={() => { if (window.confirm(`Discard ${count.toLocaleString()} events for good?`)) onDiscard(); }}>
            Discard them
          </Button>
        )}
      </div>
    </div>
  );
}
