import { cn } from "@/lib/utils";
/**
 * The walk — every pick in the order the aisles actually run.
 *
 * THE SEQUENCE IS THE PRODUCT. A pick list sorted by product code sends a picker
 * up and down the same aisle six times; sorted by location it is one pass. The
 * caller supplies the order, and this renders it as a route rather than a list,
 * because the numbering is what stops somebody skipping ahead.
 *
 * THE AISLE CHANGE IS MARKED. Long lists blur, and the moment worth seeing is
 * "you are leaving aisle C" — that is where a skipped line gets noticed while
 * turning back still costs seconds.
 *
 * A SHORT PICK IS RECORDED IN PLACE, not at the end. Somebody who finds four
 * where the system says six must be able to say so at the bin; making them
 * remember it until the desk is how phantom stock persists for months.
 *
 * A SHORT LINE IS NOT STRUCK THROUGH. Strike-through reads as "nothing more to
 * do here", which is the opposite of a line somebody may come back to once the
 * replenishment lands — and the strike wins the glance against the shortfall
 * sentence underneath it.
 *
 * PROGRESS IS COUNTED IN LINES, not units — a picker knows how many stops are
 * left, and 40 units across two lines is two stops.
 */
export type PickLine = {
  id: string;
  location: string;
  aisle?: string;
  item: string;
  quantity: number;
  pickedQuantity?: number;
  short?: boolean;
};

export function PickPath({ lines, className }: { lines: PickLine[]; className?: string }) {
  const done = lines.filter((l) => l.pickedQuantity !== undefined).length;
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs tabular-nums text-muted-foreground">
        {done} of {lines.length} {lines.length === 1 ? "line" : "lines"} picked
      </p>
      <ol className="divide-y divide-border rounded-md border border-border text-sm">
        {lines.map((l, i) => {
          const newAisle = l.aisle !== undefined && l.aisle !== lines[i - 1]?.aisle;
          const picked = l.pickedQuantity !== undefined;
          const shortfall = picked ? l.quantity - (l.pickedQuantity ?? 0) : 0;
          return (
            <li key={l.id} className="px-3 py-1.5">
              {newAisle && (
                <p className="pb-1 text-xs font-medium">Aisle {l.aisle}</p>
              )}
              <p className="flex items-baseline gap-3">
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block", picked && "text-muted-foreground", picked && shortfall <= 0 && "line-through")}>{l.item}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{l.location}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {picked ? `${l.pickedQuantity}/${l.quantity}` : `×${l.quantity}`}
                </span>
              </p>
              {shortfall > 0 && (
                <p className="ps-6 text-xs font-medium tabular-nums">
                  {shortfall} short — the bin did not hold what the system said.
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
