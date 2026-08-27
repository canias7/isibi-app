import * as React from "react";
import { Check, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The resolve control on a comment thread, and the state after it.
 *
 * RESOLVING IS REVERSIBLE AND SAYS WHO DID IT. A thread is a conversation
 * between people, and "resolved" with no name is an anonymous decision nobody
 * can query — the first question anybody asks is who closed it.
 *
 * The resolved thread COLLAPSES rather than disappearing, with the outcome
 * visible. Hiding it entirely loses the record of what was agreed, which is
 * most of what a comment thread is worth a week later.
 *
 * Reopening is one press and needs no confirmation: resolving is the
 * consequential direction and it is already undoable, so a dialog on the way
 * back is friction with nothing to protect.
 *
 * It never asks "are you sure" on resolve either. `confirm-inline`'s rule
 * applies — this is reversible, so do it and offer the way back.
 */
export function ResolveThread({ resolved, by, at, onResolve, onReopen, replies, children, className }: {
  resolved?: boolean;
  by?: React.ReactNode;
  at?: React.ReactNode;
  onResolve?: () => void;
  onReopen?: () => void;
  replies?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  if (resolved) {
    return (
      <div data-slot="resolve-thread" className={cn("rounded-lg border border-border bg-muted/40 p-2.5", className)}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Check aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            Resolved{by ? <> by <strong className="font-medium">{by}</strong></> : null}
            {at ? <span className="text-muted-foreground"> · {at}</span> : null}
          </span>
          {replies ? (
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
              className="cursor-pointer text-muted-foreground underline underline-offset-2 hover:text-foreground">
              {open ? "Hide" : `Show ${replies} ${replies === 1 ? "reply" : "replies"}`}
            </button>
          ) : null}
          {onReopen ? (
            <button type="button" onClick={onReopen}
              className="inline-flex cursor-pointer items-center gap-1 underline underline-offset-2">
              <Undo2 aria-hidden className="size-3" /> Reopen
            </button>
          ) : null}
        </div>
        {open ? <div className="mt-2 border-t border-border pt-2">{children}</div> : null}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border p-2.5", className)}>
      {children}
      {onResolve ? (
        <button type="button" onClick={onResolve}
          className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted">
          <Check aria-hidden className="size-3" /> Resolve
        </button>
      ) : null}
    </div>
  );
}
