import { cn } from "@/lib/utils";
/**
 * A slot with more bookings than places, said plainly to the owner.
 *
 * THIS IS FOR THE OWNER, NOT THE CUSTOMER. Overbooking happens through a phone
 * call taken while the website was also selling the slot, or through a manual
 * override — and the person who needs to know is the one who has to fix it,
 * before two people turn up for the same chair.
 *
 * IT NAMES THE EXCESS, not the total. "12 booked into 10 places" is arithmetic
 * somebody has to do; "2 too many" is the number of phone calls they need to
 * make.
 *
 * IT DOES NOT SUGGEST WHO TO DROP. Deciding which customer loses their slot is
 * a judgement about regulars, deposits and who booked first, and a component
 * that proposes one would be wrong most of the time and awkward the rest.
 *
 * `role="alert"`, because unlike most notes in this kit this one is a
 * situation that will become visible in the room if nobody acts.
 */
export function OverbookingNote({ booked, capacity, slot, action, className }: {
  booked: number;
  capacity: number;
  /** Which slot — "Saturday 14:00". */
  slot?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const over = booked - capacity;
  if (over <= 0) return null;
  return (
    <div role="alert"
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-foreground/40 bg-muted/40 px-3 py-2 text-sm", className)}>
      <span className="min-w-0 flex-1">
        <span className="font-medium">
          {over} too many{slot ? ` at ${slot}` : ""}
        </span>
        <span className="block text-xs text-muted-foreground">
          {booked.toLocaleString()} booked into {capacity.toLocaleString()} {capacity === 1 ? "place" : "places"}.
        </span>
      </span>
      {action}
    </div>
  );
}
