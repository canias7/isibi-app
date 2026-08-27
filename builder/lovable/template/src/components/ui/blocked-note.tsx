import * as React from "react";
import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "This is blocked" — by what, on whom, and since when.
 *
 * ALL THREE OR IT IS NOT WORTH SHOWING. "Blocked" alone is a status nobody can
 * act on; the blocker, the person and the elapsed time are what turn it into a
 * next step and a nudge. The elapsed time in particular is what makes a
 * two-week block visible.
 *
 * THE BLOCKER IS A LINK where there is one, so getting from the blocked thing
 * to the thing blocking it is one press. Following a dependency by searching
 * for its name is how people stop recording them.
 *
 * IT DISTINGUISHES BLOCKED FROM WAITING. Blocked means something else must
 * finish; waiting means a person must act. They need different nudges and
 * collapsing them makes a board unreadable.
 *
 * `role="status"` — this is a state of the record, not an alert about it.
 */
export function BlockedNote({ kind = "blocked", by, href, who, since, note, onNudge, className }: {
  kind?: "blocked" | "waiting";
  by?: React.ReactNode;
  href?: string;
  who?: React.ReactNode;
  since?: React.ReactNode;
  note?: React.ReactNode;
  onNudge?: () => void;
  className?: string;
}) {
  return (
    <div data-slot="blocked-note" role="status" className={cn("flex flex-wrap items-start gap-2 rounded-md border border-border bg-muted/40 p-2.5 text-xs", className)}>
      <Ban aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p>
          <strong className="font-medium">{kind === "blocked" ? "Blocked" : "Waiting"}</strong>
          {by ? (
            <> by {href ? <a href={href} className="underline underline-offset-2">{by}</a> : by}</>
          ) : null}
          {who ? <> on {who}</> : null}
          {/* The elapsed time is what makes a two-week block visible. */}
          {since ? <span className="text-muted-foreground"> · {since}</span> : null}
        </p>
        {note ? <p className="mt-0.5 text-muted-foreground">{note}</p> : null}
      </div>
      {onNudge && who ? (
        <button type="button" onClick={onNudge}
          className="shrink-0 cursor-pointer underline underline-offset-2">Nudge</button>
      ) : null}
    </div>
  );
}
