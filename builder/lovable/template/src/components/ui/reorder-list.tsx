import { GripVertical } from "lucide-react";
import { DropIndicator } from "@/components/ui/drop-indicator";
import { ReorderButtons } from "@/components/ui/reorder-buttons";
import { cn } from "@/lib/utils";
/**
 * A list you can put in a different order — by dragging, or without a mouse.
 *
 * BOTH ROUTES SHIP TOGETHER. Drag handles alone make reordering a feature only
 * some readers have; `reorder-buttons` sits on every row beside the handle, and
 * that is not an optional prop because a caller who forgets it has quietly
 * excluded people.
 *
 * `aria-live` announces the result of a move — "Full restoration, now 2 of 5".
 * A silent reorder is the reason keyboard reordering feels broken even when it
 * works: the row changes place and nothing says so.
 *
 * A pinned row keeps its position and says why, through `drag-disabled-note`,
 * rather than silently refusing.
 *
 * The drag events themselves are the CALLER'S. Which library or hand-rolled
 * pointer maths does the moving differs per page; what belongs here is the
 * markup, the accessible names and the announcement, which is the half that
 * gets skipped.
 */
export type ReorderItem = { key: string; label: React.ReactNode; name: string; locked?: string };

export function ReorderList({ items, onMove, dropIndex, announce, className }: {
  items: ReorderItem[];
  onMove: (key: string, direction: -1 | 1) => void;
  /** Gap to draw the drop line above, while dragging. */
  dropIndex?: number | null;
  /** "Full restoration, now 2 of 5" — announced politely. */
  announce?: string;
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div data-slot="reorder-list" className={cn("flex flex-col", className)}>
      <p role="status" aria-live="polite" className="sr-only">{announce ?? ""}</p>
      <ol className="divide-y divide-border rounded-md border border-border">
        {items.map((it, i) => (
          <li key={it.key} className="relative">
            {dropIndex === i && <DropIndicator className="absolute -top-px start-0" />}
            <div className="flex items-center gap-3 p-3">
              <span aria-hidden className={cn("shrink-0", it.locked ? "opacity-30" : "cursor-grab text-muted-foreground")}>
                <GripVertical className="size-4" />
              </span>
              <span className="min-w-0 flex-1 text-sm">{it.label}</span>
              {it.locked ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  <span className="sr-only">{it.name} cannot be moved: </span>{it.locked}
                </span>
              ) : (
                <ReorderButtons label={it.name} position={i + 1} total={items.length}
                  onMove={(d) => onMove(it.key, d)} />
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
