import * as React from "react";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A list you can reorder by dragging — and by two buttons.
 *
 * THE BUTTONS ARE NOT OPTIONAL. HTML5 drag-and-drop is unreachable from a
 * keyboard and unsupported on touch, so a drag-only list makes ordering — often
 * the whole point of the screen — a mouse privilege. Same reasoning as
 * `column-reorder`.
 *
 * `dragover` must call `preventDefault()` or no drop event ever fires. That one
 * line is why most hand-rolled drag lists "don't work" and it is impossible to
 * guess from the API.
 *
 * The drop TARGET is an edge — above or below the row's midpoint — not the row
 * itself, so where the item will land is unambiguous. And dropping below a row
 * that sits ABOVE the dragged one is off by one once the item is removed, which
 * is the classic reorder bug.
 *
 * A move is ANNOUNCED. Reordering with the buttons produces no visible change
 * for somebody not looking at the list, and "Moved to position 3 of 6" is what
 * makes the keyboard path usable rather than merely present.
 */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

export function DragList<T>({ items, getKey, renderItem, onReorder, label = "item", className }: {
  items: T[];
  getKey: (item: T, index: number) => React.Key;
  renderItem: (item: T, index: number) => React.ReactNode;
  onReorder: (next: T[]) => void;
  label?: string;
  className?: string;
}) {
  const [dragging, setDragging] = React.useState<number | null>(null);
  const [over, setOver] = React.useState<{ index: number; below: boolean } | null>(null);
  const [said, setSaid] = React.useState("");

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    onReorder(moveItem(items, from, to));
    setSaid(`Moved to position ${to + 1} of ${items.length}`);
  };

  return (
    <>
      <ul className={cn("flex flex-col", className)}>
        {items.map((item, i) => (
          <li
            key={getKey(item, i)}
            draggable
            onDragStart={(e) => { setDragging(i); e.dataTransfer.effectAllowed = "move"; }}
            onDragEnd={() => { setDragging(null); setOver(null); }}
            // Without preventDefault here, no drop event ever fires.
            onDragOver={(e) => {
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              setOver({ index: i, below: e.clientY > r.top + r.height / 2 });
            }}
            onDragLeave={() => setOver((o) => (o?.index === i ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragging;
              const spot = over;
              setDragging(null);
              setOver(null);
              if (from == null || !spot) return;
              let to = spot.below ? spot.index + 1 : spot.index;
              if (from < to) to -= 1;
              move(from, to);
            }}
            className={cn("flex items-center gap-2 border-b border-border py-1.5 last:border-0",
              dragging === i && "opacity-40",
              over?.index === i && !over.below && "shadow-[inset_0_2px_0_0_currentColor]",
              over?.index === i && over.below && "shadow-[inset_0_-2px_0_0_currentColor]")}
          >
            <GripVertical aria-hidden className="size-4 shrink-0 cursor-grab text-muted-foreground" />
            <div className="min-w-0 flex-1">{renderItem(item, i)}</div>
            <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0}
              aria-label={`Move ${label} ${i + 1} up`}
              className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
              <ChevronUp aria-hidden className="size-3.5" />
            </button>
            <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1}
              aria-label={`Move ${label} ${i + 1} down`}
              className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
              <ChevronDown aria-hidden className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="sr-only">{said}</p>
    </>
  );
}
