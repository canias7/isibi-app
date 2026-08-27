import { cn } from "@/lib/utils";
/**
 * Waiting for a copy — position, and roughly how long that means.
 *
 * A POSITION IS MEANINGLESS WITHOUT THE NUMBER OF COPIES. Fourth in the queue
 * for one copy is months; fourth for twelve copies is next week. Showing the
 * rank alone is the standard failure and it makes every wait look the same.
 *
 * THE ESTIMATE IS HEDGED AND EXPLAINED. It depends on when other readers
 * return things, which nobody can predict, so it is offered as a rough figure
 * with its basis stated rather than as a date somebody will plan around.
 *
 * IT SAYS HOW LONG THE ITEM IS HELD ONCE IT ARRIVES. A reserved copy waits on a
 * shelf for a few days and then goes to the next reader — missing that window
 * after a three-month wait is the most annoying way to lose a place.
 *
 * SUSPENDING A HOLD IS OFFERED WHERE THE SERVICE ALLOWS IT, because the answer
 * to "I am away when it arrives" is otherwise cancelling and re-queueing from
 * the bottom.
 */
export function HoldQueue({ title, position, aheadOf, copies, estimateNote, holdDays, canSuspend, className }: {
  title?: string;
  /** 1 means next. */
  position: number;
  /** Total readers waiting. */
  aheadOf?: number;
  /** How many copies are in circulation. */
  copies?: number;
  /** Pre-formatted — "about 6 weeks". */
  estimateNote?: string;
  /** Days it is held on the shelf once it arrives. */
  holdDays?: number;
  canSuspend?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="hold-queue" className={cn("space-y-0.5 text-sm", className)}>
      {title && <p>{title}</p>}
      <p>
        <span className="tabular-nums font-medium">
          {position === 1 ? "You are next" : `Number ${position} in the queue`}
        </span>
        {(copies !== undefined || aheadOf !== undefined) && (
          <span className="block text-xs tabular-nums text-muted-foreground">
            {aheadOf !== undefined && `${aheadOf} waiting`}
            {aheadOf !== undefined && copies !== undefined ? " · " : ""}
            {copies !== undefined && `${copies} ${copies === 1 ? "copy" : "copies"} in circulation`}
          </span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {estimateNote
          ? `Roughly ${estimateNote} — it depends on when other readers bring theirs back.`
          : "We cannot estimate the wait — it depends on when other readers bring theirs back."}
      </p>
      {holdDays !== undefined && (
        <p className="text-xs">
          Once it arrives we hold it for {holdDays} {holdDays === 1 ? "day" : "days"}, then it goes to the next reader.
        </p>
      )}
      {canSuspend && (
        <p className="text-xs text-muted-foreground">
          Going away? Pause the hold — you keep your place in the queue.
        </p>
      )}
    </div>
  );
}
