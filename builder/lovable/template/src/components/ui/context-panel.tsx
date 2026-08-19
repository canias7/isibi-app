import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The right-hand panel showing details of whatever is selected.
 *
 * NOTHING SELECTED IS A REAL STATE with its own message, not an empty box. A
 * blank panel beside a list reads as broken; "Select a booking to see its
 * details" reads as instructions.
 *
 * A MULTI-SELECTION is a third state, not the first item. The panel says how
 * many are selected and offers the actions that apply to all of them — showing
 * one row's details while nine are selected is actively misleading about what a
 * button will act on.
 *
 * It is an `<aside>` with an accessible name and `aria-live="polite"` on the
 * heading, so changing the selection announces what is now shown. Without that,
 * a keyboard user arrowing down a list gets no feedback that anything changed.
 *
 * On a phone it is a SHEET rather than a column, for the same reason
 * `slide-over` is: a details column beside a list on 375px leaves neither
 * usable.
 */
export function ContextPanel({
  selectedCount = 0, title, children, empty, bulk, onClose, label = "Details", className,
}: {
  selectedCount?: number;
  title?: React.ReactNode;
  children?: React.ReactNode;
  empty?: React.ReactNode;
  bulk?: React.ReactNode;
  onClose?: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <aside aria-label={label}
      className={cn("flex h-full min-h-0 w-full flex-col border-border bg-background lg:w-72 lg:border-s", className)}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <h2 aria-live="polite" className="min-w-0 flex-1 truncate text-sm font-semibold">
          {selectedCount > 1 ? `${selectedCount} selected` : selectedCount === 1 ? title : label}
        </h2>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close the details panel"
            className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden">
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {selectedCount === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {empty ?? "Select something to see its details."}
          </p>
        ) : selectedCount > 1 ? (
          bulk ?? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {selectedCount} items selected. Choose an action above.
            </p>
          )
        ) : (
          children
        )}
      </div>
    </aside>
  );
}
