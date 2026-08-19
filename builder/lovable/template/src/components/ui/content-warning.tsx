import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A cover over content, with the reason stated and the choice per item.
 *
 * THE CATEGORY IS NAMED — "Discusses an injury", not "sensitive content".
 * The whole point of a warning is letting somebody decide whether THIS is a
 * thing they want to see right now, and a vague label gives them nothing to
 * decide with. `category` is required for that reason.
 *
 * THE CHOICE IS PER ITEM AND PER VISIT. Revealing one photo must not reveal
 * the next one, and must not be remembered forever — the person who could
 * face it on Tuesday gets to decide again on Thursday. No storage at all.
 *
 * IT CAN BE RE-COVERED. "Hide again" matters when a screen is shared or
 * someone walks past; a reveal with no way back turns a considerate feature
 * into a trap.
 *
 * The covered state reserves the content's space (the content renders,
 * hidden), so revealing does not reflow the page under the pointer.
 */
export function ContentWarning({ category, why, children, className }: {
  category: string;
  why?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [shown, setShown] = React.useState(false);
  return (
    <div className={cn("relative", className)}>
      <div className={shown ? "" : "invisible"} aria-hidden={!shown}>{children}</div>
      {shown ? (
        <button type="button" onClick={() => setShown(false)}
          className="absolute end-2 top-2 cursor-pointer rounded-md border border-border bg-background/90 px-2 py-0.5 text-xs shadow-sm">
          Hide again
        </button>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted p-4 text-center">
          <p className="text-sm font-medium">{category}</p>
          {why ? <p className="max-w-sm text-xs text-muted-foreground">{why}</p> : null}
          <button type="button" onClick={() => setShown(true)}
            className="cursor-pointer rounded-md border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-muted">
            Show anyway
          </button>
        </div>
      )}
    </div>
  );
}
