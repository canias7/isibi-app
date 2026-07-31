import * as React from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
/**
 * A grid of cards you can drag into a new order — gallery images, dashboard
 * tiles.
 *
 * THE KEYBOARD SENSOR IS WIRED, which is the half everyone omits. Without it
 * the order can only be changed by dragging, and a control whose entire
 * output is an order becomes unusable without a mouse. Space picks a tile up,
 * arrows move it, Space drops it.
 *
 * Each tile needs a STABLE id that is not its index — using the index means
 * dnd-kit re-identifies every tile the moment one moves, and the animation
 * jumps.
 */
function Tile({ id, children }: { id: string; children?: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("cursor-grab touch-none rounded-lg border border-border bg-card p-3 active:cursor-grabbing",
        isDragging && "opacity-50 ring-2 ring-ring")}>
      {children}
    </div>
  );
}
export function ReorderableGrid({ items, onReorder, columns = 3, className }: {
  items: { id: string; content: React.ReactNode }[];
  onReorder: (ids: string[]) => void; columns?: 2 | 3 | 4; className?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map((i) => i.id);
  const cols = { 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[columns];
  const onEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id)), to = ids.indexOf(String(over.id));
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onReorder(next);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={cn("grid gap-3", cols, className)}>
          {items.map((it) => <Tile key={it.id} id={it.id}>{it.content}</Tile>)}
        </div>
      </SortableContext>
    </DndContext>
  );
}
