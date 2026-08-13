import { cn, toDate } from "@/lib/utils";
/**
 * One attempt to deliver an event — status, timing, and what comes next.
 *
 * "WILL RETRY" VS "GAVE UP" IS THE FIELD PEOPLE COME FOR. A failed attempt that
 * will be retried in four minutes needs no action; the same row with no further
 * attempts means the event is lost unless somebody replays it. Every webhook
 * log shows the status code and leaves that unanswered.
 *
 * THE RESPONSE BODY IS TRUNCATED AND MONOSPACED. A receiving server's error is
 * usually one useful line inside a page of HTML, and dumping the whole thing
 * makes the log unreadable — but hiding it entirely removes the only clue.
 *
 * A TIMEOUT IS DISTINGUISHED FROM AN ERROR STATUS. They have different causes
 * and different fixes: a 500 is their code, a timeout is usually work being
 * done inline that should be queued.
 *
 * `<li>` composing into a list, with the duration in `tabular-nums` — a column
 * of response times is how somebody spots the endpoint that is slowly dying.
 */
export function DeliveryAttempt({ number, at, outcome, status, ms, body, nextRetry, className }: {
  /** Which attempt this was. */
  number: number;
  /** ISO date-time. */
  at?: string;
  outcome: "ok" | "error" | "timeout" | "refused";
  /** HTTP status, when there was one. */
  status?: number;
  ms?: number;
  /** Their response, truncated by the caller. */
  body?: string;
  /** Free text — "in 4 minutes", or absent if it gave up. */
  nextRetry?: string;
  className?: string;
}) {
  const d = at ? toDate(at) : null;
  const ok = d && !Number.isNaN(d.getTime());
  const WORD = { ok: "Delivered", error: "Rejected", timeout: "Timed out", refused: "Could not connect" } as const;
  const failed = outcome !== "ok";
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-xs tabular-nums text-muted-foreground">#{number}</span>
        <span className={cn(failed && "font-medium")}>{WORD[outcome]}</span>
        {status !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{status}</span>}
        {ms !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{ms} ms</span>}
        {ok && (
          <time dateTime={d!.toISOString()} className="ml-auto text-xs text-muted-foreground">
            {d!.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </time>
        )}
      </div>
      {body && <code className="block break-all font-mono text-xs text-muted-foreground">{body}</code>}
      {failed && (
        <p className="text-xs text-muted-foreground">
          {nextRetry
            ? `Trying again ${nextRetry}.`
            : <span className="font-medium text-foreground">No more attempts — this event was not delivered.</span>}
        </p>
      )}
    </li>
  );
}
