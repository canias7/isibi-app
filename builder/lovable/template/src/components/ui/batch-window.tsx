import { cn } from "@/lib/utils";
/**
 * "Sends at 6pm, in 40 minutes" — when a batched action will actually happen.
 *
 * BATCHED WORK LOOKS BROKEN WITHOUT THIS. Somebody presses send, nothing
 * visible happens because the job runs at six, and they press it again — or
 * report a bug. Naming the window turns an apparent failure into a schedule.
 *
 * IT SAYS WHETHER THERE IS STILL TIME TO CHANGE IT, which is the actionable
 * half. A batch that has not gone yet is editable; one that has left is not,
 * and those need different sentences and different buttons.
 *
 * THE COUNT GOING OUT IS SHOWN, because 3 and 3,000 are different things to
 * discover after the fact, and this is the last moment anybody can stop it.
 *
 * NO LIVE COUNTDOWN. A ticking clock on a scheduled job is pressure with no
 * purpose, and a client-side timer disagrees with the server about the moment
 * of send — so it states the time and the rough gap.
 */
export function BatchWindow({ at, inWords, count, noun = "messages", sent, onCancel, className }: {
  /** When it runs — "6pm". */
  at: string;
  /** How far off — "in 40 minutes". */
  inWords?: string;
  count?: number;
  noun?: string;
  /** True once the window has passed. */
  sent?: boolean;
  onCancel?: () => void;
  className?: string;
}) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", className)}>
      <span>
        {sent ? (
          <><span className="font-medium">Sent at {at}</span></>
        ) : (
          <>
            <span className="font-medium">Sends at {at}</span>
            {inWords && <span className="text-muted-foreground"> · {inWords}</span>}
          </>
        )}
        {count !== undefined && (
          <span className="block text-xs text-muted-foreground">
            <span className="tabular-nums">{count.toLocaleString()}</span> {noun}
            {sent ? " went out" : " will go out"}
          </span>
        )}
      </span>
      {!sent && onCancel && (
        <button type="button" onClick={onCancel} className="text-xs underline underline-offset-2">
          Stop this
        </button>
      )}
      {sent && <span className="text-xs text-muted-foreground">Too late to change this one.</span>}
    </p>
  );
}
