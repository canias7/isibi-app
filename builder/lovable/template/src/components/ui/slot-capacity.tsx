import { cn } from "@/lib/utils";
/**
 * How many places are left in one time slot.
 *
 * IT SAYS "FULL" RATHER THAN SHOWING ZERO. A slot displaying "0 left" is still
 * read as a slot somebody can try, and they do — then get refused at submit. A
 * word plus a disabled control is the only version that stops the attempt.
 *
 * IT GOES QUIET WHEN THERE IS PLENTY. "18 of 20 left" on every row is noise
 * that trains people to skip the number, and scarcity shown constantly reads as
 * a sales tactic. It speaks up near the end, which is when it is true.
 *
 * IT NEVER INVENTS URGENCY. There is no "only 2 left!" styling and no timer —
 * `warnAt` is the caller's own threshold, and the sentence is flat. A capacity
 * indicator that exaggerates is one nobody believes on the day it matters.
 *
 * `aria-hidden` ON NOTHING HERE — the whole state is text, so a screen reader
 * gets the same facts in the same order, which is the point of not encoding it
 * in a bar.
 */
export function SlotCapacity({ left, total, warnAt = 3, unit = "places", className }: {
  left: number;
  total?: number;
  /** Below this it speaks up. */
  warnAt?: number;
  unit?: string;
  className?: string;
}) {
  if (left <= 0) {
    return <span data-slot="slot-capacity" className={cn("text-sm font-medium", className)}>Full</span>;
  }
  if (left > warnAt) {
    return total !== undefined
      ? <span className={cn("text-xs text-muted-foreground", className)}>{left} of {total} {unit} left</span>
      : null;
  }
  return (
    <span className={cn("text-sm font-medium", className)}>
      {left} {left === 1 ? unit.replace(/s$/, "") : unit} left
    </span>
  );
}
