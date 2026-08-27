import { cn } from "@/lib/utils";
/**
 * "This clashes with the 14:00."
 *
 * A WARNING, NOT A REFUSAL — and that distinction is the component. Plenty of
 * overlaps are deliberate: two staff, a double-booked room the owner knows
 * about, a deliberately overlapping shift handover. Blocking them all makes the
 * system wrong more often than the user is; saying so and letting them proceed
 * is right in both cases.
 *
 * IT NAMES WHAT IT CLASHES WITH, with the time. "Overlaps an existing booking"
 * sends somebody hunting a calendar; "Overlaps Mrs Trelawny, 14:00–15:00" is a
 * decision they can make on the spot.
 *
 * Several clashes are listed rather than counted, capped, because the second and
 * third are usually what reveals the real problem — a whole afternoon
 * double-booked rather than one slot.
 *
 * `role="status"` rather than `alert`: this appears while somebody is still
 * typing into a form, and interrupting on every keystroke that produces a clash
 * is unbearable.
 */
export function OverlapWarning({ clashes, note, max = 3, className }: {
  /** What it collides with — "Mrs Trelawny, 14:00–15:00". */
  clashes: string[];
  /** Extra context, e.g. "You have two chairs, so this may be fine." */
  note?: string;
  max?: number;
  className?: string;
}) {
  if (!clashes.length) return null;
  const shown = clashes.slice(0, max);
  const rest = clashes.length - shown.length;

  return (
    <div data-slot="overlap-warning" role="status" className={cn("flex flex-col gap-1 text-sm", className)}>
      <p className="font-medium">
        {clashes.length === 1 ? "This overlaps something" : `This overlaps ${clashes.length} things`}
      </p>
      <ul className="text-muted-foreground">
        {shown.map((c, i) => <li key={i}>{c}</li>)}
        {rest > 0 && <li className="tabular-nums">and {rest} more</li>}
      </ul>
      {note && <p className="text-muted-foreground">{note}</p>}
    </div>
  );
}
