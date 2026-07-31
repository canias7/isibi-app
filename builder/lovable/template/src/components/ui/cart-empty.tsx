import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * An empty basket that does not read as an error.
 *
 * IT DISTINGUISHES NEVER-HAD-ANYTHING FROM JUST-EMPTIED. "Your basket is
 * empty" after somebody has just removed the last item reads as a failure;
 * "That's everything removed — undo?" is the truth and rescues the mistake.
 * The undo window is the caller's, offered here because this is where the
 * regret happens.
 *
 * ONE WAY FORWARD (the empty-cta rule), and it is a real destination rather
 * than "continue shopping" pointing at the homepage — the category they came
 * from is where they were going.
 */
export function CartEmpty({ justEmptied, onUndo, action, className }: {
  justEmptied?: boolean;
  onUndo?: () => void;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-xl border border-border p-8 text-center", className)}>
      {justEmptied ? (
        <>
          <p className="text-sm font-medium">That's everything removed.</p>
          {onUndo ? (
            <button type="button" onClick={onUndo} className="cursor-pointer text-sm underline underline-offset-2">
              Undo
            </button>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-sm font-medium">Nothing in your basket yet</p>
          <p className="max-w-xs text-xs text-muted-foreground">Anything you add is kept on this device until you check out.</p>
        </>
      )}
      {action}
    </div>
  );
}
