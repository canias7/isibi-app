import { Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The last few things you did, each one undoable.
 *
 * UNDO ONLY REACHES THE TOP OF THE STACK, and the rest are shown greyed with
 * no control. That is not a limitation to hide — it is how undo works
 * everywhere, and a list where every row has its own button implies you can
 * pull one out of the middle, which either silently undoes everything above it
 * or does something incoherent.
 *
 * The most recent is FIRST. A stack rendered oldest-first makes somebody read
 * to the bottom to find the thing they just did, which is the only row they
 * came for.
 *
 * Each entry says what it was, not what it did to the database — "Deleted
 * Tuesday's booking" rather than "DELETE appointments 4471".
 */
export type UndoEntry = { key: string; what: string; when?: string };

export function UndoStack({ entries, onUndo, empty = "Nothing to undo.", className }: {
  /** Most recent first. */
  entries: UndoEntry[];
  onUndo: (key: string) => void;
  empty?: string;
  className?: string;
}) {
  if (!entries.length) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{empty}</p>;
  }
  const [top, ...rest] = entries;
  return (
    <ol className={cn("divide-y divide-border rounded-md border border-border", className)}>
      <li className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{top.what}</p>
          {top.when && <p className="text-xs text-muted-foreground">{top.when}</p>}
        </div>
        <button type="button" onClick={() => onUndo(top.key)}
          aria-label={`Undo ${top.what}`}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded border border-border px-2.5 py-1 text-sm hover:bg-muted">
          <Undo2 className="size-3.5" aria-hidden />Undo
        </button>
      </li>
      {rest.map((e) => (
        <li key={e.key} className="flex items-center justify-between gap-3 p-3 text-muted-foreground">
          <div className="min-w-0">
            <p className="text-sm">{e.what}</p>
            {e.when && <p className="text-xs">{e.when}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
