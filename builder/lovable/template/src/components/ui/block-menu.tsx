import * as React from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GripVertical, Copy, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The handle beside a block, and what it can do.
 *
 * Move up and move down are HERE as well as being draggable, and that is the
 * point: drag-and-drop is unusable from a keyboard and awkward on a phone, so
 * a block that can only be moved by dragging cannot be reordered by everyone.
 *
 * It stays in the DOM at all times and only changes opacity on hover —
 * mounting it on hover makes the handle jump away as the pointer approaches.
 */
export function BlockMenu({ onMoveUp, onMoveDown, onDuplicate, onDelete, dragProps, className }: {
  onMoveUp?: () => void; onMoveDown?: () => void; onDuplicate?: () => void; onDelete?: () => void;
  dragProps?: React.HTMLAttributes<HTMLButtonElement>; className?: string;
}) {
  return (
    <div data-slot="block-menu" className={cn("flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Block options" {...dragProps}>
            <GripVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {onMoveUp && <DropdownMenuItem onClick={onMoveUp}><ArrowUp className="size-4" />Move up</DropdownMenuItem>}
          {onMoveDown && <DropdownMenuItem onClick={onMoveDown}><ArrowDown className="size-4" />Move down</DropdownMenuItem>}
          {onDuplicate && <DropdownMenuItem onClick={onDuplicate}><Copy className="size-4" />Duplicate</DropdownMenuItem>}
          {onDelete && <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="size-4" />Delete
            </DropdownMenuItem>
          </>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
