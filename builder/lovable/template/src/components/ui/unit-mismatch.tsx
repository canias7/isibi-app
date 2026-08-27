import { cn } from "@/lib/utils";
/**
 * "You entered kg, the recipe is in grams."
 *
 * The warning for the moment two measurements meet in different units. It is
 * not a validation error — both values are perfectly valid — it is the point at
 * which somebody is about to compare or add them and get an answer out by a
 * factor of a thousand.
 *
 * IT OFFERS THE CONVERSION RATHER THAN JUST OBJECTING. "2.5 kg is 2,500 g —
 * use that?" turns a complaint into a fix, and the caller does the arithmetic
 * because only it knows the unit table.
 *
 * The famous version of this failure lost a spacecraft. The ordinary version
 * puts a 40-tonne load on a 4-tonne lift, and it always looks like a correct
 * number right up until it does not.
 *
 * `role="status"` — it appears while somebody is still typing, and interrupting
 * on every keystroke is unbearable.
 */
export function UnitMismatch({ entered, expected, suggestion, onUse, className }: {
  /** What they typed — "2.5 kg". */
  entered: string;
  /** What the rest of the form uses — "grams". */
  expected: string;
  /** The converted equivalent — "2,500 g". Computed by the caller. */
  suggestion?: string;
  onUse?: () => void;
  className?: string;
}) {
  return (
    <p data-slot="unit-mismatch" role="status" className={cn("flex flex-wrap items-center gap-x-2 text-sm", className)}>
      <span>
        <span className="font-medium">{entered}</span>
        <span className="text-muted-foreground"> — everything else here is in {expected}.</span>
      </span>
      {suggestion && (
        <span className="text-muted-foreground">That&apos;s <span className="font-medium text-foreground">{suggestion}</span>.</span>
      )}
      {suggestion && onUse && (
        <button type="button" onClick={onUse}
          className="cursor-pointer underline underline-offset-4">Use it</button>
      )}
    </p>
  );
}
