import { cn } from "@/lib/utils";
/**
 * Move this stock from where it landed to where it belongs.
 *
 * BOTH ENDS ARE SHOWN. A putaway that names only the destination sends somebody
 * hunting a pallet across a goods-in bay; naming only the source is a shrug. The
 * pair is the task.
 *
 * THE SUGGESTED BIN CAN BE REFUSED, and the component says why it was chosen.
 * "Nearest empty to its pick face" is checkable by the person standing there,
 * who can see the bin is blocked — a bare instruction gets ignored silently and
 * the stock goes somewhere nobody records.
 *
 * A PART PUTAWAY IS NORMAL. A pallet rarely fits one bin, so the quantity moved
 * is separate from the quantity on the task and both are shown — otherwise the
 * task is closed with stock still on the floor.
 *
 * CONSTRAINTS TRAVEL WITH THE TASK. Weight on an upper level, a cold chain, a
 * hazardous class that cannot sit next to food — the destination is only valid
 * against them, and they are not in anybody's head at 6am.
 */
export function PutawayTask({ item, quantity, movedQuantity, from, to, reason, constraint, className }: {
  item: string;
  quantity: number;
  /** Already put away, where a task is part-done. */
  movedQuantity?: number;
  /** Where it is now — "Goods-in bay 3". */
  from: string;
  /** Suggested destination. */
  to: string;
  /** Why that bin — "nearest empty to its pick face". */
  reason?: string;
  /** "Max 400kg on level 3", "keep away from food". */
  constraint?: string;
  className?: string;
}) {
  const done = movedQuantity ?? 0;
  const left = quantity - done;
  return (
    <li data-slot="putaway-task" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p>
        <span className="font-medium">{item}</span>
        <span className="text-muted-foreground tabular-nums"> · {left} of {quantity} left to move</span>
      </p>
      <p className="text-xs">
        <span className="text-muted-foreground">From </span>
        <span className="font-mono">{from}</span>
        <span className="text-muted-foreground"> to </span>
        <span className="font-mono">{to}</span>
      </p>
      {reason && <p className="text-xs text-muted-foreground">Chosen as the {reason}.</p>}
      {constraint && <p className="text-xs font-medium">{constraint}</p>}
    </li>
  );
}
