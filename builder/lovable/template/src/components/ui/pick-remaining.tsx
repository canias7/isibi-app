import { cn } from "@/lib/utils";
/**
 * "Pick 2 more" — the nudge on a choice with a required number.
 *
 * Distinct from `selection-limit`, which guards a CEILING. This one guards a
 * FLOOR: a set menu that needs three courses, an onboarding that wants five
 * interests, a survey that requires two examples. The failure it prevents is
 * somebody pressing continue and being refused with no idea how short they are.
 *
 * IT COUNTS DOWN, NOT UP. "2 more" is an instruction; "3 of 5" is a status the
 * reader has to do arithmetic on. The full state switches to a plain
 * confirmation rather than vanishing, because something disappearing at the
 * moment of success reads as a glitch — and the space it leaves would reflow
 * the button underneath it.
 *
 * `aria-live="polite"` so the remaining count is announced as it falls. This is
 * the rare case where every change genuinely is worth saying: the number is the
 * instruction.
 *
 * Going over the target is treated as fine and simply reports the count. Only
 * the caller knows whether more than enough is a problem, and `selection-limit`
 * is the component that says so when it is.
 */
export function PickRemaining({ picked, required, noun = "more", doneNote = "That's everything.", className }: {
  picked: number;
  required: number;
  /** "Pick 2 more <noun>" — set it to name the thing. */
  noun?: string;
  doneNote?: string;
  className?: string;
}) {
  if (required <= 0) return null;
  const left = required - picked;
  return (
    <p aria-live="polite"
      className={cn("text-sm tabular-nums", left > 0 ? "font-medium" : "text-muted-foreground", className)}>
      {left > 0 ? `Pick ${left} ${noun}` : doneNote}
    </p>
  );
}
