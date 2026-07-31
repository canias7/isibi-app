import * as React from "react";
import { Undo2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "This was rolled back" — and what that did and did not undo.
 *
 * IT NAMES WHAT WAS NOT UNDONE. A rollback almost never reverses everything:
 * emails have been sent, payments taken, webhooks delivered. Saying "rolled
 * back" without that list is the most misleading thing this component could do,
 * because somebody reads it as "nothing happened".
 *
 * WHO AND WHEN, always. A rollback is somebody's decision and the first
 * question is whose.
 *
 * The REASON is required. An unexplained rollback in a history is a gap
 * somebody has to reconstruct from timestamps, usually during an incident.
 *
 * `role="status"` rather than `alert`: this is a record of something that has
 * already finished, and it is often on screen next to other history.
 */
export function RollbackNote({ by, at, reason, from, to, notUndone, onRedo, className }: {
  by?: React.ReactNode;
  at?: React.ReactNode;
  reason: React.ReactNode;
  from?: React.ReactNode;
  to?: React.ReactNode;
  notUndone?: React.ReactNode[];
  onRedo?: () => void;
  className?: string;
}) {
  return (
    <div role="status" className={cn("flex flex-col gap-2 rounded-lg border border-border p-3", className)}>
      <div className="flex items-start gap-2.5">
        <Undo2 aria-hidden className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            Rolled back{from && to ? <> from {from} to {to}</> : null}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {by ? <>by {by}</> : null}{by && at ? " · " : null}{at}
          </p>
          <p className="mt-1 text-sm">{reason}</p>
        </div>
      </div>
      {notUndone?.length ? (
        <div className="rounded-md border border-foreground p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <AlertTriangle aria-hidden className="size-3.5" />
            These were not undone
          </p>
          {/* The whole point: "rolled back" reads as "nothing happened". */}
          <ul className="mt-1 flex flex-col gap-0.5 text-xs">
            {notUndone.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      ) : null}
      {onRedo ? (
        <button type="button" onClick={onRedo}
          className="cursor-pointer self-start text-xs underline underline-offset-2">Put it back</button>
      ) : null}
    </div>
  );
}
