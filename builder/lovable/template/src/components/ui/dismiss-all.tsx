import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Clear all 12" — one press to get rid of a pile of notices.
 *
 * IT STATES THE COUNT, which is the same rule `bulk-actions` follows and for
 * the same reason: acting on "all" when you could only see three is the
 * mistake this pattern causes, and the number is what stops it.
 *
 * It APPEARS ONLY PAST A THRESHOLD. A "clear all" beside a single notice is
 * a second control for something the notice already has a close button for.
 *
 * It offers UNDO for a short window rather than a confirmation. Dismissing
 * notices is low-stakes and a confirm dialog for it is the sort of friction
 * that gets a product mocked — but among twelve dismissed notices there is
 * sometimes one that mattered, and undo covers that at no cost to everyone else.
 *
 * It renders nothing at zero, so a caller can leave it in the tree
 * unconditionally.
 */
export function DismissAll({ count, onDismissAll, onUndo, showFrom = 2, undoFor = 6000, label, className }: {
  count: number;
  onDismissAll: () => void;
  onUndo?: () => void;
  showFrom?: number;
  undoFor?: number;
  label?: string;
  className?: string;
}) {
  const [undoable, setUndoable] = React.useState(0);

  React.useEffect(() => {
    if (!undoable) return;
    const t = setTimeout(() => setUndoable(0), undoFor);
    return () => clearTimeout(t);
  }, [undoable, undoFor]);

  if (undoable > 0 && onUndo) {
    return (
      <span data-slot="dismiss-all" className={cn("inline-flex items-center gap-2 text-xs", className)} aria-live="polite">
        <span className="text-muted-foreground tabular-nums">
          {undoable} {undoable === 1 ? "notice" : "notices"} cleared
        </span>
        <button type="button" onClick={() => { setUndoable(0); onUndo(); }}
          className="cursor-pointer font-medium underline underline-offset-2">
          Undo
        </button>
      </span>
    );
  }

  if (count < showFrom) return null;

  return (
    <button
      type="button"
      onClick={() => { setUndoable(count); onDismissAll(); }}
      className={cn("cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground", className)}
    >
      {label ?? `Clear all ${count.toLocaleString()}`}
    </button>
  );
}
