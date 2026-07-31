import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The bar above a list — count on the left, controls on the right.
 *
 * The COUNT is always there and is the first thing in the DOM, because
 * "showing 24 of 1,340" is the single most useful fact about any list and the
 * thing people look for when a filter has done something unexpected.
 *
 * It becomes a SELECTION bar when something is ticked, replacing the controls
 * rather than sitting beside them: two rows of buttons, half of which do not
 * apply, is how somebody deletes the wrong thing.
 */
export function ListToolbar({ total, showing, selected = 0, onClearSelection, actions, children, className }: {
  total?: number; showing?: number; selected?: number; onClearSelection?: () => void;
  actions?: React.ReactNode; children?: React.ReactNode; className?: string;
}) {
  if (selected > 0) {
    return (
      <div className={cn("flex flex-wrap items-center gap-3 rounded-md bg-muted px-3 py-2", className)}>
        <p className="text-sm">
          <strong className="tabular-nums">{selected}</strong> selected
        </p>
        {onClearSelection && (
          <button type="button" onClick={onClearSelection}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Clear
          </button>
        )}
        <span className="flex-1" />
        {actions}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-3 border-b border-border pb-2", className)}>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total == null ? null
          : showing != null && showing < total
            ? <>Showing <strong className="font-medium tabular-nums text-foreground">{showing}</strong> of {total.toLocaleString()}</>
            : <><strong className="font-medium tabular-nums text-foreground">{total.toLocaleString()}</strong> {total === 1 ? "item" : "items"}</>}
      </p>
      <span className="flex-1" />
      {children}
    </div>
  );
}
