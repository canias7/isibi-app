import * as React from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The grip you pick a row up by.
 *
 * A REAL BUTTON with a label, not a styled div. That is what makes a
 * draggable list reachable from a keyboard at all — @dnd-kit's keyboard
 * sensor needs something focusable to attach to, and a div with a grip icon
 * gives it nothing.
 *
 * `touch-none` is required rather than cosmetic: without it a drag on a phone
 * scrolls the page instead of moving the row, because the browser claims the
 * gesture first.
 *
 * The label names the thing being moved. "Drag handle" repeated forty times
 * tells nobody which row they are holding.
 */
export function DragHandle({ label, listeners, attributes, className }: {
  label: string;
  listeners?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  className?: string;
}) {
  return (
    <button data-slot="drag-handle" type="button" aria-label={`Reorder ${label}`} {...attributes} {...listeners}
      className={cn("cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing", className)}>
      <GripVertical className="size-4" />
    </button>
  );
}
