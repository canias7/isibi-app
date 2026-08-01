import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Move up, move down. The half of reordering that works without a mouse.
 *
 * DRAG AND DROP IS UNREACHABLE FOR A LOT OF PEOPLE — keyboard only, switch
 * access, a tremor, a trackpad on a train. Every draggable list needs this
 * beside it, and shipping the handles without it makes reordering a feature
 * only some readers have.
 *
 * The buttons are DISABLED AT THE ENDS rather than hidden. Controls that
 * disappear on the first and last row shift every other row's buttons sideways,
 * so the target moves as you use it — the worst possible behaviour for a
 * control you press repeatedly.
 *
 * Each button names the item AND the direction, so a screen reader gets "Move
 * Full restoration up" rather than twenty buttons called "Move up". `position`
 * and `total` go into the label too, because after a move the only way to know
 * it worked is to be told where the thing landed.
 */
export function ReorderButtons({ label, position, total, onMove, className }: {
  /** The item being moved, for the accessible labels. */
  label: string;
  /** 1-based. */
  position: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
  className?: string;
}) {
  const first = position <= 1, last = position >= total;
  return (
    <span className={cn("inline-flex gap-1", className)}>
      <button type="button" disabled={first} onClick={() => onMove(-1)}
        aria-label={`Move ${label} up, currently ${position} of ${total}`}
        className="grid size-7 cursor-pointer place-items-center rounded border border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
        <ChevronUp className="size-3.5" aria-hidden />
      </button>
      <button type="button" disabled={last} onClick={() => onMove(1)}
        aria-label={`Move ${label} down, currently ${position} of ${total}`}
        className="grid size-7 cursor-pointer place-items-center rounded border border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
        <ChevronDown className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}
