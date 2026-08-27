import { cn } from "@/lib/utils";
/**
 * Whether a connection is actually working, judged by the last SUCCESS.
 *
 * "LAST SUCCESSFUL SYNC" IS THE ONLY HONEST HEALTH SIGNAL. A connection shows
 * as connected because a token exists, which says nothing about whether
 * anything has moved through it — and a sync that has been failing silently for
 * three weeks looks identical to one that ran ten minutes ago.
 *
 * FOUR STATES, NOT TWO. Working, failing, needs-attention (a token about to
 * expire, a permission withdrawn) and never-run — that last one catches the
 * connection somebody set up and never finished, which reports as healthy
 * everywhere else.
 *
 * THE ERROR IS SHOWN ON THE ROW when there is one, because the reason is
 * usually specific and actionable — "the account no longer has permission" is
 * fixed in a minute by somebody who is told.
 *
 * `role="status"` and words rather than a coloured dot: this is the screen
 * somebody screenshots into a support ticket.
 */
export function ConnectionHealth({ state, lastSuccess, error, failingSince, action, className }: {
  state: "working" | "failing" | "attention" | "never";
  /** Free text — "10 minutes ago". */
  lastSuccess?: string;
  /** Why it is failing. */
  error?: string;
  /** Free text — "3 weeks". */
  failingSince?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const WORD = {
    working: "Working",
    failing: "Not working",
    attention: "Needs attention",
    never: "Never run",
  } as const;
  const bad = state === "failing" || state === "attention";
  return (
    <div data-slot="connection-health" role="status"
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-sm",
        bad ? "border-foreground/40 bg-muted/40" : "border-border", className)}>
      <span className="min-w-0 flex-1">
        <span className={cn("block", state !== "working" && "font-medium")}>{WORD[state]}</span>
        <span className="block text-xs text-muted-foreground">
          {state === "never"
            ? "This has never synced since it was set up."
            : lastSuccess ? `Last successful sync ${lastSuccess}` : "No successful sync recorded"}
          {failingSince && <span> · failing for {failingSince}</span>}
        </span>
        {error && <span className="block text-xs">{error}</span>}
      </span>
      {action}
    </div>
  );
}
