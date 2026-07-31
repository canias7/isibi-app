import * as React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Passed from Ada to Grace" — who owns this now.
 *
 * THE CURRENT OWNER IS THE PROMINENT ONE, not the sequence. A handover bar that
 * reads as a chain makes the eye travel to find who has it now; the current
 * owner is bold and last, and the history is secondary.
 *
 * UNASSIGNED IS A REAL STATE and it is the loudest one. A record owned by
 * nobody is the thing that sits untouched for a month, and rendering it as an
 * empty avatar makes it invisible on a board.
 *
 * THE HANDOVER NOTE IS SHOWN, not hidden behind the timestamp. The reason
 * something was passed on is the context the next person needs, and it is
 * almost always one sentence.
 *
 * A REASSIGN control sits here rather than in a menu, because the moment
 * somebody reads who owns it is the moment they know it is wrong.
 */
export function HandoverBar({ from, to, at, note, onReassign, className }: {
  from?: React.ReactNode;
  to?: React.ReactNode;
  at?: React.ReactNode;
  note?: React.ReactNode;
  onReassign?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-md border border-border p-2.5", className)}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {from ? (
          <>
            <span className="text-muted-foreground">{from}</span>
            <ArrowRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          </>
        ) : null}
        {to ? (
          <span className="font-medium">{to}</span>
        ) : (
          // The loudest state: a record owned by nobody sits for a month.
          <span className="rounded-full border-2 border-foreground px-2 py-0.5 text-xs font-medium">
            Nobody owns this
          </span>
        )}
        {at ? <span className="text-xs text-muted-foreground">{at}</span> : null}
        <span className="flex-1" />
        {onReassign ? (
          <button type="button" onClick={onReassign}
            className="cursor-pointer text-xs underline underline-offset-2">
            {to ? "Pass it on" : "Assign it"}
          </button>
        ) : null}
      </div>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
